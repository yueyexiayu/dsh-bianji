import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { apply } from "../lib/index.js";

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
    async resolve(file) { return { targetKey: file, displayPath: file }; },
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
    async read() { return (await route.fetch(new Request("http://local/api/bianji?action=read&sessionId=s&path=" + encodeURIComponent(file)))).json(); },
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
