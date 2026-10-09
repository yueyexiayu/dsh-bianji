import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { apply } from "../lib/index.js";

// Opt in explicitly: ordinary Node cannot load modules inside Electron's ASAR.
// Run this file using ELECTRON_RUN_AS_NODE=1 and the installed desktop executable.
const runtime = process.env.BIANJI_OFFICIAL_RUNTIME;
const official = runtime ? await (async () => {
  const base = pathToFileURL(path.join(runtime, "node_modules") + path.sep).href;
  const { Context } = await import(base + "@deepseek-ai/cordis/lib/index.js");
  const { SandboxedFileSystem } = await import(base + "@deepseek-ai/dsh-fs-sandbox/lib/index.js");
  const { WorkspaceFiles } = await import(base + "@deepseek-ai/dsh-api-workspace-files/lib/index.js");
  return { Context, SandboxedFileSystem, WorkspaceFiles };
})() : undefined;
const check = (name, run) => test(name, { skip: official ? false : "Set BIANJI_OFFICIAL_RUNTIME and run with the installed Electron executable" }, run);

async function host(t, mode = "workspace-write") {
  const temp = await fs.mkdtemp(path.join(tmpdir(), "bianji-official-"));
  const root = await fs.realpath(temp);
  // Cleanup is limited to the exact temporary root created above.
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "sample.txt");
  await fs.writeFile(file, "original");
  const policy = { mode, workspaceRoot: root };
  const ctx = new official.Context();
  ctx.provide("sandboxPolicy");
  ctx.set("sandboxPolicy", { defaultMode: mode, resolve: () => policy });
  const service = new official.SandboxedFileSystem(ctx, { cwd: root, diffBasisMaxBytes: 10 * 1024 * 1024 });
  const agent = { session: { header: { cwd: root } }, ctx: { get: (name) => name === "fs" ? service : name === "sandboxPolicy" ? { resolve: () => policy } : undefined } };
  let route;
  apply({ connection: { fetch: { register(value) { if (value.path === "/api/bianji") route = value; } } }, get: (name) => name === "agents" ? { get: () => agent } : undefined });
  async function request(action, filePath = file, extra = {}) {
    const req = action === "write"
      ? new Request("http://local/api/bianji", { method: "POST", body: JSON.stringify({ action, sessionId: "s", path: filePath, ...extra }) })
      : new Request("http://local/api/bianji?" + new URLSearchParams({ action, sessionId: "s", path: filePath }));
    const response = await route.fetch(req);
    return { status: response.status, body: await response.json() };
  }
  return { root, file, service, policy, read: (filePath) => request("read", filePath), write: (content, version, filePath) => request("write", filePath, { content, version }) };
}

check("official workspace tree supports persisted sessions without live agents; editor currently does not", async (t) => {
  const h = await host(t);
  const ctx = new official.Context();
  let lookup;
  const services = {
    fs: h.service,
    sandboxPolicy: { workspaceRoot: h.root },
    sessions: { get: () => undefined },
    sessionPersistence: { stat: async () => ({ header: { cwd: h.root } }) },
    typert: { lookups: { register: (_name, value) => { lookup = value; } } },
  };
  for (const [name, service] of Object.entries(services)) {
    ctx.provide(name); ctx.set(name, service);
  }
  const tree = new official.WorkspaceFiles(ctx, { maxBytes: 2097152, maxFileBytes: 33554432, maxLines: 5000, maxEntries: 2000 });
  await Promise.resolve();
  assert.ok(lookup, "packaged service registered its real scope resolver");
  const scope = await lookup.resolve("historical-session");
  assert.equal(scope.workspaceRoot, h.root);
  assert.ok((await tree.list(scope, ".")).entries.some((entry) => entry.name === "sample.txt"));
  let route;
  apply({ connection: { fetch: { register: (value) => { route = value; } } }, get: (name) => name === "agents" ? { get: () => undefined } : services[name] });
  const result = await route.fetch(new Request("http://local/api/bianji?action=list&sessionId=historical-session"));
  assert.equal(result.status, 400);
  assert.deepEqual(await result.json(), { ok: false, error: "no workspace for this session" });
});

