import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const tick = () => new Promise(setImmediate);
function client(options = {}) {
  let plugin; let FilesTab; let cursor = 0; let tree;
  let hooks = [];
  const effects = []; const timers = new Map(); const writes = []; const reads = [];
  const listeners = new Map(); const failures = new Map(Object.entries(options.failures ?? {})); const scripts = [];
  let inserted = 0;
  const composerRoot = { isContentEditable: true, contains: (target) => target === composerRoot };
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
    useMemo(callback) { return callback(); },
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
  const clientWindow = { __ModuleLoader__: { load(module) { plugin = module.factory(() => React); } },
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
  };
  vm.runInNewContext(readFileSync(new URL("../lib/client.js", import.meta.url), "utf8"), {
    window: clientWindow,
    document: { getElementById: () => ({}), createElement: () => ({ remove() { this.removed = true; } }), head: { appendChild: (el) => scripts.push(el) } }, URL, URLSearchParams, Map,
    fetch(url, init) {
      const action = init?.method === "POST" ? JSON.parse(init.body).action : new URL(url, "http://local").searchParams.get("action");
      if (failures.has(action)) {
        const failure = failures.get(action); failures.delete(action);
        return failure instanceof Error ? Promise.reject(failure) : Promise.resolve(failure);
      }
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
  plugin.apply({ conversation: { input: { shell: () => ({ editor: { getRootElement: () => composerRoot }, snapshot: { phase: "plain", draft: "", draftRev: 1 }, insertReference() { inserted++; return true; } }) } }, effect: (callback) => callback(), sidebarRightTabs: { register() {} }, slots: {
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
    writes, reads, render, find, scripts, composerRoot,
    fail(action, failure) { failures.set(action, failure); },
    focusPanel(target) { tree.props.ref.current = { contains: (value) => value === target }; },
    event(name, target, extras = {}) {
      const event = { key: "", target, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extras };
      for (const listener of listeners.get(name) ?? []) listener(event);
      return event;
    },
    inserted: () => inserted,
    listenerCount(name) { return listeners.get(name)?.size ?? 0; },
    drag() { find((node) => node.type?.name === "TreeNode").props.onDragNode({ type: "file", relative: "a.txt", name: "a.txt" }); },
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
    async monaco(load = true) {
      const CodeEditor = find((node) => node.type?.name === "CodeEditor").type;
      hooks.length = 0;
      let value = "original"; let changed;
      const edits = [];
      const disposal = { editor: 0, model: 0, listener: 0 };
      const editor = { getValue: () => value, setValue(next) { value = next; changed?.(); }, onDidChangeModelContent(callback) { changed = callback; return { dispose() { disposal.listener++; } }; }, dispose() { disposal.editor++; } };
      if (load) clientWindow.monaco = { editor: { create: () => editor, createModel: () => ({ dispose() { disposal.model++; } }) } };
      let input = "original";
      let editorTree;
      function renderEditor() {
        cursor = 0;
        editorTree = CodeEditor({ path: "/workspace/a.txt", value: input, onChange: (content) => edits.push(content) });
        hooks[0].current = {};
        while (effects.length) effects.shift()();
      }
      renderEditor(); await tick(); renderEditor();
      return { editor, edits, disposal, reload(content) { input = content; renderEditor(); }, tree: () => editorTree,
        async timeout() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); await tick(); renderEditor(); },
        unmount() { for (const hook of hooks) hook?.cleanup?.(); },
      };
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

test("Markdown links cannot inject attributes and code contents stay literal", async () => {
  const c = client();
  c.setDisk({ content: '[click](https://example.com/"onmouseover="window.PWN=1)\n`[code](https://example.com/)`\n<script>window.PWN=2</script>\n[x](javascript:alert)\n**safe**', version: "v1" });
  await c.open("/workspace/a.md");
  const preview = c.find((node) => node.type?.name === "MarkdownPreview");
  const html = preview.type(preview.props).props.dangerouslySetInnerHTML.__html;
  assert.ok(html.includes('<a href="https://example.com/&quot;onmouseover=&quot;window.PWN=1" rel="noopener noreferrer">click</a>'));
  assert.ok(html.includes('<code>[code](https://example.com/)</code>'));
  assert.ok(html.includes('&lt;script&gt;window.PWN=2&lt;/script&gt;'));
  assert.ok(html.includes('[x](javascript:alert)'));
  assert.ok(html.includes('<strong>safe</strong>'));
  assert.equal((html.match(/<a /g) ?? []).length, 1);
});

test("file shortcuts respect focus and leave plain-text paste unchanged", async () => {
  const c = client(); await c.open("/workspace/a.md");
  const panelTarget = {}; c.focusPanel(panelTarget);
  assert.equal(c.event("keydown", {}, { key: "m", ctrlKey: true, altKey: true }).defaultPrevented, false);
  assert.ok(c.find((node) => node.type?.name === "MarkdownPreview"));
  assert.equal(c.event("keydown", panelTarget, { key: "V", metaKey: true, shiftKey: true }).defaultPrevented, false);
  assert.ok(c.find((node) => node.type?.name === "MarkdownPreview"));
  assert.equal(c.event("keydown", panelTarget, { key: "m", ctrlKey: true, altKey: true }).defaultPrevented, true);
  c.render(); assert.ok(c.find((node) => node.type?.name === "CodeEditor"));
  c.edit("draft"); c.focusPanel(panelTarget);
  assert.equal(c.event("keydown", {}, { key: "s", ctrlKey: true }).defaultPrevented, false);
  assert.equal(c.writes.length, 0);
  assert.equal(c.event("keydown", panelTarget, { key: "s", ctrlKey: true, isComposing: true }).defaultPrevented, false);
  assert.equal(c.event("keydown", panelTarget, { key: "s", ctrlKey: true }).defaultPrevented, true);
  assert.equal(c.writes.length, 1);
  c.writes[0].finish({ ok: true, version: "v2" }); await c.settle();
});

test("file drag only inserts into its own mounted editable composer", async () => {
  const c = client(); await c.open(); c.drag();
  assert.equal(c.event("dragover", {}).defaultPrevented, false);
  assert.equal(c.event("drop", {}).defaultPrevented, false);
  assert.equal(c.inserted(), 0);
  c.composerRoot.isContentEditable = false;
  assert.equal(c.event("drop", c.composerRoot).defaultPrevented, false);
  c.composerRoot.isContentEditable = true;
  assert.equal(c.event("drop", c.composerRoot, { defaultPrevented: true }).stopped, false);
  assert.equal(c.inserted(), 0);
  assert.equal(c.event("dragover", c.composerRoot).defaultPrevented, true);
  assert.equal(c.event("drop", c.composerRoot).stopped, true);
  assert.equal(c.inserted(), 1);
  assert.equal(c.event("drop", c.composerRoot).defaultPrevented, false);
});

test("network failures leave visible errors and retries load the requested resource", async () => {
  const c = client({ failures: { list: new Error("network offline") } }); await c.settle();
  assert.match(c.find((node) => node.props.role === "alert").children[0], /network offline/);
  assert.equal(c.find((node) => node.type === "div" && node.children[0] === "加载目录…"), null);
  c.find((node) => node.type === "button" && node.children[0] === "重试").props.onClick(); await c.settle();
  assert.ok(c.find((node) => node.type?.name === "TreeNode"));
  c.fail("read", new Error("file read offline")); await c.open();
  assert.match(c.find((node) => node.props.role === "alert").children[0], /file read offline/);
  assert.equal(c.draft(), undefined);
  c.find((node) => node.type === "button" && node.children[0] === "重试").props.onClick(); await c.settle();
  assert.equal(c.draft(), "original");
});

test("HTTP and invalid JSON responses cannot masquerade as successful file loads", async () => {
  const c = client(); await c.settle();
  c.fail("read", { ok: false, status: 503, json: async () => ({ ok: true, content: "wrong", path: "/workspace/a.txt", version: "v2" }) });
  await c.open();
  assert.match(c.find((node) => node.props.role === "alert").children[0], /HTTP 503/);
  assert.equal(c.draft(), undefined);
  c.fail("read", { ok: false, status: 502, json: async () => { throw new SyntaxError("HTML response"); } });
  await c.open();
  assert.match(c.find((node) => node.props.role === "alert").children[0], /无效响应.*HTTP 502/);
  c.find((node) => node.type === "button" && node.children[0] === "重试").props.onClick(); await c.settle();
  assert.equal(c.draft(), "original");
});

test("Monaco unmount disposes its owned model and subscription", async () => {
  const c = client(); await c.open(); const m = await c.monaco(); m.unmount();
  assert.deepEqual(m.disposal, { editor: 1, model: 1, listener: 1 });
});

test("stalled Monaco mirrors time out into an editable fallback and clean late callbacks", async () => {
  const c = client(); await c.open(); const m = await c.monaco(false);
  const staleLoad = c.scripts[0].onload;
  await m.timeout(); await m.timeout(); await m.timeout();
  assert.equal(c.scripts.length, 3);
  assert.ok(c.scripts.every((script) => script.removed && script.onload === null && script.onerror === null));
  staleLoad();
  assert.ok(m.tree().children.some((node) => node.type?.name === "LinedTextarea"));
  assert.ok(m.tree().children.some((node) => node.props.role === "status"));
});

test("special entries are inert and POSIX backslashes remain in filenames and references", async () => {
  const c = client(); await c.open("/workspace/name\\part.txt");
  assert.ok(c.find((node) => node.props.className?.includes("dshf-tabname")).children.includes("name\\part.txt"));
  const tree = c.find((node) => node.type?.name === "TreeNode");
  const special = tree.type({ ...tree.props, node: { type: "symlink", name: "link", path: "/workspace/link" } });
  assert.equal(special.props.disabled, true); assert.equal(special.props.draggable, false); assert.equal(special.props.onClick, undefined);
  const regular = tree.type({ ...tree.props, node: { type: "file", name: "name\\part.txt", path: "/workspace/name\\part.txt", relative: "name\\part.txt" } });
  let mention;
  regular.props.onDragStart({ dataTransfer: { setData(_type, value) { mention = value; } } });
  assert.equal(mention, '@name\\part.txt');
  const unsupported = tree.type({ ...tree.props, node: { type: "file", name: 'quote".txt', path: '/workspace/quote".txt', relative: 'quote".txt' } });
  assert.equal(unsupported.props.draggable, false);
  tree.props.onMenu(0, 0, { type: "file", name: 'quote".txt', path: '/workspace/quote".txt', relative: 'quote".txt' }); c.render();
  c.find((node) => node.type?.name === "ContextMenu").props.items.find((item) => item.id === "add").onSelect(); c.render();
  assert.equal(c.inserted(), 0);
  assert.ok(c.find((node) => node.type === "div" && typeof node.children[0] === "string" && node.children[0].includes("DSH 引用不支持")));
  const truncated = tree.type({ ...tree.props, node: { ...tree.props.node, truncated: true } });
  assert.ok(truncated.children.some((node) => node?.props?.role === "status"));
});

test("malformed successful saves retain the dirty draft and its previous baseline", async () => {
  for (const version of [undefined, "", 42, {}]) {
    const c = client(); await c.open(); c.edit("local draft"); c.close();
    c.writes[0].finish({ ok: true, version }); await c.settle();
    assert.equal(c.draft(), "local draft");
    assert.match(c.find((node) => node.props.role === "alert").children[0], /版本/);
    assert.equal(c.find((node) => node.type === "button" && node.children[0] === "保存").props.disabled, false);
    c.find((node) => node.type === "button" && node.children[0] === "保存").props.onClick();
    assert.equal(c.writes[1].body.version, "v1");
    c.writes[1].finish({ ok: true, version: "v2" }); await c.settle();
    assert.equal(c.draft(), "local draft");
    assert.equal(c.find((node) => node.type === "button" && node.children[0] === "保存").props.disabled, true);
  }
});

test("malformed reload successes preserve conflicted content and unlock reload for retry", async () => {
  for (const response of [
    { ok: true, version: "v2" },
    { ok: true, content: 42, version: "v2" },
    { ok: true, content: "external" },
    { ok: true, content: "external", version: {} },
    { ok: false, error: "external file cannot be read" },
    new Error("network disconnected"),
  ]) {
    const c = client(); await c.open(); c.edit("retained conflict draft"); c.autosave();
    c.writes[0].finish({ ok: false, code: "FS_STALE_VERSION", error: "external file changed" }); await c.settle();
    c.fail("read", response instanceof Error ? response : { ok: true, status: 200, json: async () => response });
    c.find((node) => node.type === "button" && node.children[0] === "重新加载").props.onClick(); c.render();
    c.find((node) => node.type === "button" && node.children[0] === "确认丢弃并重新加载").props.onClick(); await c.settle();
    assert.equal(c.draft(), "retained conflict draft");
    assert.match(c.find((node) => node.props.role === "alert").children[0], /重新加载失败，本地内容仍保留/);
    assert.equal(c.find((node) => node.type === "button" && node.children[0] === "保存").props.disabled, true);
    assert.equal(c.find((node) => node.type === "button" && node.children[0] === "重新加载").props.disabled, false);
    c.autosave(); c.close(); await c.settle(); assert.equal(c.writes.length, 1);
    c.setDisk({ content: "verified external content", version: "external-v2" });
    c.find((node) => node.type === "button" && node.children[0] === "确认丢弃并重新加载").props.onClick(); await c.settle();
    assert.equal(c.draft(), "verified external content");
    c.edit("merged"); c.autosave(); assert.equal(c.writes[1].body.version, "external-v2");
    c.writes[1].finish({ ok: true, version: "v3" }); await c.settle();
  }
});

test("invalid JSON envelopes and non-string file metadata never open a file", async () => {
  const c = client(); await c.settle();
  for (const body of [null, [], "ok", { ok: "true", content: "bad", path: "/workspace/a.txt", version: "v1" },
    { ok: true, content: "bad", path: {}, version: "v1" }, { ok: true, content: "bad", path: "/workspace/a.txt", version: {} }]) {
    c.fail("read", { ok: true, status: 200, json: async () => body }); await c.open();
    assert.equal(c.draft(), undefined);
    assert.ok(c.find((node) => node.props.role === "alert"));
  }
  c.find((node) => node.type === "button" && node.children[0] === "重试").props.onClick(); await c.settle();
  assert.equal(c.draft(), "original");
});

test("sidebar unmount removes owned global listeners and remount does not duplicate them", async () => {
  const c = client(); await c.open(); c.drag();
  for (const name of ["keydown", "dragover", "drop", "dragend"]) assert.equal(c.listenerCount(name), 1);
  c.unmount();
  for (const name of ["keydown", "dragover", "drop", "dragend"]) assert.equal(c.listenerCount(name), 0);
  assert.equal(c.event("drop", c.composerRoot).defaultPrevented, false);
  assert.equal(c.inserted(), 0);
  c.mount(); await c.settle();
  for (const name of ["keydown", "dragover", "drop", "dragend"]) assert.equal(c.listenerCount(name), 1);
});
