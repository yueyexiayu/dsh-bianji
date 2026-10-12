import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Actual official Controller/Query/Store/Projection/Policy/FS classes. Only the
// persistence I/O seam and unused Agent/transport endpoints are fixture doubles.
export async function officialSessionFixture(runtime, cwd) {
  const load = (name) => import(pathToFileURL(path.join(runtime, "node_modules/@deepseek-ai", name, "lib/index.js")).href);
  const [{ Context }, { SessionStore }, { SessionProjectionRegistry }, { SandboxPolicyService }, { SandboxedFileSystem }, { SessionQueryEngine }, { SessionController }] = await Promise.all([
    load("cordis"), load("dsh-session"), load("dsh-session-projection"), load("dsh-sandbox-policy"), load("dsh-fs-sandbox"), load("dsh-session-query"), load("dsh-api-session-controller"),
  ]);
  const ctx = new Context(); const fibers = []; let activations = 0, mutations = 0, handles = 0;
  const snapshots = new Map();
  const provide = (key, value) => { ctx.provide(key); ctx.set(key, value); };
  provide("typert", { lookups: { register() {}, configure() {} }, contexts: { configureHost() {} } });
  const forbidden = () => { activations++; throw new Error("fixture forbids Agent activation"); };
  provide("agents", { get: () => undefined, create: forbidden, resume: forbidden });
  provide("fileUploads", { registerAgentResolver: () => () => {} });
  provide("agentDefaultModel", { currentSelection: () => ({ provider: "fixture", model: "fixture" }) });
  provide("attachments", { imageLimits: { maxImageBytes: 1048576 } });
  provide("llm", {});
  provide("workspaceRegistry", { archivedSessionIds: new Set(), list: () => [] });
  provide("sessionPersistence", {
    identity: "isolated-fixture",
    async stat(id) { const snapshot = snapshots.get(id); return snapshot ? { header: snapshot.meta, revision: snapshot.revision } : undefined; },
    async open(id, access) {
      assert.equal(access, "read"); const snapshot = snapshots.get(id);
      if (!snapshot) throw Object.assign(new Error("not found"), { name: "SessionPersistenceNotFoundError" });
      handles++;
      return { header: snapshot.meta, inheritedEventCount: 0,
        read: async () => ({ events: structuredClone(snapshot.events) }), close: async () => { handles--; } };
    },
  });
  for (const [Service, config] of [[SessionStore], [SessionProjectionRegistry], [SandboxPolicyService, { mode: "danger-full-access", workspaceRoot: cwd }], [SandboxedFileSystem, { cwd, diffBasisMaxBytes: 1048576 }], [SessionQueryEngine]]) {
    const fiber = ctx.plugin(Service, config); fibers.push(fiber); await fiber.await();
  }
  const controllerFiber = ctx.plugin(SessionController, {}); fibers.push(controllerFiber); await controllerFiber.await();
  const controller = ctx.sessionController;
  ctx.on("session/created", () => { mutations++; });
  ctx.on("session/event", () => { mutations++; });
  const seed = ctx.sessions.prepare("cold", { meta: { cwd } });
  const meta = seed.header;
  function setMode(mode) {
    const events = [{ type: "sandbox/mode", seq: 0, time: Date.now(), data: { mode } }];
    snapshots.set("cold", { meta, events, revision: String(Date.now()) + Math.random() });
  }
  setMode("read-only");
  return { ctx, controller, snapshots, setMode, meta, counts: () => ({ activations, mutations, handles }),
    async close() { for (const fiber of fibers.reverse()) await fiber.dispose(); } };
}
