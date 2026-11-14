import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import * as nodePath from "node:path";
import z from "@deepseek-ai/schemastery";
import {
  API_PATH,
  TEXT_BYTE_LIMIT,
  LIST_ENTRY_LIMIT,
  isPathInside,
  isBinaryPath,
  decodeText,
  fileKind,
} from "./parse.js";
import { handleMonacoRequest, MONACO_ROUTE } from "./monaco.js";
import {
  mediaRange,
  mediaResponse,
  officePreview,
  partialMediaResponse,
  previewLimit,
  rangeUnavailable,
} from "./preview.js";

export const name = "bianji";
export const inject = ["connection"];

const SEARCH_IGNORED_DIRS = new Set([
  ".git", "node_modules", "__pycache__", ".venv", "venv", ".pytest_cache",
  ".ruff_cache", ".mypy_cache", "dist", "build", ".next", ".nuxt", "coverage",
  ".idea", "target",
]);
const SEARCH_MAX_FILES = 4_000;
const SEARCH_MAX_RESULTS = 200;
const SEARCH_MATCHES_PER_FILE = 3;

export const Config = z.object({
  hideNoise: z.boolean().default(true).volatile(),
  refStyle: z.union(["relative", "absolute"]).default("relative").volatile(),
  searchContent: z.boolean().default(true).volatile(),
  searchLimit: z.union([50, 100, 200]).default(100).volatile(),
});

function configValue(config, key, fallback) {
  const raw = config && typeof config === "object" ? config[key] : undefined;
  if (typeof raw === "object" && raw !== null && typeof raw.get === "function") {
    try { return raw.get(); } catch { return fallback; }
  }
  return raw === undefined ? fallback : raw;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function fail(status, error, code) {
  return jsonResponse(status, { ok: false, error, ...(code ? { code } : {}) });
}

function sessionError(message, code, status) {
  return Object.assign(new Error(message), { code, status });
}

function absoluteCwd(value) {
  return typeof value === "string" && nodePath.isAbsolute(value) ? value : null;
}

function snapshotFromHeader(sessionId, header, events, inheritedEventCount) {
  const cwd = absoluteCwd(header?.cwd);
  if (!cwd) throw sessionError("no workspace for this session", "SESSION_NO_WORKSPACE", 400);
  if (!Array.isArray(events)) throw new Error("invalid session observation response");
  return {
    cwd,
    snapshot: {
      meta: { id: header.id ?? sessionId, cwd },
      events: events.slice(),
      inheritedEventCount,
    },
  };
}

async function sessionWorkspace(ctx, sessionId, signal) {
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    throw sessionError("missing sessionId", "SESSION_REQUIRED", 400);
  }
  const agent = ctx.get("agents")?.get(sessionId);
  if (agent?.session) {
    const cwd = absoluteCwd(agent.session.header?.cwd) ?? absoluteCwd(agent.session.requestHeader?.()?.cwd);
    if (!cwd) throw sessionError("no absolute workspace for this session", "SESSION_NO_WORKSPACE", 400);
    return { cwd, agent };
  }
  const published = ctx.get("sessions")?.get?.(sessionId);
  if (published) {
    const events = typeof published.snapshotEvents === "function" ? published.snapshotEvents() : published.events;
    return { agent, ...snapshotFromHeader(sessionId, published.header, events, published.inheritedEventCount) };
  }
  const query = ctx.get("sessionQuery");
  if (typeof query?.observeSession === "function") {
    const observation = await query.observeSession(sessionId, { signal, projectionMode: "none" });
    try {
      return { agent, ...snapshotFromHeader(sessionId, observation?.header, observation?.events, observation?.inheritedEventCount) };
    } finally {
      observation?.[Symbol.dispose]?.();
    }
  }
  const controller = ctx.get("sessionController");
  if (typeof controller?.inspect !== "function") {
    throw sessionError("session inspection service unavailable", "SESSION_UNAVAILABLE", 503);
  }
  const snapshot = await controller.inspect(sessionId, signal);
  const cwd = absoluteCwd(snapshot?.meta?.cwd);
  if (!cwd) throw sessionError("no workspace for this session", "SESSION_NO_WORKSPACE", 400);
  if (!Array.isArray(snapshot.events)) throw new Error("invalid session inspection response");
  return { cwd, agent, snapshot };
}