check("official FS: read baseline is the provider's actual version", async (t) => {
  const h = await host(t); const result = await h.read();
  assert.equal(result.status, 200);
  assert.equal(result.body.content, "original");
  assert.equal(result.body.version, (await h.service.stat(await h.service.resolve(h.file))).version);
});

check("official FS: stale save preserves external edit", async (t) => {
  const h = await host(t); const result = await h.read();
  await fs.writeFile(h.file, "external");
  const saved = await h.write("draft", result.body.version);
  assert.equal(saved.status, 409); assert.equal(saved.body.code, "FS_STALE_VERSION");
  assert.equal(await fs.readFile(h.file, "utf8"), "external");
});

check("official FS: stale save does not recreate deleted file", async (t) => {
  const h = await host(t); const result = await h.read();
  await fs.unlink(h.file);
  assert.equal((await h.write("draft", result.body.version)).status, 409);
  await assert.rejects(fs.stat(h.file), { code: "ENOENT" });
});

check("official FS: same-size atomic replacement conflicts", async (t) => {
  const h = await host(t); const result = await h.read();
  const replacement = path.join(h.root, "replacement");
  await fs.writeFile(replacement, "replaced"); await fs.rename(replacement, h.file);
  assert.equal((await h.write("draft", result.body.version)).status, 409);
  assert.equal(await fs.readFile(h.file, "utf8"), "replaced");
});

