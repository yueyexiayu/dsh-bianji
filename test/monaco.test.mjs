import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { mkdtemp, mkdir, writeFile, symlink, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { apply } from "../lib/index.js";
import { handleMonacoRequest, MONACO_ROUTE, MONACO_VS_DIR } from "../lib/monaco.js";

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "bianji-monaco-"));
  const vs = path.join(root, "vs");
  await mkdir(path.join(vs, "nested"), { recursive: true });
  await writeFile(path.join(vs, "loader.js"), "local-loader-bytes");
  await writeFile(path.join(vs, "nested", "outside.txt"), "secret");
  await symlink("/etc/passwd", path.join(vs, "escape.js"));
  await symlink(path.join(vs, "loader.js"), path.join(vs, "alias.js"));
  await symlink(path.join(vs, "nested"), path.join(vs, "linked-dir"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return vs;
}

function request(file, vsDir) {
  return handleMonacoRequest(new Request(`http://local${MONACO_ROUTE}?file=${encodeURIComponent(file)}`), vsDir);
}

test("monaco route rejects traversal, absolute paths, and symlinks", async (t) => {
  const vs = await fixture(t);
  const cases = [
    "../loader.js",
    "vs/../loader.js",
    "vs/../../etc/passwd",
    "/etc/passwd",
    "C:/Windows/system.ini",
    "vs\\loader.js",
    "vs/loader.js\0.txt",
    "vs/escape.js",
    "vs/alias.js",
    "vs/linked-dir/outside.txt",
  ];
  for (const file of cases) {
    const response = await request(file, vs);
    assert.equal(response.status, 400, file);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
});

test("monaco route serves the local loader and not a symlink target", async (t) => {
  const vs = await fixture(t);
  const response = await request("vs/loader.js", vs);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(await response.text(), "local-loader-bytes");
});

test("vendored loader.js is served from the plugin route", async () => {
  const local = await readFile(path.join(MONACO_VS_DIR, "loader.js"));
  const response = await handleMonacoRequest(new Request(`http://local${MONACO_ROUTE}?file=vs/loader.js`));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(Buffer.compare(Buffer.from(await response.arrayBuffer()), local), 0);
});

test("extensionless module ids map to the local javascript file", async () => {
  const local = await readFile(path.join(MONACO_VS_DIR, "editor", "editor.main.js"));
  const response = await handleMonacoRequest(new Request(`http://local${MONACO_ROUTE}?file=vs/editor/editor.main`));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
  assert.equal(Buffer.compare(Buffer.from(await response.arrayBuffer()), local), 0);
});

test("codicon font is the local file with a font content type", async () => {
  const relative = "base/browser/ui/codicons/codicon/codicon.ttf";
  const local = await readFile(path.join(MONACO_VS_DIR, relative));
  const response = await handleMonacoRequest(new Request(`http://local${MONACO_ROUTE}?file=vs/${relative}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "font/ttf");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(Buffer.compare(Buffer.from(await response.arrayBuffer()), local), 0);
});

test("query-string loader base does not append .js", async () => {
  const loaderSrc = await readFile(path.join(MONACO_VS_DIR, "loader.js"), "utf8");
  const requested = [];
  const document = {
    createElement() {
      return {
        attrs: {},
        setAttribute(name, value) { this.attrs[name] = value; },
        getAttribute(name) { return this.attrs[name]; },
        addEventListener() {},
        removeEventListener() {},
      };
    },
    getElementsByTagName() {
      return [{ appendChild(el) { requested.push(el.attrs.src); } }];
    },
  };
  const context = { console, setTimeout, clearTimeout, document, navigator: { userAgent: "Mozilla/5.0" } };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(loaderSrc, context, { filename: "loader.js" });
  context.require.config({ paths: { vs: "/api/bianji/monaco?file=vs" } });
  context.require(["vs/editor/editor.main"], () => {}, () => {});
  assert.deepEqual(requested, ["/api/bianji/monaco?file=vs/editor/editor.main"]);
});

test("editor css stays same-origin and declares its type", async () => {
  const response = await handleMonacoRequest(new Request(`http://local${MONACO_ROUTE}?file=vs/editor/editor.main.css`));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/css/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const css = await response.text();
  assert.match(css, /\/api\/bianji\/monaco\?file=vs\/base\/browser\/ui\/codicons\/codicon\/codicon\.ttf/);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:/i);
});

test("client source no longer loads Monaco from a public CDN", async () => {
  const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
  assert.equal(source.includes("cdn.jsdelivr.net"), false);
  assert.equal(source.includes("unpkg.com"), false);
  assert.equal(source.includes("fastly.jsdelivr.net"), false);
  assert.equal(source.includes("MONACO_MIRRORS"), false);
  assert.match(source, /\/api\/bianji\/monaco\?file=vs/);
  assert.match(source, /setMode\("textarea"\)/);
});

test("monaco route is registered separately from the file API", () => {
  const routes = [];
  apply({ connection: { fetch: { register(value) { routes.push(value); } } } });
  assert.deepEqual(routes.map((route) => route.path).sort(), ["/api/bianji", "/api/bianji/monaco"]);
  assert.deepEqual(routes.find((route) => route.path === MONACO_ROUTE).methods, ["GET"]);
});
