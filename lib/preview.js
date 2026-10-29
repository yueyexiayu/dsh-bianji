/** Read-only workspace previews. Never used for text saves. */

import { inflateRawSync } from "node:zlib";
import { extensionOf, fileKind, mediaContentType, PREVIEW_LIMITS } from "./parse.js";

const TEXT_CAP = 80_000;
const OFFICE_XML_CAP = 4_000_000;
const MAX_SLIDES = 12;
const MAX_SHEET_ROWS = 24;
const MAX_SHEET_COLS = 10;

function fail(message, code = "PREVIEW_UNSUPPORTED", status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function u16(buffer, offset) {
  if (offset + 2 > buffer.length) throw fail("truncated zip", "PREVIEW_UNSUPPORTED");
  return buffer.readUInt16LE(offset);
}

function u32(buffer, offset) {
  if (offset + 4 > buffer.length) throw fail("truncated zip", "PREVIEW_UNSUPPORTED");
  return buffer.readUInt32LE(offset);
}

function decodeXml(buffer) {
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function taggedTexts(xml, localName) {
  const pattern = new RegExp(`<(?:[A-Za-z0-9]+:)?${localName}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${localName}>`, "g");
  const out = [];
  let match;
  while ((match = pattern.exec(xml))) {
    out.push(decodeEntities(match[1].replace(/<[^>]+>/g, "")));
  }
  return out;
}

export function zipRead(buffer, names) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw fail("not a zip archive", "PREVIEW_UNSUPPORTED");
  if (buffer.length > PREVIEW_LIMITS.office) throw fail("file too large", "PREVIEW_TOO_LARGE");
  let eocd = -1;
  const min = Math.max(0, buffer.length - 65557);
  for (let index = buffer.length - 22; index >= min; index -= 1) {
    if (buffer[index] === 0x50 && buffer[index + 1] === 0x4b && buffer[index + 2] === 0x05 && buffer[index + 3] === 0x06) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw fail("not a zip archive", "PREVIEW_UNSUPPORTED");
  const wanted = new Set(names);
  const found = new Map();
  const count = u16(buffer, eocd + 10);
  let offset = u32(buffer, eocd + 16);
  for (let index = 0; index < count && found.size < wanted.size; index += 1) {
    if (offset + 46 > buffer.length || u32(buffer, offset) !== 0x02014b50) throw fail("invalid zip", "PREVIEW_UNSUPPORTED");
    const method = u16(buffer, offset + 10);
    const compressed = u32(buffer, offset + 20);
    const uncompressed = u32(buffer, offset + 24);
    const nameLen = u16(buffer, offset + 28);
    const extraLen = u16(buffer, offset + 30);
    const commentLen = u16(buffer, offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > buffer.length) throw fail("truncated zip", "PREVIEW_UNSUPPORTED");
    const name = buffer.subarray(nameStart, nameEnd).toString("utf8");
    const localOff = u32(buffer, offset + 42);
    offset = nameEnd + extraLen + commentLen;
    if (!wanted.has(name)) continue;
    if (uncompressed > OFFICE_XML_CAP) throw fail("file too large", "PREVIEW_TOO_LARGE");
    if (localOff + 30 > buffer.length || u32(buffer, localOff) !== 0x04034b50) throw fail("invalid zip", "PREVIEW_UNSUPPORTED");
    const localNameLen = u16(buffer, localOff + 26);
    const localExtra = u16(buffer, localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtra;
    const dataEnd = dataStart + compressed;
    if (dataEnd > buffer.length) throw fail("truncated zip", "PREVIEW_UNSUPPORTED");
    const payload = buffer.subarray(dataStart, dataEnd);
    let raw;
    if (method === 0) raw = Buffer.from(payload);
    else if (method === 8) {
      try { raw = inflateRawSync(payload); }
      catch { throw fail("invalid zip", "PREVIEW_UNSUPPORTED"); }
    } else throw fail("unsupported zip compression", "PREVIEW_UNSUPPORTED");
    if (raw.length > OFFICE_XML_CAP) throw fail("file too large", "PREVIEW_TOO_LARGE");
    found.set(name, raw);
  }
  return found;
}

function clip(text) {
  const value = String(text || "").replace(/\u0000/g, "").trim();
  if (value.length <= TEXT_CAP) return value;
  return `${value.slice(0, TEXT_CAP)}\n…`;
}

export function previewDocx(buffer) {
  const files = zipRead(buffer, ["word/document.xml"]);
  const xml = decodeXml(files.get("word/document.xml") || Buffer.alloc(0));
  const paragraphs = xml.split(/<\/w:p\b[^>]*>/i).map((chunk) => taggedTexts(chunk, "t").join("").trim()).filter(Boolean);
  return { kind: "docx", title: "Word 预览（只读）", paragraphs: paragraphs.slice(0, 80), truncated: paragraphs.length > 80 };
}

export function previewPptx(buffer) {
  const catalog = zipRead(buffer, ["ppt/presentation.xml"]);
  const names = [];
  for (let index = 1; index <= MAX_SLIDES; index += 1) names.push(`ppt/slides/slide${index}.xml`);
  const files = zipRead(buffer, names);
  const slides = [];
  for (const name of names) {
    const xml = files.get(name);
    if (!xml) break;
    const texts = taggedTexts(decodeXml(xml), "t").map((item) => item.trim()).filter(Boolean);
    slides.push({ title: `第 ${slides.length + 1} 页`, lines: texts.slice(0, 40) });
  }
  if (!slides.length && catalog.size) slides.push({ title: "幻灯片", lines: ["未能提取幻灯片文字"] });
  return { kind: "pptx", title: "PowerPoint 预览（只读）", slides, truncated: slides.length >= MAX_SLIDES };
}

function columnLabel(index) {
  let n = index;
  let out = "";
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

export function previewXlsx(buffer) {
  const files = zipRead(buffer, ["xl/sharedStrings.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]);
  const shared = taggedTexts(decodeXml(files.get("xl/sharedStrings.xml") || Buffer.alloc(0)), "t");
  const sheetXml = decodeXml(files.get("xl/worksheets/sheet1.xml") || Buffer.alloc(0));
  const rows = [];
  const rowPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
  const cells = [];
  let match;
  while ((match = rowPattern.exec(sheetXml))) {
    const attrs = match[1];
    const ref = /r="([A-Z]+)(\d+)"/.exec(attrs);
    if (!ref) continue;
    const col = ref[1].split("").reduce((sum, ch) => sum * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
    const row = Number(ref[2]) - 1;
    const isShared = /t="s"/.test(attrs);
    const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(match[2]);
    let value = valueMatch ? decodeEntities(valueMatch[1]) : "";
    if (isShared) value = shared[Number(value)] || value;
    cells.push({ row, col, value });
  }
  for (const cell of cells) {
    if (cell.row >= MAX_SHEET_ROWS || cell.col >= MAX_SHEET_COLS) continue;
    if (!rows[cell.row]) rows[cell.row] = [];
    rows[cell.row][cell.col] = cell.value;
  }
  const width = Math.min(MAX_SHEET_COLS, Math.max(1, ...rows.map((row) => (row || []).length), 1));
  const header = Array.from({ length: width }, (_, index) => columnLabel(index));
  const body = rows.slice(0, MAX_SHEET_ROWS).map((row) => {
    const next = [];
    for (let col = 0; col < width; col += 1) next.push(row && row[col] != null ? String(row[col]) : "");
    return next;
  });
  const sheets = taggedTexts(decodeXml(files.get("xl/workbook.xml") || Buffer.alloc(0)), "name");
  return {
    kind: "xlsx",
    title: "Excel 预览（只读，首表）",
    sheet: sheets[0] || "Sheet1",
    header,
    rows: body,
    truncated: cells.some((cell) => cell.row >= MAX_SHEET_ROWS || cell.col >= MAX_SHEET_COLS),
  };
}

export function officePreview(kind, buffer) {
  if (kind === "docx") {
    const preview = previewDocx(buffer);
    return { ...preview, text: clip(preview.paragraphs.join("\n")) };
  }
  if (kind === "pptx") {
    const preview = previewPptx(buffer);
    return { ...preview, text: clip(preview.slides.flatMap((slide) => [slide.title, ...slide.lines]).join("\n")) };
  }
  if (kind === "xlsx") {
    const preview = previewXlsx(buffer);
    return { ...preview, text: clip([preview.sheet, preview.header.join("\t"), ...preview.rows.map((row) => row.join("\t"))].join("\n")) };
  }
  throw fail("unsupported office type", "PREVIEW_UNSUPPORTED");
}

function looksLike(kind, buffer) {
  if (kind === "pdf") return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  if (kind === "image") {
    const head = buffer.subarray(0, 12);
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true;
    if (head[0] === 0xff && head[1] === 0xd8) return true;
    if (head.subarray(0, 3).toString("latin1") === "GIF") return true;
    if (head.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return true;
    if (head[0] === 0x42 && head[1] === 0x4d) return true;
    if (head[0] === 0x00 && head[1] === 0x00 && (head[2] === 0x01 || head[2] === 0x02)) return true;
    return false;
  }
  return true;
}

export function mediaHeaders(kind, ext) {
  return {
    "content-type": mediaContentType(kind, ext),
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=60",
    "accept-ranges": kind === "video" || kind === "audio" ? "bytes" : "none",
  };
}

export function mediaResponse(kind, path, buffer, request) {
  const ext = extensionOf(path);
  const limit = PREVIEW_LIMITS[kind] ?? PREVIEW_LIMITS.image;
  if (buffer.length > limit) throw fail("file too large", "PREVIEW_TOO_LARGE");
  if (!looksLike(kind, buffer)) throw fail("file content does not match its type", "PREVIEW_UNSUPPORTED");
  const headers = mediaHeaders(kind, ext);
  const range = request?.headers?.get?.("range");
  if ((kind === "video" || kind === "audio") && typeof range === "string" && range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range.trim());
    if (!match) throw fail("invalid range", "PREVIEW_UNSUPPORTED");
    const start = Number(match[1]);
    const end = match[2] === "" ? buffer.length - 1 : Number(match[2]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= buffer.length || start > end) {
      return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${buffer.length}` } });
    }
    const slice = buffer.subarray(start, end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        ...headers,
        "content-range": `bytes ${start}-${end}/${buffer.length}`,
        "content-length": String(slice.length),
      },
    });
  }
  return new Response(buffer, {
    status: 200,
    headers: { ...headers, "content-length": String(buffer.length) },
  });
}

export function previewLimit(kind) {
  if (kind === "docx" || kind === "pptx" || kind === "xlsx") return PREVIEW_LIMITS.office;
  return PREVIEW_LIMITS[kind] ?? PREVIEW_LIMITS.image;
}