check("official FS: concurrent editor saves share the provider lock", async (t) => {
  const h = await host(t); const result = await h.read();
  const results = await Promise.all([h.write("first", result.body.version), h.write("second", result.body.version)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(await fs.readFile(h.file, "utf8"), results[0].status === 200 ? "first" : "second");
});

check("official FS: AI edit and editor save share one version guard and lock", async (t) => {
  const h = await host(t); const result = await h.read(); const target = await h.service.resolve(h.file);
  const results = await Promise.allSettled([
    h.service.editText(target, { oldString: "original", newString: "AI", replaceAll: false }, { version: result.body.version }, undefined, h.policy),
    h.write("editor", result.body.version),
  ]);
  const aiWon = results[0].status === "fulfilled";
  const editor = results[1]; assert.equal(editor.status, "fulfilled");
  assert.equal(editor.value.status, aiWon ? 409 : 200);
  if (!aiWon) assert.equal(results[0].reason.code, "FS_STALE_VERSION");
  assert.equal(await fs.readFile(h.file, "utf8"), aiWon ? "AI" : "editor");
});

check("official FS: successful save advances subsequent save baseline", async (t) => {
  const h = await host(t); const result = await h.read(); const first = await h.write("first", result.body.version);
  assert.equal(first.status, 200); assert.notEqual(first.body.version, result.body.version);
  assert.equal((await h.write("second", first.body.version)).status, 200);
});

check("official FS: read-only policy visibly denies writes", async (t) => {
  const h = await host(t, "read-only"); const result = await h.read();
  const saved = await h.write("draft", result.body.version);
  assert.equal(saved.status, 403); assert.equal(saved.body.code, "FS_SANDBOX_DENIED");
  assert.equal(await fs.readFile(h.file, "utf8"), "original");
});

check("official FS: missing baseline cannot bypass protected write", async (t) => {
  const h = await host(t); assert.equal((await h.write("draft")).status, 428);
  assert.equal(await fs.readFile(h.file, "utf8"), "original");
});

check("official FS: UTF-8 BOM, emoji and CRLF round-trip byte-for-byte", async (t) => {
  const h = await host(t); const bytes = Buffer.from("\ufeff中文🙂\r\nsecond\r\n", "utf8");
  await fs.writeFile(h.file, bytes); const result = await h.read();
  assert.equal(result.status, 200); assert.equal(result.body.content, "\ufeff中文🙂\r\nsecond\r\n");
  assert.equal((await h.write(result.body.content, result.body.version)).status, 200);
  assert.deepEqual(await fs.readFile(h.file), bytes);
});

check("official FS: invalid GBK bytes are rejected without changing disk", async (t) => {
  const h = await host(t); const bytes = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);
  await fs.writeFile(h.file, bytes); const result = await h.read();
  assert.equal(result.status, 400); assert.equal(result.body.ok, false);
  assert.match(result.body.error, /UTF-8/); assert.equal(result.body.content, undefined);
  assert.deepEqual(await fs.readFile(h.file), bytes);
});

check("official FS: NUL and isolated surrogate are rejected before write", async (t) => {
  const h = await host(t); const result = await h.read();
  for (const content of ["text\0end", "text\ud800end"]) {
    assert.equal((await h.write(content, result.body.version)).status, 400);
    assert.equal(await fs.readFile(h.file, "utf8"), "original");
  }
});

check("official FS: POSIX backslash filename is not a directory separator", async (t) => {
  const h = await host(t); const file = path.join(h.root, "a\\b.txt");
  await fs.mkdir(path.join(h.root, "a")); await fs.writeFile(path.join(h.root, "a", "b.txt"), "other");
  await fs.writeFile(file, "literal"); const result = await h.read(file);
  assert.equal(result.status, 200); assert.equal(result.body.content, "literal");
  assert.equal((await h.write("updated", result.body.version, file)).status, 200);
  assert.equal(await fs.readFile(file, "utf8"), "updated");
  assert.equal(await fs.readFile(path.join(h.root, "a", "b.txt"), "utf8"), "other");
});

check("official FS: symlink swap between path check and provider resolve cannot exfiltrate", async (t) => {
  const h = await host(t, "danger-full-access"); const outside = path.join(h.root, "..", path.basename(h.root) + "-outside");
  await fs.writeFile(outside, "private-outside"); t.after(() => fs.unlink(outside));
  const resolve = h.service.resolve.bind(h.service); let once = false;
  h.service.resolve = async (...args) => {
    if (!once) { once = true; await fs.unlink(h.file); await fs.symlink(outside, h.file); }
    return resolve(...args);
  };
  const result = await h.read(); assert.equal(result.status, 400); assert.equal(result.body.ok, false);
  assert.equal(result.body.content, undefined); assert.equal(await fs.readFile(outside, "utf8"), "private-outside");
});

check("official FS: provider read-time symlink swap never returns outside content", async (t) => {
  const h = await host(t, "danger-full-access"); const outside = path.join(h.root, "..", path.basename(h.root) + "-outside");
  await fs.writeFile(outside, "private-outside"); t.after(() => fs.unlink(outside));
  const readBytes = h.service.readBytes.bind(h.service);
  h.service.readBytes = async (...args) => {
    await fs.unlink(h.file); await fs.symlink(outside, h.file);
    return readBytes(...args);
  };
  const result = await h.read(); assert.equal(result.body.ok, false); assert.equal(result.body.content, undefined);
});

check("official FS: AI must reread after editor save before editing", async (t) => {
  const h = await host(t); const target = await h.service.resolve(h.file); const old = (await h.service.stat(target)).version;
  assert.equal((await h.write("editor", old)).status, 200);
  await assert.rejects(h.service.editText(target, { oldString: "editor", newString: "AI", replaceAll: false }, { version: old }, undefined, h.policy), { code: "FS_STALE_VERSION" });
  const fresh = (await h.service.stat(target)).version;
  await h.service.readText(target);
  await h.service.editText(target, { oldString: "editor", newString: "AI", replaceAll: false }, { version: fresh }, undefined, h.policy);
  assert.equal(await fs.readFile(h.file, "utf8"), "AI");
});
