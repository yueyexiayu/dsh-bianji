import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { apply } from "../lib/index.js";
import { fileKind } from "../lib/parse.js";
import { officePreview, zipRead } from "../lib/preview.js";

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, "utf8");
    const compressed = deflateRawSync(data);
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    nameBuf.copy(local, 30);
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    locals.push(Buffer.concat([local, compressed]));
    centrals.push(central);
    offset += local.length + compressed.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(centrals.length, 8);
  eocd.writeUInt16LE(centrals.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

async function host(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "bianji-preview-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const png = path.join(root, "pic.png");
  await fs.writeFile(png, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]));
  const pdf = path.join(root, "doc.pdf");
  await fs.writeFile(pdf, Buffer.from("%PDF-1.4\n% preview\n"));
  const docx = path.join(root, "note.docx");
  await fs.writeFile(docx, zipStore({ "word/document.xml": "<w:p><w:r><w:t>你好文档</w:t></w:r></w:p>" }));
  const pptx = path.join(root, "deck.pptx");
  await fs.writeFile(pptx, zipStore({ "ppt/slides/slide1.xml": "<a:t>封面标题</a:t>" }));
  const xlsx = path.join(root, "sheet.xlsx");
  await fs.writeFile(xlsx, zipStore({
    "xl/sharedStrings.xml": "<si><t>Alpha</t></si>",
    "xl/workbook.xml": "<sheet name=\"数据\"/>",
    "xl/worksheets/sheet1.xml": '<c r="A1" t="s"><v>0</v></c><c r="B1"><v>7</v></c>',
  }));
  const service = {
    async resolve(file) { return { targetKey: await fs.realpath(file), displayPath: file }; },
    processPath(target) { return target.targetKey; },
    async stat(target) {
      const st = await fs.stat(target.targetKey);
      const content = st.isFile() ? await fs.readFile(target.targetKey) : Buffer.alloc(0);
      return { type: st.isFile() ? "file" : "directory", size: st.size, version: "v1:" + content.length };
    },
    async readBytes(target) { return fs.readFile(target.targetKey); },
    async writeText() { throw new Error("preview must not write"); },
  };
  const agent = { session: { header: { cwd: root } }, ctx: { get: (name) => name === "fs" ? service : name === "sandboxPolicy" ? { resolve: () => ({ mode: "workspace-write", workspaceRoot: root }) } : undefined } };
  let route;
  apply({ connection: { fetch: { register(value) { if (value.path === "/api/bianji") route = value; } } }, get: (name) => name === "agents" ? { get: () => agent } : undefined });
  async function call(action, filePath, extra = {}) {
    const method = extra.method || "GET";
    const req = method === "GET"
      ? new Request("http://local/api/bianji?" + new URLSearchParams({ action, sessionId: "s", path: filePath }), extra.headers ? { headers: extra.headers } : undefined)
      : new Request("http://local/api/bianji", { method, body: JSON.stringify({ action, sessionId: "s", path: filePath, ...extra.body }) });
    const response = await route.fetch(req);
    const type = response.headers.get("content-type") || "";
    const body = type.includes("json") ? await response.json() : Buffer.from(await response.arrayBuffer());
    return { status: response.status, type, body, headers: response.headers };
  }
  return { root, png, pdf, docx, pptx, xlsx, call };
}

test("fileKind classifies previewable types without treating them as editable text", () => {
  assert.equal(fileKind("a.png"), "image");
  assert.equal(fileKind("a.pdf"), "pdf");
  assert.equal(fileKind("a.docx"), "docx");
  assert.equal(fileKind("a.doc"), "unsupported");
  assert.equal(fileKind("a.ts"), "text");
});

test("zipRead extracts named deflated entries", () => {
  const buffer = zipStore({ "word/document.xml": "<w:t>ok</w:t>" });
  const files = zipRead(buffer, ["word/document.xml"]);
  assert.equal(files.get("word/document.xml").toString("utf8"), "<w:t>ok</w:t>");
});

test("officePreview extracts glance text from docx pptx xlsx", () => {
  assert.match(officePreview("docx", zipStore({ "word/document.xml": "<w:p><w:t>段落一</w:t></w:p>" })).text, /段落一/);
  assert.match(officePreview("pptx", zipStore({ "ppt/slides/slide1.xml": "<a:t>幻灯</a:t>" })).slides[0].lines[0], /幻灯/);
  const table = officePreview("xlsx", zipStore({
    "xl/sharedStrings.xml": "<si><t>Name</t></si>",
    "xl/workbook.xml": "<sheet name=\"A\"/>",
    "xl/worksheets/sheet1.xml": '<c r="A1" t="s"><v>0</v></c>',
  }));
  assert.equal(table.rows[0][0], "Name");
});

test("open returns media metadata without file bytes", async (t) => {
  const h = await host(t);
  const opened = await h.call("open", h.png);
  assert.equal(opened.status, 200);
  assert.equal(opened.body.kind, "image");
  assert.equal(opened.body.media, true);
  assert.equal(opened.body.content, undefined);
});

test("media serves image bytes and rejects path escape", async (t) => {
  const h = await host(t);
  const media = await h.call("media", h.png);
  assert.equal(media.status, 200);
  assert.match(media.type, /image\/png/);
  assert.equal(media.headers.get("x-content-type-options"), "nosniff");
  assert.equal(media.body[0], 0x89);
  const outsideDir = await fs.mkdtemp(path.join(tmpdir(), "bianji-preview-out-"));
  t.after(() => fs.rm(outsideDir, { recursive: true, force: true }));
  const outside = path.join(outsideDir, "secret.png");
  await fs.writeFile(outside, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const escaped = await h.call("media", outside);
  assert.equal(escaped.status, 400);
  assert.equal(escaped.body.ok, false);
});

test("pdf and office open as read-only previews", async (t) => {
  const h = await host(t);
  const pdf = await h.call("open", h.pdf);
  assert.equal(pdf.body.kind, "pdf");
  assert.equal(pdf.body.media, true);
  const docx = await h.call("open", h.docx);
  assert.equal(docx.body.kind, "docx");
  assert.match(docx.body.preview.text, /你好文档/);
  const pptx = await h.call("open", h.pptx);
  assert.equal(pptx.body.kind, "pptx");
  assert.equal(pptx.body.preview.slides[0].lines[0], "封面标题");
  const xlsx = await h.call("open", h.xlsx);
  assert.equal(xlsx.body.kind, "xlsx");
  assert.equal(xlsx.body.preview.rows[0][0], "Alpha");
});

test("text write path still refuses png", async (t) => {
  const h = await host(t);
  const written = await h.call("write", h.png, { method: "POST", body: { content: "not an image", version: "v1" } });
  assert.equal(written.status, 400);
});
