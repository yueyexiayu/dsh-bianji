import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

async function isolatedBrowser(t) {
  let chromium;
  try {
    ({ chromium } = await import(process.env.BIANJI_PLAYWRIGHT_MODULE || "playwright"));
  } catch (error) {
    if (process.env.BIANJI_PLAYWRIGHT_MODULE) throw error;
    t.skip("Playwright is not installed; set BIANJI_PLAYWRIGHT_MODULE to an existing local installation");
    return null;
  }
  return chromium.launch({
    headless: true,
    ...(process.env.BIANJI_CHROMIUM_EXECUTABLE ? { executablePath: process.env.BIANJI_CHROMIUM_EXECUTABLE } : {}),
  });
}

function reactScripts(t) {
  const require = createRequire(import.meta.url);
  try {
    return [
      process.env.BIANJI_REACT_UMD || join(dirname(require.resolve("react/package.json")), "umd/react.development.js"),
      process.env.BIANJI_REACT_DOM_UMD || join(dirname(require.resolve("react-dom/package.json")), "umd/react-dom.development.js"),
    ].map((path) => ({ content: readFileSync(path, "utf8") }));
  } catch (error) {
    if (process.env.BIANJI_REACT_UMD || process.env.BIANJI_REACT_DOM_UMD) throw error;
    t.skip("React 18 UMD files are not installed; set BIANJI_REACT_UMD and BIANJI_REACT_DOM_UMD to existing local files");
    return null;
  }
}

// No desktop/Chrome connection: Playwright launches an isolated headless profile.
// Optional local dependencies can be selected without adding a package dependency:
// BIANJI_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs
// BIANJI_CHROMIUM_EXECUTABLE=/absolute/path/to/browser

test("Markdown injection stays inert in a real browser DOM", async (t) => {
  const browser = await isolatedBrowser(t);
  if (!browser) return;
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent('<!doctype html><main id="preview"></main>');
    await page.evaluate(() => {
      window.__ModuleLoader__ = { load(spec) { window.__bianji = spec.factory(() => ({})); } };
      window.__pwned = 0;
    });
    const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
    const exportMarker = "    exports.apply = apply;";
    assert.equal(source.split(exportMarker).length, 2);
    // Expose the existing renderer in this isolated page only, not in production.
    await page.addScriptTag({ content: source.replace(exportMarker, "    exports.renderMarkdownForTest = renderMarkdown;\n" + exportMarker) });
    const attacks = [
      '<img src=x onerror="window.__pwned=1">',
      '<svg onload="window.__pwned=1"><script>window.__pwned=1</script></svg>',
      '[link](https://example.test/"onmouseover="window.__pwned=1)',
      "[link](https://example.test/'onclick='window.__pwned=1)",
      '[link](https://example.test/&quot;onfocus=&quot;window.__pwned=1)',
      '[<img src=x onerror="window.__pwned=1">](https://example.test/)',
      '[link](javascript:window.__pwned=1)',
      '[link](data:text/html,<svg/onload=window.__pwned=1>)',
      '**<img src=x onerror="window.__pwned=1">**',
      '- <img src=x onerror="window.__pwned=1">',
      '# <img src=x onerror="window.__pwned=1">',
      '> <img src=x onerror="window.__pwned=1">',
      '`[literal](https://example.test/) <img src=x onerror="window.__pwned=1">`',
      '```html"onmouseover="window.__pwned=1\n<img src=x onerror="window.__pwned=1">\n```',
    ];
    for (const markdown of attacks) {
      const result = await page.evaluate((markdown) => {
        const preview = document.getElementById("preview");
        preview.innerHTML = window.__bianji.renderMarkdownForTest(markdown);
        const elements = [...preview.querySelectorAll("*")];
        for (const element of elements) {
          for (const type of ["error", "load", "mouseover", "click", "focus"]) element.dispatchEvent(new Event(type));
        }
        return {
          pwned: window.__pwned,
          dangerousTags: preview.querySelectorAll("script,img,svg,iframe,object,embed,style").length,
          eventAttributes: elements.flatMap((element) => [...element.attributes]).filter((attribute) => /^on/i.test(attribute.name)).length,
          links: [...preview.querySelectorAll("a")].map((link) => ({ protocol: new URL(link.href).protocol, attributes: [...link.attributes].map((attribute) => attribute.name), rel: link.rel })),
          codeLinks: preview.querySelectorAll("code a").length,
        };
      }, markdown);
      assert.equal(result.pwned, 0, markdown);
      assert.equal(result.dangerousTags, 0, markdown);
      assert.equal(result.eventAttributes, 0, markdown);
      assert.equal(result.codeLinks, 0, markdown);
      for (const link of result.links) {
        assert.ok(["http:", "https:"].includes(link.protocol), markdown);
        assert.deepEqual(link.attributes.sort(), ["href", "rel"], markdown);
        assert.equal(link.rel, "noopener noreferrer", markdown);
      }
    }
    const valid = await page.evaluate(() => {
      const preview = document.getElementById("preview");
      preview.innerHTML = window.__bianji.renderMarkdownForTest('[safe](https://example.test/a?q="quoted"&x=1) **bold** `*literal*`');
      return { href: preview.querySelector("a").getAttribute("href"), bold: preview.querySelector("strong").textContent, code: preview.querySelector("code").textContent };
    });
    assert.deepEqual(valid, { href: 'https://example.test/a?q="quoted"&x=1', bold: "bold", code: "*literal*" });
  } finally {
    await browser.close();
  }
});