function writePolicy(ctx, workspace) {
  const policy = workspace.agent?.ctx?.get("sandboxPolicy") ?? ctx.get("sandboxPolicy");
  if (typeof policy?.resolve !== "function") {
    throw Object.assign(new Error("会话沙箱策略不可用，已停止保存"), { code: "FS_UNAVAILABLE" });
  }
  if (workspace.agent?.session) return policy.resolve({ session: workspace.agent.session });
  // prepare is an unpublished in-memory Session, not create/resume: it neither
  // publishes events nor acquires a writer. Let the official policy projection fold
  // the exact inspected prefix instead of duplicating sandbox/mode semantics.
  const sessions = ctx.get("sessions");
  if (typeof sessions?.prepare !== "function") {
    throw Object.assign(new Error("历史会话策略解析不可用，已停止保存"), { code: "FS_UNAVAILABLE" });
  }
  const session = sessions.get?.(workspace.snapshot.meta.id) ?? sessions.prepare(workspace.snapshot.meta.id, {
    meta: workspace.snapshot.meta,
    seed: workspace.snapshot.events,
    inheritedEventCount: workspace.snapshot.inheritedEventCount,
  });
  return policy.resolve({ session });
}

async function resolveInside(root, requested) {
  const rootReal = await fs.realpath(root);
  const normalized = String(requested || ".");
  const abs = nodePath.isAbsolute(normalized)
    ? nodePath.normalize(normalized)
    : nodePath.resolve(rootReal, normalized.replace(/^\/+/, ""));
  let resolved;
  try {
    resolved = await fs.realpath(abs);
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
    const parent = nodePath.dirname(abs);
    const parentReal = await fs.realpath(parent);
    if (parentReal !== rootReal && !isPathInside(rootReal, parentReal)) {
      throw new Error("path escapes workspace");
    }
    resolved = nodePath.join(parentReal, nodePath.basename(abs));
  }
  if (resolved !== rootReal && !isPathInside(rootReal, resolved)) {
    throw new Error("path escapes workspace");
  }
  return { root: rootReal, path: resolved };
}

async function listDir(root, requested) {
  const { path } = await resolveInside(root, requested);
  const st = await fs.stat(path);
  if (!st.isDirectory()) throw new Error("not a directory");
  const names = await fs.readdir(path);
  const sliced = names.slice(0, LIST_ENTRY_LIMIT);
  const entries = (await Promise.all(sliced.map(async (name) => {
    const full = nodePath.join(path, name);
    try {
      const info = await fs.lstat(full);
      const type = info.isDirectory() ? "directory" : info.isFile() ? "file" : "other";
      return {
        name,
        type,
        size: info.isFile() ? info.size : undefined,
        mtimeMs: info.mtimeMs,
        path: full,
        relative: nodePath.relative(root, full) || name,
      };
    } catch {
      return null;
    }
  }))).filter(Boolean);
  entries.sort((a, b) => {
    if (a.type === "directory" && b.type !== "directory") return -1;
    if (a.type !== "directory" && b.type === "directory") return 1;
    return a.name.localeCompare(b.name);
  });
  return {
    path,
    relative: nodePath.relative(root, path) || ".",
    truncated: names.length > LIST_ENTRY_LIMIT,
    entries,
  };
}

function relativeName(root, filePath) {
  const relative = nodePath.relative(root, filePath);
  return { relative, name: nodePath.basename(relative || filePath) };
}

