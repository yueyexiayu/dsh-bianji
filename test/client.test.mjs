import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const tick = () => new Promise(setImmediate);
function client() {
  let plugin; let FilesTab; let cursor = 0; let tree;
  let hooks = [];
  const effects = []; const timers = new Map(); const writes = []; const reads = [];
  let delayRead = false;
  let timerId = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children: children.flat() }; },
    useState(seed) {
      const id = cursor++;
      if (!(id in hooks)) hooks[id] = typeof seed === "function" ? seed() : seed;
      return [hooks[id], (value) => { hooks[id] = typeof value === "function" ? value(hooks[id]) : value; }];
    },
    useRef(seed) { const id = cursor++; return hooks[id] ??= { current: seed }; },
    useCallback(callback, deps) {
      const id = cursor++;
      if (!same(hooks[id]?.deps, deps)) hooks[id] = { deps, callback };
      return hooks[id].callback;
    },
    useEffect(callback, deps) {
      const id = cursor++;
      if (!same(hooks[id]?.deps, deps)) { hooks[id]?.cleanup?.(); effects.push(() => { hooks[id] = { deps, cleanup: callback() }; }); }
    },
  };
  let disk = { content: "original", version: "v1" };
  const clientWindow = { __ModuleLoader__: { load(module) { plugin = module.factory(() => React); } }, addEventListener() {}, removeEventListener() {} };
  vm.runInNewContext(readFileSync(new URL("../lib/client.js", import.meta.url), "utf8"), {
    window: clientWindow,
    document: { getElementById: () => ({}) }, URLSearchParams, Map,
    fetch(url, init) {
      if (init?.method === "POST") {
        return new Promise((resolve) => writes.push({ body: JSON.parse(init.body), finish: (body) => resolve({ json: async () => body }) }));
      }
      const params = new URL(url, "http://local").searchParams;
      if (params.get("action") === "read" && delayRead) return new Promise((resolve) => reads.push({ finish: (body) => resolve({ json: async () => body }) }));
      return Promise.resolve({ json: async () => params.get("action") === "read"
        ? { ok: true, path: params.get("path"), relative: "a.txt", ...disk }
        : { ok: true, root: "/workspace", entries: [{ name: "a.txt", type: "file", path: "/workspace/a.txt", relative: "a.txt" }] } });
    },
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); },
  });
  plugin.apply({ effect: (callback) => callback(), sidebarRightTabs: { register() {} }, slots: {
    inject(_name, callback) { return callback(); }, register(options, component) { if (options.name === "sidebar.right.pane.tab") FilesTab = component; },
  } });
  const component = FilesTab({ sessionId: "s" }).type;
  let props = FilesTab({ sessionId: "s" }).props;
  function render() { cursor = 0; tree = component(props); while (effects.length) effects.shift()(); }
  function find(predicate, node = tree) {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;
    for (const child of node.children ?? []) { const found = find(predicate, child); if (found) return found; }
    return null;
  }
  render();
  return {
    writes, reads, render, find,
    delayReads() { delayRead = true; },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); hooks = []; },
    mount(sessionId = "s") { props = FilesTab({ sessionId }).props; render(); },
    async open(file = "/workspace/a.txt") { await tick(); render(); find((node) => node.type?.name === "TreeNode").props.onOpen(file); await tick(); render(); },
    edit(content) { find((node) => node.type?.name === "CodeEditor").props.onChange(content); render(); },
    autosave() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); render(); },
    close() { find((node) => node.props.title === "关闭文件").props.onClick(); render(); },
    draft() { return find((node) => node.type?.name === "CodeEditor")?.props.value; },
    setDisk(value) { disk = value; },
    async settle() { await tick(); render(); },
    async monaco() {
      const CodeEditor = find((node) => node.type?.name === "CodeEditor").type;
      hooks.length = 0;
      let value = "original"; let changed;
      const edits = [];
      const editor = { getValue: () => value, setValue(next) { value = next; changed?.(); }, onDidChangeModelContent(callback) { changed = callback; }, dispose() {} };
      clientWindow.monaco = { editor: { create: () => editor } };
      let input = "original";
      function renderEditor() {
        cursor = 0;
        CodeEditor({ path: "/workspace/a.txt", value: input, onChange: (content) => edits.push(content) });
        hooks[0].current = {};
        while (effects.length) effects.shift()();
      }
      renderEditor(); await tick(); renderEditor();
      return { editor, edits, reload(content) { input = content; renderEditor(); } };
    },
  };
}

