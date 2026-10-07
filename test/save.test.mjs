import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { apply, revealNative } from "../lib/index.js";

// A small implementation of the official service contract. Assertions examine
// real temporary files; production must delegate protected writes to the service.
async function host(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "bianji-save-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "sample.txt");
  await fs.writeFile(file, "original");
  let route; let tail = Promise.resolve(); let writes = 0;
  const policy = { mode: "workspace-write", workspaceRoot: root };
  const service = {
    async resolve(file) {
      try { return { targetKey: await fs.realpath(file), displayPath: file }; }
      catch (error) { if (error.code !== "ENOENT") throw error; return { targetKey: file, displayPath: file }; }
    },
    processPath(target) { return target.targetKey; },
    async stat(target) {
      try {
        const st = await fs.stat(target.targetKey);
        const content = st.isFile() ? await fs.readFile(target.targetKey) : Buffer.alloc(0);
        return { type: st.isFile() ? "file" : "directory", size: st.size, version: st.ino + ":" + content.toString("base64") };
      } catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
    },
    async readBytes(target) { return await fs.readFile(target.targetKey); },
    async writeText(target, content, intent, _signal, actualPolicy) {
      const previous = tail;
      let release;
      tail = new Promise((done) => { release = done; });
      await previous;
      try {
        assert.equal(actualPolicy, policy);
        const current = await service.stat(target);
        if (intent.kind !== "replaceIfVersion" || current?.version !== intent.version) throw Object.assign(new Error("file changed"), { code: "FS_STALE_VERSION" });
        writes++;
        await fs.writeFile(target.targetKey, content);
        return { operation: "update", version: (await service.stat(target)).version };
      } finally { release(); }
    },
  };
  const agent = { session: { header: { cwd: root } }, ctx: { get: (name) => name === "fs" ? service : name === "sandboxPolicy" ? { resolve: () => policy } : undefined } };
  apply({ connection: { fetch: { register(value) { route = value; } } }, get: (name) => name === "agents" ? { get: () => agent } : undefined });
  return {
    root, file, service, agent, writes: () => writes,
    async read(requested = file) { return (await route.fetch(new Request("http://local/api/bianji?action=read&sessionId=s&path=" + encodeURIComponent(requested)))).json(); },
    async write(content, version) {
      const response = await route.fetch(new Request("http://local/api/bianji", { method: "POST", body: JSON.stringify({ action: "write", sessionId: "s", path: file, content, version }) }));
      return { status: response.status, body: await response.json() };
    },
  };
}

test("reads return a version from the official filesystem service", async (t) => {
  const h = await host(t);
  const read = await h.read();
  assert.equal(read.version, (await h.service.stat(await h.service.resolve(h.file))).version);
});

test("external edits are preserved when a stale editor tries to save", async (t) => {
  const h = await host(t); const read = await h.read();
  await fs.writeFile(h.file, "external modification");
  const result = await h.write("local draft", read.version);
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "FS_STALE_VERSION");
  assert.equal(await fs.readFile(h.file, "utf8"), "external modification");
});

test("deleted files are not recreated by stale autosave", async (t) => {
  const h = await host(t); const read = await h.read();
  await fs.unlink(h.file);
  assert.equal((await h.write("local draft", read.version)).status, 409);
  await assert.rejects(fs.stat(h.file), { code: "ENOENT" });
});

test("same-sized atomic replacements still reject an old version", async (t) => {
  const h = await host(t); const read = await h.read();
  const replacement = path.join(h.root, "replacement");
  await fs.writeFile(replacement, "replaced"); await fs.rename(replacement, h.file);
  assert.equal((await h.write("local draft", read.version)).status, 409);
  assert.equal(await fs.readFile(h.file, "utf8"), "replaced");
});