async function searchWorkspace(root, query, fileSystem, options, signal) {
  const rootReal = await fs.realpath(root);
  const needle = String(query || "").trim().slice(0, 200).toLowerCase();
  const includeContent = needle !== "" && options.includeContent !== false;
  const resultLimit = Math.min(SEARCH_MAX_RESULTS, Math.max(1, Number(options.resultLimit) || 100));
  const results = [];
  const pending = [rootReal];
  let scanned = 0;
  let truncated = false;
  let errors = 0;

  function resultFor(filePath, type, matches) {
    const meta = relativeName(rootReal, filePath);
    return { type, name: meta.name, relative: meta.relative, path: filePath, matches };
  }

  while (pending.length > 0 && results.length < resultLimit && scanned < SEARCH_MAX_FILES) {
    if (signal?.aborted) throw Object.assign(new Error("search cancelled"), { name: "AbortError" });
    const directory = pending.pop();
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch { errors++; continue; }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      if (results.length >= resultLimit || scanned >= SEARCH_MAX_FILES) {
        truncated = true;
        break;
      }
      if (entry.name === ".DS_Store") continue;
      const full = nodePath.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (SEARCH_IGNORED_DIRS.has(entry.name)) continue;
        const meta = relativeName(rootReal, full);
        if (needle !== "" && meta.relative.toLowerCase().includes(needle)) {
          results.push(resultFor(full, "directory", []));
        }
        pending.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      scanned++;
      if (scanned > SEARCH_MAX_FILES) {
        truncated = true;
        break;
      }
      const meta = relativeName(rootReal, full);
      const nameMatched = needle === "" || meta.relative.toLowerCase().includes(needle);
      const matches = [];
      if (includeContent && !isBinaryPath(full)) {
        try {
          const info = await fs.stat(full);
          if (info.size <= TEXT_BYTE_LIMIT) {
            const stable = await readStableBytes(rootReal, full, fileSystem, signal, TEXT_BYTE_LIMIT);
            const lines = decodeText(stable.buffer).split("\n");
            for (let lineIndex = 0; lineIndex < lines.length && matches.length < SEARCH_MATCHES_PER_FILE; lineIndex++) {
              const line = lines[lineIndex];
              const start = line.toLowerCase().indexOf(needle);
              if (start < 0) continue;
              matches.push({ line: lineIndex + 1, text: line.slice(0, 500), start, end: start + needle.length });
            }
          }
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          errors++;
        }
      }
      if (nameMatched || matches.length > 0) results.push(resultFor(full, "file", matches));
    }
  }

  if (results.length >= resultLimit || scanned >= SEARCH_MAX_FILES || pending.length > 0) truncated = true;
  results.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.relative.localeCompare(b.relative);
  });
  return { query: needle, results: results.slice(0, resultLimit), scanned, truncated, errors };
}

async function checkTarget(root, path, target, fileSystem) {
  // FsTarget keys are opaque. Use the official host-path capability rather
  // than assuming a target.actualPath field (the packaged provider has none).
  const actualPath = fileSystem.processPath?.(target);
  if (typeof actualPath !== "string" || !nodePath.isAbsolute(actualPath)) {
    throw Object.assign(new Error("文件服务无法确认实际文件路径"), { code: "FS_UNAVAILABLE" });
  }
  const checked = await resolveInside(root, actualPath);
  if (checked.root !== root || checked.path !== actualPath || checked.path !== path) {
    throw Object.assign(new Error("文件目标在操作期间发生修改，请重新打开"), { code: "FS_STALE_VERSION" });
  }
}

async function readText(root, requested, fileSystem, signal) {
  const { path } = await resolveInside(root, requested);
  if (isBinaryPath(path)) throw new Error("binary file");
  const { buffer, st, version } = await readStableBytes(root, path, fileSystem, signal, TEXT_BYTE_LIMIT);
  const content = decodeText(buffer);
  return {
    path,
    relative: nodePath.relative(root, path),
    content,
    version,
    mtimeMs: st.mtimeMs,
    size: buffer.length,
  };
}

