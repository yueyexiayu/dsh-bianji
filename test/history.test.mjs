import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { apply } from "../lib/index.js";

async function fixture(t, { inspect, policy = true } = {}) {
  const tmp = await mkdtemp(path.join(tmpdir(), "bianji-history-"));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const cwd = await realpath(tmp);
  const file = path.join(cwd, "sample.txt");
  await writeFile(file, "original");
  let route, observedPolicy, resumes = 0;
  const service = {
    resolve: async (p) => ({ targetKey: p }), processPath: (t) => t.targetKey,
    stat: async () => ({ version: "v1" }), readBytes: (t) => readFile(t.targetKey),
    writeText: async (t, content, intent, _signal, policy) => {
      observedPolicy = policy;
      assert.equal(intent.kind, "replaceIfVersion");
      if (policy.mode === "read-only") throw Object.assign(new Error("denied"), { code: "FS_SANDBOX_DENIED" });
      await writeFile(t.targetKey, content); return { version: "v2", operation: "update" };
    },
  };
  const services = {
    agents: { get: () => undefined, resume: () => { resumes++; throw new Error("must not resume"); }, create: () => { resumes++; throw new Error("must not create"); } },
    sessionController: { inspect: inspect || (async () => ({ meta: { id: "cold", cwd }, events: [{ type: "sandbox/mode", data: { mode: "read-only" } }] })) },
    fs: service,
    sessions: { prepare: (id, { meta, seed }) => ({ id, header: meta, events: seed }) },
    sandboxPolicy: policy ? { resolve: ({ session } = {}) => ({ mode: session?.events.findLast((event) => event.type === "sandbox/mode")?.data.mode || "danger-full-access", workspaceRoot: session?.header.cwd || "/" }) } : undefined,
  };
  apply({ get: (key) => services[key], connection: { fetch: { register(def) { if (def.path === "/api/bianji") route = def.fetch; } } } });
  const call = async (action, extra = {}) => {
    const response = await route(new Request("http://fixture/api/bianji", { method: "POST", body: JSON.stringify({ action, sessionId: "cold", path: file, ...extra }) }));
    return { status: response.status, body: await response.json() };
  };
  return { cwd, file, call, services, resumes: () => resumes, observedPolicy: () => observedPolicy };
}

test("cold history lists and reads without creating or resuming an agent", async (t) => {
  const h = await fixture(t);
  assert.equal((await h.call("root")).body.root, h.cwd);
  assert.equal((await h.call("list", { path: "." })).body.entries[0].name, "sample.txt");
  assert.equal((await h.call("read")).body.content, "original");
  assert.equal(h.resumes(), 0);
});
test("cold save honors persisted read-only mode rather than broad Host fallback", async (t) => {
  const h = await fixture(t);
  assert.equal((await h.call("write", { content: "draft", version: "v1" })).status, 403);
  assert.equal(h.observedPolicy().workspaceRoot, h.cwd);
  assert.equal(await readFile(h.file, "utf8"), "original");
});
for (const [name, error, expected] of [
  ["missing history", Object.assign(new Error("not found"), { name: "ApiSessionNotFound" }), 404],
  ["corrupt history", Object.assign(new Error("corrupt"), { code: "SESSION_QUERY_CORRUPT_SESSION" }), 500],
  ["persistence failure", Object.assign(new Error("backend unavailable"), { code: "SESSION_QUERY_PERSISTENCE_FAILED" }), 500],
]) test(`${name} is not hidden as absent cwd`, async (t) => {
  const h = await fixture(t, { inspect: async () => { throw error; } });
  assert.equal((await h.call("root")).status, expected);
});
test("missing controller is a service failure, missing cwd is an invalid workspace", async (t) => {
  const h = await fixture(t);
  h.services.sessionController = undefined;
  assert.equal((await h.call("root")).status, 503);
  h.services.sessionController = { inspect: async () => ({ meta: { id: "cold" }, events: [] }) };
  assert.equal((await h.call("root")).status, 400);
});
for (const source of ["cold", "live"]) test(`${source} relative cwd is rejected before filesystem I/O`, async (t) => {
  const h = await fixture(t);
  h.services.sessionController = { inspect: async () => ({ meta: { id: "cold", cwd: "." }, events: [] }) };
  if (source === "live") h.services.agents.get = () => ({ session: { header: { cwd: "." } } });
  const result = await h.call("root"); assert.equal(result.status, 400); assert.equal(result.body.code, "SESSION_NO_WORKSPACE");
});

test("missing sandbox policy fails before a historical write", async (t) => {
  const h = await fixture(t, { policy: false });
  assert.equal((await h.call("write", { content: "draft", version: "v1" })).status, 503);
  assert.equal(await readFile(h.file, "utf8"), "original");
});