test("two editors using the same version cannot overwrite each other", async (t) => {
  const h = await host(t); const read = await h.read();
  const results = await Promise.all([h.write("first draft", read.version), h.write("second draft", read.version)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(h.writes(), 1);
});

test("successful save returns the next baseline for subsequent edits", async (t) => {
  const h = await host(t); const read = await h.read();
  const first = await h.write("first draft", read.version);
  assert.equal(first.status, 200);
  assert.equal(typeof first.body.version, "string");
  assert.equal((await h.write("second draft", first.body.version)).status, 200);
  assert.equal(h.writes(), 2);
});

test("missing save precondition cannot silently overwrite an existing file", async (t) => {
  const h = await host(t);
  assert.equal((await h.write("unprotected draft")).status, 428);
  assert.equal(await fs.readFile(h.file, "utf8"), "original");
});

test("a missing official filesystem service is a visible failure", async (t) => {
  const h = await host(t); const read = await h.read();
  h.agent.ctx.get = () => undefined;
  assert.equal((await h.write("local draft", read.version)).status, 503);
  assert.equal(await fs.readFile(h.file, "utf8"), "original");
});

test("a file changed during reading never receives a mismatched saved baseline", async (t) => {
  const h = await host(t);
  h.service.readBytes = async () => { const buffer = await fs.readFile(h.file); await fs.writeFile(h.file, "external modification"); return buffer; };
  const read = await h.read();
  assert.equal(read.ok, false);
  assert.equal(read.code, "FS_STALE_VERSION");
});

test("the official sandbox denial remains visible and leaves the file intact", async (t) => {
  const h = await host(t); const read = await h.read();
  h.service.writeText = async () => { throw Object.assign(new Error("read-only mode"), { code: "FS_SANDBOX_DENIED" }); };
  const result = await h.write("local draft", read.version);
  assert.equal(result.status, 403);
  assert.equal(result.body.code, "FS_SANDBOX_DENIED");
  assert.equal(await fs.readFile(h.file, "utf8"), "original");
});

for (const [label, bytes] of [
  ["invalid continuation", Buffer.from([0x61, 0xc3, 0x28])],
  ["truncated multibyte", Buffer.from([0xe4, 0xb8])],
  ["UTF-8 encoded surrogate", Buffer.from([0xed, 0xa0, 0x80])],
  ["NUL beyond the sample", Buffer.concat([Buffer.alloc(9000, 65), Buffer.from([0])])],
]) {
  test(`read refuses ${label} without exposing a lossy editable draft`, async (t) => {
    const h = await host(t);
    await fs.writeFile(h.file, bytes);
    const result = await h.read();
    assert.equal(result.ok, false);
    assert.equal(result.code, "FS_NOT_TEXT");
    assert.equal(result.content, undefined);
    assert.deepEqual(await fs.readFile(h.file), bytes);
  });
}

test("UTF-8 BOM and line endings round-trip byte-for-byte", async (t) => {
  const h = await host(t);
  const bytes = Buffer.from("\ufeff中文\r\nsecond\r\n", "utf8");
  await fs.writeFile(h.file, bytes);
  const result = await h.read();
  assert.equal(result.ok, true);
  assert.equal(result.content, "\ufeff中文\r\nsecond\r\n");
  assert.equal((await h.write(result.content, result.version)).status, 200);
  assert.deepEqual(await fs.readFile(h.file), bytes);
});

for (const [label, content] of [
  ["NUL", "local\0draft"],
  ["NUL beyond the sample", "a".repeat(9000) + "\0"],
  ["unpaired high surrogate", "local\ud800draft"],
  ["unpaired low surrogate", "local\udfffdraft"],
]) {
  test(`save refuses ${label} before calling the protected writer`, async (t) => {
    const h = await host(t); const read = await h.read();
    const result = await h.write(content, read.version);
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "FS_NOT_TEXT");
    assert.equal(h.writes(), 0);
    assert.equal(await fs.readFile(h.file, "utf8"), "original");
  });
}

test("valid supplementary Unicode and literal replacement characters remain editable", async (t) => {
  const h = await host(t); const read = await h.read();
  const content = "中文 😀 \ufffd";
  assert.equal((await h.write(content, read.version)).status, 200);
  assert.equal((await h.read()).content, content);
});

test("POSIX backslashes identify literal filenames, not a different path", { skip: process.platform === "win32" }, async (t) => {
  const h = await host(t);
  const file = path.join(h.root, "literal\\name.txt");
  await fs.writeFile(file, "literal target");
  assert.equal((await h.read(file)).content, "literal target");
});

async function outsideFile(t) {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "bianji-outside-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "private.txt");
  await fs.writeFile(file, "outside workspace");
  return fs.realpath(file);
}

test("official resolved process path is checked before any bytes are read", async (t) => {
  const h = await host(t); const outside = await outsideFile(t);
  h.service.resolve = async (file) => ({ displayPath: file, targetKey: outside });
  let reads = 0;
  h.service.readBytes = async () => { reads++; return Buffer.from("outside workspace"); };
  const result = await h.read();
  assert.equal(result.ok, false);
  assert.equal(reads, 0);
  assert.equal(result.content, undefined);
});

test("official resolved process path is checked before protected writes", async (t) => {
  const h = await host(t); const read = await h.read(); const outside = await outsideFile(t);
  h.service.resolve = async (file) => ({ displayPath: file, targetKey: outside });
  const result = await h.write("local draft", read.version);
  assert.equal(result.status, 400);
  assert.equal(h.writes(), 0);
  assert.equal(await fs.readFile(outside, "utf8"), "outside workspace");
});

test("a target swapped to an outside symlink during read cannot expose bytes", async (t) => {
  const h = await host(t); const outside = await outsideFile(t);
  h.service.readBytes = async (target) => {
    await fs.unlink(target.targetKey);
    await fs.symlink(outside, target.targetKey);
    return fs.readFile(target.targetKey);
  };
  // Keep the version identical to show containment is an independent check.
  h.service.stat = async () => ({ type: "file", size: 8, version: "fixed" });
  const result = await h.read();
  assert.equal(result.ok, false);
  assert.equal(result.content, undefined);
});

test("a target swapped to an outside symlink after resolution is not written", async (t) => {
  const h = await host(t); const read = await h.read(); const outside = await outsideFile(t);
  const resolve = h.service.resolve;
  h.service.resolve = async (file) => {
    const target = await resolve(file);
    await fs.unlink(file);
    await fs.symlink(outside, file);
    return target;
  };
  const result = await h.write("local draft", read.version);
  assert.equal(result.status, 400);
  assert.equal(h.writes(), 0);
  assert.equal(await fs.readFile(outside, "utf8"), "outside workspace");
});

test("a service without a host-path capability fails visibly before content I/O", async (t) => {
  const h = await host(t); const read = await h.read();
  delete h.service.processPath;
  let reads = 0;
  h.service.readBytes = async () => { reads++; return Buffer.from("original"); };
  const result = await h.read();
  assert.equal(result.ok, false);
  assert.equal(result.code, "FS_UNAVAILABLE");
  assert.equal(reads, 0);
  assert.equal((await h.write("local draft", read.version)).status, 503);
  assert.equal(h.writes(), 0);
});

test("a stable workspace symlink remains readable", async (t) => {
  const h = await host(t);
  const alias = path.join(h.root, "alias.txt");
  await fs.symlink(h.file, alias);
  const result = await h.read(alias);
  assert.equal(result.ok, true);
  assert.equal(result.content, "original");
  assert.equal(result.path, await fs.realpath(h.file));
});

test("a target swapped during the initial provider stat is rejected before read", async (t) => {
  const h = await host(t); const outside = await outsideFile(t);
  let reads = 0;
  h.service.stat = async (target) => {
    await fs.unlink(target.targetKey);
    await fs.symlink(outside, target.targetKey);
    return { type: "file", version: "fixed" };
  };
  h.service.readBytes = async () => { reads++; return Buffer.from("outside workspace"); };
  const result = await h.read();
  assert.equal(result.ok, false);
  assert.equal(reads, 0);
});

test("file manager spawn failures reject instead of reporting success", async () => {
  await assert.rejects(revealNative("/tmp", () => spawn("/bianji-missing-file-manager-command", [], { stdio: "ignore" })), { code: "ENOENT" });
});

test("file manager nonzero exits reject instead of reporting success", async () => {
  await assert.rejects(revealNative("/tmp", () => spawn(process.execPath, ["-e", "process.exit(7)"], { stdio: "ignore" })), /file manager failed \(7\)/);
});

test("file manager success is not resolved merely by its spawn event", async () => {
  const child = new EventEmitter();
  child.unref = () => {};
  let settled = false;
  const operation = revealNative("/tmp", () => child).then(() => { settled = true; });
  child.emit("spawn");
  await Promise.resolve();
  assert.equal(settled, false);
  child.emit("close", 0, null);
  await operation;
  assert.equal(settled, true);
});