async function readStableBytes(root, requested, fileSystem, signal, limit) {
  const { path } = await resolveInside(root, requested);
  if (path !== requested) throw Object.assign(new Error("文件在读取期间发生修改，请重新打开"), { code: "FS_STALE_VERSION" });
  const st = await fs.stat(path);
  if (!st.isFile()) throw new Error("not a file");
  if (st.size > limit) throw Object.assign(new Error("file too large"), { code: "PREVIEW_TOO_LARGE" });
  const target = await fileSystem.resolve(path, { signal });
  await checkTarget(root, path, target, fileSystem);
  const before = await fileSystem.stat(target, signal);
  await checkTarget(root, path, target, fileSystem);
  const buffer = Buffer.from(await fileSystem.readBytes(target, signal, limit));
  const after = await fileSystem.stat(target, signal);
  await checkTarget(root, path, target, fileSystem);
  if (!before || before.version !== after?.version) throw Object.assign(new Error("文件在读取期间发生修改，请重新打开"), { code: "FS_STALE_VERSION" });
  if (buffer.length > limit) throw Object.assign(new Error("file too large"), { code: "PREVIEW_TOO_LARGE" });
  return { path, buffer, st, version: after.version };
}

async function readStableRange(root, requested, fileSystem, signal, range, total) {
  const { path } = await resolveInside(root, requested);
  if (path !== requested) throw Object.assign(new Error("文件在读取期间发生修改，请重新打开"), { code: "FS_STALE_VERSION" });
  const st = await fs.stat(path);
  if (!st.isFile() || st.size !== total) throw Object.assign(new Error("文件在读取期间发生修改，请重新打开"), { code: "FS_STALE_VERSION" });
  const target = await fileSystem.resolve(path, { signal });
  await checkTarget(root, path, target, fileSystem);
  const before = await fileSystem.stat(target, signal);
  await checkTarget(root, path, target, fileSystem);
  const buffer = Buffer.from(await fileSystem.readByteRange(target, { offset: range.start, length: range.length }, signal));
  const after = await fileSystem.stat(target, signal);
  await checkTarget(root, path, target, fileSystem);
  if (!before || before.version !== after?.version || buffer.length !== range.length) {
    throw Object.assign(new Error("文件在读取期间发生修改，请重新打开"), { code: "FS_STALE_VERSION" });
  }
  return { path, buffer };
}

async function writeText(root, requested, content, version, fileSystem, sandboxPolicy, signal) {
  if (typeof version !== "string" || !version) throw Object.assign(new Error("缺少文件版本，请重新打开文件后保存"), { code: "VERSION_REQUIRED" });
  if (typeof content !== "string") throw new Error("content must be a string");
  const buffer = Buffer.from(content, "utf8");
  const bytes = buffer.length;
  if (bytes > TEXT_BYTE_LIMIT) throw new Error("file too large");
  if (decodeText(buffer) !== content) {
    throw Object.assign(new Error("content contains invalid Unicode"), { code: "FS_NOT_TEXT" });
  }
  const { path } = await resolveInside(root, requested);
  if (isBinaryPath(path)) throw new Error("binary file");
  const target = await fileSystem.resolve(path, { signal });
  await checkTarget(root, path, target, fileSystem);
  const outcome = await fileSystem.writeText(target, content, { kind: "replaceIfVersion", version }, signal, sandboxPolicy);
  return {
    path,
    relative: nodePath.relative(root, path),
    operation: outcome.operation,
    version: outcome.version,
    size: bytes,
  };
}

export function revealNative(path, launch = spawn) {
  return new Promise((resolve, reject) => {
    let child;
    if (process.platform === "darwin") child = launch("open", ["-R", path], { detached: true, stdio: "ignore" });
    else if (process.platform === "win32") child = launch("explorer", ["/select,", path], { detached: true, stdio: "ignore" });
    else child = launch("xdg-open", [nodePath.dirname(path)], { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`file manager failed (${signal || code})`));
    });
    child.unref();
  });
}

async function revealPath(root, requested) {
  const { path } = await resolveInside(root, requested);
  await fs.stat(path);
  await revealNative(path);
  return { path };
}

