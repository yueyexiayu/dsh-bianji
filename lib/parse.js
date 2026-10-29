/** Path containment and text-file policy for bianji. No credentials. */

import * as nodePath from "node:path";

export const API_PATH = "/api/bianji";
export const TEXT_BYTE_LIMIT = 1_500_000;
export const LIST_ENTRY_LIMIT = 2_000;
export const PREVIEW_LIMITS = {
  image: 25_000_000,
  audio: 40_000_000,
  video: 80_000_000,
  pdf: 40_000_000,
  office: 20_000_000,
};

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v"]);
const OFFICE_EXTENSIONS = new Set(["docx", "pptx", "xlsx"]);
const BINARY_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  "icns", "pdf", "zip", "gz", "tgz", "bz2", "xz", "7z", "rar",
  "woff", "woff2", "ttf", "otf", "eot",
  "wasm", "node", "dylib", "so", "dll", "exe",
  "class", "jar", "pyc", "pyo",
  ...OFFICE_EXTENSIONS, "doc", "ppt", "xls", "rtf",
]);

export function fileKind(filePath) {
  const ext = extensionOf(filePath);
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  if (ext === "xlsx") return "xlsx";
  if (BINARY_EXTENSIONS.has(ext)) return "unsupported";
  return "text";
}

export function mediaContentType(kind, ext) {
  if (kind === "pdf") return "application/pdf";
  if (kind === "image") {
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "svg") return "image/svg+xml";
    if (ext === "ico") return "image/x-icon";
    return `image/${ext}`;
  }
  if (kind === "audio") {
    if (ext === "mp3") return "audio/mpeg";
    if (ext === "m4a" || ext === "aac") return "audio/mp4";
    return `audio/${ext}`;
  }
  if (kind === "video") {
    if (ext === "mov" || ext === "m4v") return "video/mp4";
    return `video/${ext}`;
  }
  return "application/octet-stream";
}

export function isPathInside(root, candidate) {
  const rel = nodePath.relative(root, candidate);
  if (rel === "") return true;
  return rel !== ".." && !rel.startsWith(`..${nodePath.sep}`) && !nodePath.isAbsolute(rel);
}

export function extensionOf(filePath) {
  const base = nodePath.basename(filePath);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function isBinaryPath(filePath) {
  return BINARY_EXTENSIONS.has(extensionOf(filePath));
}

export function looksBinary(buffer) {
  if (buffer.includes(0)) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  let suspicious = 0;
  for (const byte of sample) {
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return sample.length > 0 && suspicious / sample.length > 0.3;
}

export function decodeText(buffer) {
  if (looksBinary(buffer)) throw Object.assign(new Error("binary file"), { code: "FS_NOT_TEXT" });
  try {
    // ignoreBOM retains U+FEFF in the editable text, so saving preserves its bytes.
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw Object.assign(new Error("invalid UTF-8 text"), { code: "FS_NOT_TEXT" });
  }
}