test("real React DOM scopes shortcuts and drops, retries errors, and cleans up on unmount", async (t) => {
  const scripts = reactScripts(t);
  if (!scripts) return;
  const browser = await isolatedBrowser(t);
  if (!browser) return;
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => route.abort());
    await page.setContent('<!doctype html><div id="mount"></div><textarea id="outside"></textarea><div id="other-composer" contenteditable="true"></div><div id="composer" contenteditable="true"></div>');
    for (const script of scripts) await page.addScriptTag(script);
    await page.evaluate(() => {
      const state = window.__state = {
        failures: new Map([["list", new Error("directory offline")]]),
        requests: [], pendingWrites: [], references: [], listeners: new Map(),
        disk: { content: "original", version: "v1" },
      };
      const add = window.addEventListener.bind(window);
      const remove = window.removeEventListener.bind(window);
      window.addEventListener = (name, callback, options) => {
        if (["keydown", "dragover", "drop", "dragend"].includes(name)) {
          if (!state.listeners.has(name)) state.listeners.set(name, new Set());
          state.listeners.get(name).add(callback);
        }
        add(name, callback, options);
      };
      window.removeEventListener = (name, callback, options) => { state.listeners.get(name)?.delete(callback); remove(name, callback, options); };
      // Hold autosave timers so each boundary is tested without a timing race.
      const timeout = window.setTimeout.bind(window);
      const clear = window.clearTimeout.bind(window);
      let timerId = -1;
      window.setTimeout = (callback, delay, ...args) => delay === 450 ? timerId-- : timeout(callback, delay, ...args);
      window.clearTimeout = (id) => { if (id >= 0) clear(id); };
      const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      window.fetch = async (url, init) => {
        const params = new URL(url, "http://test.local").searchParams;
        const request = init?.method === "POST" ? JSON.parse(init.body) : Object.fromEntries(params);
        state.requests.push(request);
        if (state.failures.has(request.action)) {
          const failure = state.failures.get(request.action); state.failures.delete(request.action);
          if (failure instanceof Error) throw failure;
          if (failure.invalidJSON) return new Response("{broken", { status: 200 });
          return response(failure.body, failure.status);
        }
        if (request.action === "write") return new Promise((resolve) => state.pendingWrites.push({ request, finish: (body) => resolve(response(body)) }));
        if (request.action === "read") return response({ ok: true, path: request.path, relative: "a.txt", ...state.disk });
        return response({ ok: true, root: "/workspace", entries: [{ name: "a.txt", type: "file", path: "/workspace/a.txt", relative: "a.txt" }] });
      };
      window.__ModuleLoader__ = { load(spec) { window.__plugin = spec.factory((name) => { if (name === "react") return window.React; throw new Error(name); }); } };
    });
    await page.addScriptTag({ content: readFileSync(new URL("../lib/client.js", import.meta.url), "utf8") });
    await page.evaluate(() => {
      let FilesTab;
      const shell = { editor: { getRootElement: () => document.getElementById("composer") }, snapshot: { phase: "plain", draft: "", draftRev: 1 }, insertReference(reference) { window.__state.references.push(reference); return true; } };
      const services = { conversation: { input: { shell: () => shell } } };
      const ctx = {
        get(name) { return services[name]; },
        effect(callback) { return callback(); },
        sidebarRightTabs: { register() { return () => {}; } },
        slots: { inject(_name, callback) { return callback(); }, register(slot, component) { if (slot.name === "sidebar.right.pane.tab") FilesTab = component; return () => {}; } },
      };
      window.__plugin.apply(ctx);
      window.__mount = () => { window.__root = ReactDOM.createRoot(document.getElementById("mount")); window.__root.render(React.createElement(FilesTab, { sessionId: "dom-session" })); };
      window.__unmount = () => window.__root.unmount();
      window.__mount();
    });
    await page.getByRole("alert").filter({ hasText: "directory offline" }).waitFor();
    await page.getByRole("button", { name: "重试", exact: true }).click();
    const file = page.locator('.dshf-node').filter({ hasText: "a.txt" });
    await file.waitFor();
    await page.evaluate(() => window.__state.failures.set("read", { status: 503, body: { ok: true, content: "must not open", path: "/workspace/a.txt", version: "bad" } }));
    await file.click();
    await page.getByRole("alert").filter({ hasText: "HTTP 503" }).waitFor();
    assert.equal(await page.locator(".dshf-textarea").count(), 0);
    await page.getByRole("button", { name: "重试", exact: true }).click();
    const editor = page.locator(".dshf-textarea");
    await editor.waitFor();
    assert.equal(await editor.inputValue(), "original");
    const key = (selector, overrides = {}) => page.evaluate(({ selector, overrides }) => {
      const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ctrlKey: true, key: "s", ...overrides });
      document.querySelector(selector).dispatchEvent(event);
      return event.defaultPrevented;
    }, { selector, overrides });
    await editor.fill("local draft");
    assert.equal(await key("#outside"), false);
    assert.equal(await key(".dshf-textarea", { isComposing: true }), false);
    assert.equal(await key(".dshf-textarea", { altKey: true, key: "m" }), false);
    assert.equal(await page.evaluate(() => window.__state.pendingWrites.length), 0);
    const pastePrevented = await page.evaluate(() => {
      const data = new DataTransfer(); data.setData("text/plain", "ordinary text");
      const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data });
      document.querySelector(".dshf-textarea").dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(pastePrevented, false);
    await editor.focus();
    await page.keyboard.press("Control+s");
    await page.waitForFunction(() => window.__state.pendingWrites.length === 1);
    await page.evaluate(() => window.__state.pendingWrites[0].finish({ ok: true }));
    await page.getByRole("alert").filter({ hasText: "缺少有效版本" }).waitFor();
    assert.equal(await editor.inputValue(), "local draft");
    assert.equal(await page.getByRole("button", { name: "保存", exact: true }).isEnabled(), true);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForFunction(() => window.__state.pendingWrites.length === 2);
    assert.equal(await page.evaluate(() => window.__state.pendingWrites[1].request.version), "v1");
    await page.evaluate(() => window.__state.pendingWrites[1].finish({ ok: false, code: "FS_STALE_VERSION", error: "disk conflict" }));
    await page.getByRole("alert").filter({ hasText: "disk conflict" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "保存", exact: true }).isEnabled(), false);
    await page.getByRole("button", { name: "重新加载", exact: true }).click();
    await page.evaluate(() => window.__state.failures.set("read", { invalidJSON: true }));
    await page.getByRole("button", { name: "确认丢弃并重新加载", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "重新加载失败，本地内容仍保留" }).waitFor();
    assert.equal(await editor.inputValue(), "local draft");
    assert.equal(await page.getByRole("button", { name: "保存", exact: true }).isEnabled(), false);
    await page.evaluate(() => { window.__state.disk = { content: "external verified", version: "v2" }; });
    await page.getByRole("button", { name: "确认丢弃并重新加载", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".dshf-textarea")?.value === "external verified");
    assert.equal(await page.getByRole("alert").count(), 0);
    const drag = (selector, begin = false) => page.evaluate(({ selector, begin }) => {
      const data = new DataTransfer();
      if (begin) document.querySelector('.dshf-node[draggable="true"]').dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
      const event = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data });
      document.querySelector(selector).dispatchEvent(event);
      return event.defaultPrevented;
    }, { selector, begin });
    assert.equal(await drag("#other-composer", true), false);
    assert.equal(await drag("#composer"), true);
    assert.equal(await page.evaluate(() => window.__state.references.length), 1);
    assert.equal(await drag("#composer"), false);
    const counts = () => page.evaluate(() => ["keydown", "dragover", "drop", "dragend"].map((name) => window.__state.listeners.get(name)?.size ?? 0));
    assert.deepEqual(await counts(), [1, 1, 1, 1]);
    await editor.fill("retained across unmount");
    assert.equal(await key(".dshf-textarea"), true);
    await page.waitForFunction(() => window.__state.pendingWrites.length === 3);
    await page.evaluate(() => window.__unmount());
    assert.deepEqual(await counts(), [0, 0, 0, 0]);
    assert.equal(await key("#outside"), false);
    assert.equal(await drag("#composer"), false);
    await page.evaluate(() => { window.__state.pendingWrites[2].finish({ ok: false, error: "pending write failed after unmount" }); window.__mount(); });
    await page.getByRole("alert").filter({ hasText: "pending write failed after unmount" }).waitFor();
    assert.equal(await editor.inputValue(), "retained across unmount");
    assert.deepEqual(await counts(), [1, 1, 1, 1]);
    assert.equal(await page.evaluate(() => window.__state.references.length), 1);
    await page.evaluate(() => window.__unmount());
    assert.deepEqual(await counts(), [0, 0, 0, 0]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
