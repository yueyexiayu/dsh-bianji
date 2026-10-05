import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import * as nodePath from "node:path";
import {
  API_PATH,
  TEXT_BYTE_LIMIT,
  LIST_ENTRY_LIMIT,
  isPathInside,
  isBinaryPath,
  looksBinary,
} from "./parse.js";

export const name = "bianji";
export const inject = ["connection"];

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

function sessionCwd(ctx, sessionId) {
  if (!sessionId) return null;
  try {
    const agents = ctx.get("agents");
    const agent = agents && agents.get(String(sessionId));
    const session = agent && agent.session;
    if (!session) return null;
    if (session.header && typeof session.header.cwd === "string" && session.header.cwd) {
      return session.header.cwd;
    }
    if (typeof session.requestHeader === "function") {
      const header = session.requestHeader();
      if (header && typeof header.cwd === "string" && header.cwd) return header.cwd;
    }
  } catch {
    // optional service
  }
  return null;
}

async function resolveInside(root, requested) {
  const rootReal = await fs.realpath(root);
  const normalized = String(requested || ".").replace(/\\/g, "/");
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
  const entries = [];
  for (const name of sliced) {
    const full = nodePath.join(path, name);
    let type = "other";
    let size;
    let mtimeMs;
    try {
      const info = await fs.lstat(full);
      type = info.isDirectory() ? "directory" : info.isFile() ? "file" : "other";
      size = info.isFile() ? info.size : undefined;
      mtimeMs = info.mtimeMs;
    } catch {
      continue;
    }
    entries.push({
      name,
      type,
      size,
      mtimeMs,
      path: full,
      relative: nodePath.relative(root, full) || name,
    });
  }
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

async function readText(root, requested, fileSystem, signal) {
  const { path } = await resolveInside(root, requested);
  if (isBinaryPath(path)) throw new Error("binary file");
  const st = await fs.stat(path);
  if (!st.isFile()) throw new Error("not a file");
  if (st.size > TEXT_BYTE_LIMIT) throw new Error("file too large");
  const target = await fileSystem.resolve(path);
  const before = await fileSystem.stat(target, signal);
  const buffer = Buffer.from(await fileSystem.readBytes(target, signal, TEXT_BYTE_LIMIT));
  const after = await fileSystem.stat(target, signal);
  if (!before || before.version !== after?.version) throw Object.assign(new Error("文件在读取期间发生修改，请重新打开"), { code: "FS_STALE_VERSION" });
  if (buffer.length > TEXT_BYTE_LIMIT) throw new Error("file too large");
  if (looksBinary(buffer)) throw new Error("binary file");
  return {
    path,
    relative: nodePath.relative(root, path),
    content: buffer.toString("utf8"),
    version: after.version,
    mtimeMs: st.mtimeMs,
    size: buffer.length,
  };
}

async function writeText(root, requested, content, version, fileSystem, sandboxPolicy, signal) {
  if (typeof version !== "string" || !version) throw Object.assign(new Error("缺少文件版本，请重新打开文件后保存"), { code: "VERSION_REQUIRED" });
  if (typeof content !== "string") throw new Error("content must be a string");
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > TEXT_BYTE_LIMIT) throw new Error("file too large");
  const { path } = await resolveInside(root, requested);
  if (isBinaryPath(path)) throw new Error("binary file");
  const target = await fileSystem.resolve(path);
  const outcome = await fileSystem.writeText(target, content, { kind: "replaceIfVersion", version }, signal, sandboxPolicy);
  return {
    path,
    relative: nodePath.relative(root, path),
    operation: outcome.operation,
    version: outcome.version,
    size: bytes,
  };
}

function revealNative(path) {
  return new Promise((resolve, reject) => {
    let child;
    if (process.platform === "darwin") child = spawn("open", ["-R", path], { detached: true, stdio: "ignore" });
    else if (process.platform === "win32") child = spawn("explorer", ["/select,", path], { detached: true, stdio: "ignore" });
    else child = spawn("xdg-open", [nodePath.dirname(path)], { detached: true, stdio: "ignore" });
    child.on("error", reject);
    child.unref();
    resolve();
  });
}

async function revealPath(root, requested) {
  const { path } = await resolveInside(root, requested);
  await fs.stat(path);
  await revealNative(path);
  return { path };
}

export function apply(ctx) {
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
        if (request.method === "GET") {
          action = url.searchParams.get("action") || "root";
          sessionId = url.searchParams.get("sessionId");
          path = url.searchParams.get("path") || ".";
        } else {
          const raw = await request.text();
          const body = raw ? JSON.parse(raw) : {};
          action = body.action;
          sessionId = body.sessionId;
          path = body.path || ".";
          content = body.content;
          version = body.version;
        }
        const cwd = sessionCwd(ctx, sessionId);
        if (!cwd) return fail(400, "no workspace for this session");
        const rootReal = await fs.realpath(cwd);
        if (action === "root") {
          return jsonResponse(200, { ok: true, root: rootReal });
        }
        if (action === "list") {
          const listed = await listDir(rootReal, path);
          return jsonResponse(200, { ok: true, root: rootReal, ...listed });
        }
        if (action === "read") {
          const agent = ctx.get("agents")?.get(String(sessionId));
          const fileSystem = agent?.ctx?.get("fs") ?? ctx.get("fs");
          if (!fileSystem) return fail(503, "文件服务不可用，无法安全读取", "FS_UNAVAILABLE");
          const file = await readText(rootReal, path, fileSystem, request.signal);
          return jsonResponse(200, { ok: true, root: rootReal, ...file });
        }
        if (action === "write") {
          if (request.method !== "POST") return fail(405, "write requires POST");
          const agent = ctx.get("agents")?.get(String(sessionId));
          const fileSystem = agent?.ctx?.get("fs") ?? ctx.get("fs");
          if (!fileSystem) return fail(503, "文件服务不可用，已停止保存", "FS_UNAVAILABLE");
          const policy = (agent?.ctx?.get("sandboxPolicy") ?? ctx.get("sandboxPolicy"))?.resolve({ session: agent.session });
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
        if (error?.code === "FS_STALE_VERSION" || error?.code === "FS_NOT_OBSERVED") {
          return fail(409, "文件已被外部修改或删除，已停止自动保存；本地编辑内容仍保留", error.code);
        }
        if (error?.code === "VERSION_REQUIRED") return fail(428, error.message, error.code);
        if (error?.code === "FS_SANDBOX_DENIED") return fail(403, "当前会话权限不允许保存，本地编辑内容仍保留", error.code);
        const message = error && error.message ? error.message : String(error);
        const status = /escapes|binary|too large|not a /.test(message) ? 400 : 500;
        return fail(status, message);
      }
    },
  });
}