test("typing during a save retains the new draft and advances the next request's baseline", async () => {
  const c = client(); await c.open(); c.edit("first draft"); c.autosave();
  assert.equal(c.writes[0].body.version, "v1");
  c.edit("second draft");
  c.writes[0].finish({ ok: true, version: "v2" }); await c.settle();
  assert.equal(c.draft(), "second draft");
  assert.equal(c.writes[1].body.content, "second draft");
  assert.equal(c.writes[1].body.version, "v2");
  c.writes[1].finish({ ok: true, version: "v3" }); await c.settle();
  assert.equal(c.find((node) => node.type === "button" && node.children[0] === "保存").props.disabled, true);
});

test("conflicts retain the draft, pause autosave, and prevent closing the tab", async () => {
  const c = client(); await c.open(); c.edit("local draft"); c.close();
  assert.equal(c.draft(), "local draft");
  c.writes[0].finish({ ok: false, code: "FS_STALE_VERSION", error: "external file changed" }); await c.settle();
  assert.equal(c.draft(), "local draft");
  assert.ok(c.find((node) => node.props.role === "alert"));
  c.edit("retained new draft"); c.autosave(); c.close(); await c.settle();
  assert.equal(c.writes.length, 1);
  assert.equal(c.draft(), "retained new draft");
});

test("a failed save cannot remove a dirty tab", async () => {
  const c = client(); await c.open(); c.edit("local draft"); c.close();
  c.writes[0].finish({ ok: false, error: "write permission denied" }); await c.settle();
  assert.equal(c.draft(), "local draft");
  assert.ok(c.find((node) => node.props.role === "alert"));
});

test("closing waits for an already running save and its queued latest draft", async () => {
  const c = client(); await c.open(); c.edit("first draft"); c.autosave(); c.edit("latest draft"); c.close();
  assert.equal(c.draft(), "latest draft");
  assert.equal(c.writes.length, 1);
  c.writes[0].finish({ ok: true, version: "v2" }); await c.settle();
  assert.equal(c.writes[1].body.content, "latest draft");
  assert.equal(c.draft(), "latest draft");
  c.writes[1].finish({ ok: true, version: "v3" }); await c.settle();
  assert.equal(c.draft(), undefined);
});

test("reload requires explicit discard confirmation and replaces the baseline", async () => {
  const c = client(); await c.open(); c.edit("local draft"); c.autosave();
  c.writes[0].finish({ ok: false, code: "FS_STALE_VERSION", error: "external file changed" }); await c.settle();
  c.setDisk({ content: "external content", version: "external-v2" });
  const reload = () => c.find((node) => node.type === "button" && node.children[0] === "重新加载").props.onClick();
  reload(); await c.settle(); assert.equal(c.draft(), "local draft");
  c.find((node) => node.type === "button" && node.children[0] === "取消").props.onClick(); await c.settle();
  assert.equal(c.draft(), "local draft");
  reload(); await c.settle();
  c.find((node) => node.type === "button" && node.children[0] === "确认丢弃并重新加载").props.onClick(); await c.settle(); assert.equal(c.draft(), "external content");
  c.edit("merged content"); c.autosave();
  assert.equal(c.writes[1].body.version, "external-v2");
  c.writes[1].finish({ ok: true, version: "v3" }); await c.settle();
});

test("editing multiple files does not cancel another file's autosave", async () => {
  const c = client(); await c.open(); c.edit("a draft"); await c.open("/workspace/b.txt"); c.edit("b draft"); c.autosave();
  assert.deepEqual(c.writes.map((write) => write.body.path).sort(), ["/workspace/a.txt", "/workspace/b.txt"]);
  for (const write of c.writes) write.finish({ ok: true, version: "v2" });
  await c.settle();
});