async function openWorkspaceFile(root, requested, fileSystem, signal) {
  const { path } = await resolveInside(root, requested);
  const st = await fs.stat(path);
  if (!st.isFile()) throw new Error("not a file");
  const kind = fileKind(path);
  const relative = nodePath.relative(root, path);
  if (kind === "text") {
    if (!fileSystem) throw Object.assign(new Error("文件服务不可用，无法安全读取"), { code: "FS_UNAVAILABLE" });
    const file = await readText(root, path, fileSystem, signal);
    return { kind: "text", ...file };
  }
  if (st.size > previewLimit(kind)) throw Object.assign(new Error("file too large"), { code: "PREVIEW_TOO_LARGE" });
  if (kind === "image" || kind === "audio" || kind === "video" || kind === "pdf") {
    return { kind, path, relative, size: st.size, media: true };
  }
  if (kind === "docx" || kind === "pptx" || kind === "xlsx") {
    if (!fileSystem) throw Object.assign(new Error("文件服务不可用，无法安全读取"), { code: "FS_UNAVAILABLE" });
    const read = await readStableBytes(root, path, fileSystem, signal, previewLimit(kind));
    return { kind, path: read.path, relative, size: read.buffer.length, preview: officePreview(kind, read.buffer) };
  }
  throw Object.assign(new Error("unsupported file type"), { code: "PREVIEW_UNSUPPORTED" });
}

async function openMedia(root, requested, request, fileSystem) {
  const { path } = await resolveInside(root, requested);
  const st = await fs.stat(path);
  if (!st.isFile()) throw new Error("not a file");
  const kind = fileKind(path);
  if (kind !== "image" && kind !== "audio" && kind !== "video" && kind !== "pdf") {
    throw Object.assign(new Error("not a media file"), { code: "PREVIEW_UNSUPPORTED" });
  }
  if (st.size > previewLimit(kind)) throw Object.assign(new Error("file too large"), { code: "PREVIEW_TOO_LARGE" });
  if (!fileSystem) throw Object.assign(new Error("文件服务不可用，无法安全读取"), { code: "FS_UNAVAILABLE" });
  const range = mediaRange(kind, request, st.size);
  if (range?.invalid) return rangeUnavailable(kind, path, st.size);
  if (range && typeof fileSystem.readByteRange === "function") {
    const read = await readStableRange(root, path, fileSystem, request.signal, range, st.size);
    return partialMediaResponse(kind, read.path, range, st.size, read.buffer);
  }
  const read = await readStableBytes(root, path, fileSystem, request.signal, previewLimit(kind));
  return mediaResponse(kind, read.path, read.buffer, request);
}

