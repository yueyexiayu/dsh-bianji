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

function fail(status, error) {
  return jsonResponse(status, { ok: false, error });
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

async function readText(root, requested) {
  const { path } = await resolveInside(root, requested);
  if (isBinaryPath(path)) throw new Error("binary file");
  const st = await fs.stat(path);
  if (!st.isFile()) throw new Error("not a file");
  if (st.size > TEXT_BYTE_LIMIT) throw new Error("file too large");
  const buffer = await fs.readFile(path);
  if (looksBinary(buffer)) throw new Error("binary file");
  return {
    path,
    relative: nodePath.relative(root, path),
    content: buffer.toString("utf8"),
    mtimeMs: st.mtimeMs,
    size: st.size,
  };
}

async function writeText(root, requested, content) {
  if (typeof content !== "string") throw new Error("content must be a string");
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > TEXT_BYTE_LIMIT) throw new Error("file too large");
  const { path } = await resolveInside(root, requested);
  if (isBinaryPath(path)) throw new Error("binary file");
  let existed = false;
  try {
    const st = await fs.stat(path);
    if (st.isDirectory()) throw new Error("is a directory");
    existed = st.isFile();
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }
  await fs.mkdir(nodePath.dirname(path), { recursive: true });
  await fs.writeFile(path, content, "utf8");
  const st = await fs.stat(path);
  return {
    path,
    relative: nodePath.relative(root, path),
    operation: existed ? "update" : "create",
    mtimeMs: st.mtimeMs,
    size: st.size,
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
          const file = await readText(rootReal, path);
          return jsonResponse(200, { ok: true, root: rootReal, ...file });
        }
        if (action === "write") {
          if (request.method !== "POST") return fail(405, "write requires POST");
          const written = await writeText(rootReal, path, content);
          return jsonResponse(200, { ok: true, root: rootReal, ...written });
        }
        if (action === "reveal") {
          if (request.method !== "POST") return fail(405, "reveal requires POST");
          const revealed = await revealPath(rootReal, path);
          return jsonResponse(200, { ok: true, root: rootReal, ...revealed });
        }
        return fail(400, "unknown action");
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        const status = /escapes|binary|too large|not a /.test(message) ? 400 : 500;
        return fail(status, message);
      }
    },
  });
}
