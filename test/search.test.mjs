import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { apply } from "../lib/index.js";
import { isPathInside } from "../lib/parse.js";

async function host(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "bianji-search-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "src"));
  await fs.mkdir(path.join(root, "node_modules"));
  await fs.writeFile(path.join(root, "src", "good.ts"), "first\nconst needle = 1\nlast\n");
  await fs.writeFile(path.join(root, "src", "other.txt"), "nothing here\n");
  await fs.writeFile(path.join(root, "node_modules", "skip.ts"), "needle\n");
  await fs.writeFile(path.join(root, "image.png"), Buffer.from([0, 1, 2, 3]));

  let route;
  const service = {
    async resolve(file) { return { targetKey: await fs.realpath(file), displayPath: file }; },
    processPath(target) { return target.targetKey; },
    async stat(target) {
      const st = await fs.stat(target.targetKey);
      const content = st.isFile() ? await fs.readFile(target.targetKey) : Buffer.alloc(0);
      return { type: st.isFile() ? "file" : "directory", size: st.size, version: st.ino + ":" + content.toString("base64") };
    },
    async readBytes(target) { return fs.readFile(target.targetKey); },
  };
  const agent = { session: { header: { cwd: root } }, ctx: { get: (name) => name === "fs" ? service : undefined } };
  const ctx = {
    connection: { fetch: { register(value) { if (value.path === "/api/bianji") route = value; } } },
    get(name) { return name === "agents" ? { get: () => agent } : undefined; },
  };
  apply(ctx, {});
  return { root, async search(params) {
    const response = await route.fetch(new Request("http://local/api/bianji?" + new URLSearchParams(params)));
    return { status: response.status, body: await response.json() };
  } };
}

test("search matches file names and protected text content inside the session workspace", async (t) => {
  const h = await host(t);
  const result = await h.search({ action: "search", sessionId: "s", q: "needle", content: "1" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.results.map((item) => item.relative), ["src/good.ts"]);
  assert.equal(result.body.results[0].matches[0].line, 2);
  assert.ok(isPathInside(await fs.realpath(h.root), result.body.results[0].path));
});

test("name-only search can locate deep paths without reading contents", async (t) => {
  const h = await host(t);
  const result = await h.search({ action: "search", sessionId: "s", q: "good", content: "0" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.results.map((item) => item.relative), ["src/good.ts"]);
  assert.deepEqual(result.body.results[0].matches, []);
});

test("search never enters dependency folders or decodes binary files", async (t) => {
  const h = await host(t);
  const result = await h.search({ action: "search", sessionId: "s", q: "needle", content: "1" });
  assert.equal(result.status, 200);
  assert.ok(result.body.results.every((item) => !item.relative.startsWith("node_modules/")));
  assert.ok(result.body.results.every((item) => !item.relative.endsWith(".png")));
});

test("content search is refused when the official file service is unavailable", async (t) => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "bianji-search-no-fs-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let route;
  const agent = { session: { header: { cwd: root } }, ctx: { get: () => undefined } };
  apply({
    connection: { fetch: { register(value) { if (value.path === "/api/bianji") route = value; } } },
    get(name) { return name === "agents" ? { get: () => agent } : undefined; },
  }, {});
  const response = await route.fetch(new Request("http://local/api/bianji?action=search&sessionId=s&q=needle&content=1"));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "FS_UNAVAILABLE");
});

test("search rejects requests without a session instead of accepting a client root", async (t) => {
  const h = await host(t);
  const result = await h.search({ action: "search", q: "needle", content: "0", root: h.root });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "SESSION_REQUIRED");
});