export function apply(ctx, config = {}) {
  ctx.connection.fetch.register({
    path: MONACO_ROUTE,
    methods: ["GET"],
    requestBody: "buffered",
    fetch: (request) => handleMonacoRequest(request),
  });
  ctx.connection.fetch.register({
    path: API_PATH,
    methods: ["GET", "POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      try {
        const url = new URL(request.url);
        let action;
        let sessionId;
        let path;
        let content;
        let version;
        let query;
        let includeContent;
        let resultLimit;
        if (request.method === "GET") {
          action = url.searchParams.get("action") || "root";
          sessionId = url.searchParams.get("sessionId");
          path = url.searchParams.get("path") || ".";
          query = url.searchParams.get("q") || "";
          includeContent = url.searchParams.has("content") ? url.searchParams.get("content") !== "0" : undefined;
          resultLimit = Number(url.searchParams.get("limit")) || undefined;
        } else {
          const raw = await request.text();
          let body = {};
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch {
              return fail(400, "invalid json");
            }
            if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "invalid json");
          }
          action = body.action;
          sessionId = body.sessionId;
          path = body.path || ".";
          content = body.content;
          version = body.version;
          query = typeof body.q === "string" ? body.q : (typeof body.query === "string" ? body.query : "");
          includeContent = typeof body.includeContent === "boolean" ? body.includeContent : undefined;
          resultLimit = Number(body.limit) || undefined;
        }
        const workspace = await sessionWorkspace(ctx, sessionId, request.signal);
        const { cwd, agent } = workspace;
        const rootReal = await fs.realpath(cwd);
        if (action === "root") {
          return jsonResponse(200, { ok: true, root: rootReal });
        }
        if (action === "list") {
          const listed = await listDir(rootReal, path);
          return jsonResponse(200, { ok: true, root: rootReal, ...listed });
        }
        if (action === "search") {
          const wantsContent = includeContent === undefined
            ? configValue(config, "searchContent", true) !== false
            : includeContent;
          const fileSystem = agent?.ctx?.get("fs") ?? ctx.get("fs");
          if (wantsContent && !fileSystem) return fail(503, "文件服务不可用，无法安全搜索内容", "FS_UNAVAILABLE");
          const searched = await searchWorkspace(rootReal, query, fileSystem, {
            includeContent: wantsContent,
            resultLimit: resultLimit ?? configValue(config, "searchLimit", 100),
          }, request.signal);
          return jsonResponse(200, { ok: true, root: rootReal, ...searched });
        }
        if (action === "read") {
          const fileSystem = agent?.ctx?.get("fs") ?? ctx.get("fs");
          if (!fileSystem) return fail(503, "文件服务不可用，无法安全读取", "FS_UNAVAILABLE");
          const file = await readText(rootReal, path, fileSystem, request.signal);
          return jsonResponse(200, { ok: true, root: rootReal, kind: "text", ...file });
        }
        if (action === "open") {
          const fileSystem = agent?.ctx?.get("fs") ?? ctx.get("fs");
          const opened = await openWorkspaceFile(rootReal, path, fileSystem, request.signal);
          return jsonResponse(200, { ok: true, root: rootReal, ...opened });
        }
        if (action === "media") {
          if (request.method !== "GET") return fail(405, "media requires GET");
          const fileSystem = agent?.ctx?.get("fs") ?? ctx.get("fs");
          if (!fileSystem) return fail(503, "文件服务不可用，无法安全读取", "FS_UNAVAILABLE");
          return await openMedia(rootReal, path, request, fileSystem);
        }
        if (action === "write") {
          if (request.method !== "POST") return fail(405, "write requires POST");
          const fileSystem = agent?.ctx?.get("fs") ?? ctx.get("fs");
          if (!fileSystem) return fail(503, "文件服务不可用，已停止保存", "FS_UNAVAILABLE");
          const policy = writePolicy(ctx, workspace);
          const written = await writeText(rootReal, path, content, version, fileSystem, policy, request.signal);
          return jsonResponse(200, { ok: true, root: rootReal, ...written });
        }
        if (action === "reveal") {
          if (request.method !== "POST") return fail(405, "reveal requires POST");
          const revealed = await revealPath(rootReal, path);
          return jsonResponse(200, { ok: true, root: rootReal, ...revealed });
        }
        return fail(400, "unknown action");
      } catch (error) {
        if (error?.status) return fail(error.status, error.message, error.code);
        if (error?.name === "ApiSessionNotFound" || error?.constructor?.name === "ApiSessionNotFound" || error?.code === "SESSION_QUERY_SESSION_NOT_FOUND") return fail(404, "session not found", "SESSION_NOT_FOUND");
        if (error?.name === "AbortError" || error?.code === "SESSION_QUERY_ABORTED") return fail(409, "session inspection cancelled", "SESSION_ABORTED");
        if (typeof error?.code === "string" && error.code.startsWith("SESSION_QUERY_")) return fail(500, "session inspection failed", error.code);
        if (error?.code === "FS_STALE_VERSION" || error?.code === "FS_NOT_OBSERVED") {
          return fail(409, "文件已被外部修改或删除，已停止自动保存；本地编辑内容仍保留", error.code);
        }
        if (error?.code === "FS_NOT_TEXT") return fail(400, error.message, error.code);
        if (error?.code === "PREVIEW_TOO_LARGE" || error?.code === "PREVIEW_UNSUPPORTED") return fail(400, error.message, error.code);
        if (error?.code === "FS_UNAVAILABLE") return fail(503, error.message, error.code);
        if (error?.code === "VERSION_REQUIRED") return fail(428, error.message, error.code);
        if (error?.code === "FS_SANDBOX_DENIED") return fail(403, "当前会话权限不允许保存，本地编辑内容仍保留", error.code);
        const message = error && error.message ? error.message : String(error);
        const status = /escapes|binary|too large|not a /.test(message) ? 400 : 500;
        return fail(status, message);
      }
    },
  });
}