test("Monaco reload updates its model without scheduling an unintended autosave", async () => {
  const c = client(); await c.open();
  const monaco = await c.monaco();
  monaco.reload("external content");
  assert.equal(monaco.editor.getValue(), "external content");
  assert.deepEqual(monaco.edits, []);
  monaco.editor.setValue("user edit");
  assert.deepEqual(monaco.edits, ["user edit"]);
});

test("undoing to the original content during a save cannot close before the undo is persisted", async () => {
  const c = client(); await c.open(); c.edit("in-flight draft"); c.autosave(); c.edit("original"); c.close();
  await c.settle();
  assert.equal(c.draft(), "original");
  c.writes[0].finish({ ok: true, version: "v2" }); await c.settle();
  assert.equal(c.writes[1].body.content, "original");
  assert.equal(c.writes[1].body.version, "v2");
  c.writes[1].finish({ ok: true, version: "v3" }); await c.settle();
  assert.equal(c.draft(), undefined);
});

test("a reload locks saving and closing until its disk response is applied", async () => {
  const c = client(); await c.open(); c.edit("local draft"); c.autosave();
  c.writes[0].finish({ ok: false, error: "permission denied" }); await c.settle();
  c.delayReads();
  c.find((node) => node.type === "button" && node.children[0] === "重新加载").props.onClick(); c.render();
  c.find((node) => node.type === "button" && node.children[0] === "确认丢弃并重新加载").props.onClick(); c.render();
  c.find((node) => node.type === "button" && node.children[0] === "保存").props.onClick();
  c.autosave(); c.close(); await c.settle();
  assert.equal(c.writes.length, 1);
  assert.equal(c.draft(), "local draft");
  c.reads[0].finish({ ok: true, content: "external content", version: "external-v2" }); await c.settle(); c.autosave();
  assert.equal(c.draft(), "external content");
  assert.equal(c.writes.length, 1);
});

test("typing during a reload cancels its stale response and retains the newer draft", async () => {
  const c = client(); await c.open(); c.edit("local draft"); c.autosave();
  c.writes[0].finish({ ok: false, error: "permission denied" }); await c.settle();
  c.delayReads();
  c.find((node) => node.type === "button" && node.children[0] === "重新加载").props.onClick(); c.render();
  c.find((node) => node.type === "button" && node.children[0] === "确认丢弃并重新加载").props.onClick();
  c.edit("newer draft"); c.autosave();
  assert.equal(c.writes.length, 1);
  c.reads[0].finish({ ok: true, content: "external", version: "v2" }); await c.settle();
  assert.equal(c.draft(), "newer draft"); c.autosave();
  assert.equal(c.writes[1].body.content, "newer draft");
  assert.equal(c.writes[1].body.version, "v1");
  c.writes[1].finish({ ok: false, code: "FS_STALE_VERSION", error: "external file changed" }); await c.settle();
  assert.equal(c.draft(), "newer draft");
});

test("conflicted drafts survive sidebar unmount and stay isolated between sessions", async () => {
  const c = client(); await c.open(); c.edit("retained session draft"); c.autosave();
  c.writes[0].finish({ ok: false, code: "FS_STALE_VERSION", error: "external file changed" }); await c.settle();
  c.unmount(); c.mount("other-session"); await c.open();
  assert.equal(c.draft(), "original");
  c.unmount(); c.mount("s"); await c.settle();
  assert.equal(c.draft(), "retained session draft");
  assert.ok(c.find((node) => node.props.role === "alert"));
  c.autosave(); assert.equal(c.writes.length, 1);
});

test("remounting while a write is pending shares its baseline and preserves a later failure", async () => {
  const c = client(); await c.open(); c.edit("first draft"); c.autosave();
  c.unmount(); c.mount(); c.edit("new draft"); c.autosave();
  assert.equal(c.writes.length, 1);
  c.writes[0].finish({ ok: true, version: "v2" }); await c.settle();
  assert.equal(c.draft(), "new draft");
  assert.equal(c.writes[1].body.content, "new draft");
  assert.equal(c.writes[1].body.version, "v2");
  c.unmount();
  c.writes[1].finish({ ok: false, error: "permission denied" }); await tick();
  c.mount(); await c.settle();
  assert.equal(c.draft(), "new draft");
  assert.ok(c.find((node) => node.props.role === "alert"));
});
