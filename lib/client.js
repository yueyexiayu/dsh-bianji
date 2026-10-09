window.__ModuleLoader__.load({
  id: "bianji",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    var inject = ["slots", "sidebarRightTabs"];
    var TAB_ID = "bianji";
    var TAB_KIND = "bianji";
    var API_PATH = "/api/bianji";
    var STYLE_ID = "bianji-style";
    // Keep failed/conflicted drafts when the sidebar or session is unmounted.
    // These stay in this client process only, never in account/config storage.
    var editorSessions = new Map();

    var cssText = [
      ".dshf-split { display: flex; height: 100%; min-height: 0; background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, #1f2328); font-size: 13px; }",
      ".dshf-root { display: flex; flex-direction: column; width: 240px; flex: none; min-height: 0; border-right: 1px solid var(--dsw-alias-border-l3, #e6e6e6); background: var(--dsw-alias-bg-layer-1, #f7f7f8); color: var(--dsw-alias-label-primary, #1f2328); }",
      ".dshf-toolbar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--dsw-alias-border-l3, #e6e6e6); flex: none; }",
      ".dshf-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }",
      ".dshf-spacer { flex: 1; }",
      ".dshf-btn { background: transparent; border: 1px solid var(--dsw-alias-border-l3, #d0d0d0); border-radius: 6px; color: inherit; cursor: pointer; font-size: 12px; padding: 2px 7px; line-height: 1.5; }",
      ".dshf-btn:hover { background: var(--dsw-alias-bg-module-platform, #ececec); }",
      ".dshf-btn:disabled { opacity: 0.45; cursor: default; }",
      ".dshf-btn-icon { display: inline-flex; align-items: center; justify-content: center; border-color: transparent; padding: 4px; }",
      ".dshf-md-toggle { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }",
      ".dshf-tree-pane { flex: 1; min-height: 0; overflow: auto; padding: 4px 0; background: var(--dsw-alias-bg-base, #ffffff); }",
      ".dshf-node { display: flex; align-items: center; gap: 4px; padding: 2px 8px; cursor: grab; white-space: nowrap; user-select: none; min-height: 22px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; box-sizing: border-box; }",
      ".dshf-node:active { cursor: grabbing; }",
      ".dshf-node:hover { background: rgba(0,0,0,0.05); }",
      ".dshf-selected { background: rgba(77,171,247,0.18); }",
      ".dshf-caret { width: 12px; flex: none; font-size: 10px; color: var(--dsw-alias-label-tertiary, #868e96); }",
      ".dshf-name { overflow: hidden; text-overflow: ellipsis; min-width: 0; }",
      ".dshf-status { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-top: 1px solid var(--dsw-alias-border-l3, #e6e6e6); flex: none; font-size: 11px; color: var(--dsw-alias-label-secondary, #868e96); min-height: 22px; }",
      ".dshf-error { padding: 8px 12px; color: var(--dsw-alias-danger-fg, #c92a2a); font-size: 12px; }",
      ".dshf-editor-view { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, #1f2328); }",
      ".dshf-editor-toolbar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--dsw-alias-bg-layer-1, #f3f3f3); border-bottom: 1px solid var(--dsw-alias-border-l3, #e6e6e6); flex: none; font-size: 12px; }",
      ".dshf-tabname { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
      ".dshf-dirty { color: #c2410c; }",
      ".dshf-editor-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary, #868e96); font-size: 11px; }",
      ".dshf-status-top { border-top: none; border-bottom: 1px solid var(--dsw-alias-border-l3, #e6e6e6); background: var(--dsw-alias-bg-layer-1, #f3f3f3); }",
      ".dshf-tabs-strip { display: flex; align-items: center; gap: 4px; flex: 1 1 auto; min-width: 0; max-width: 70%; overflow-x: auto; overflow-y: hidden; }",
      ".dshf-tab-chip { display: inline-flex; align-items: center; gap: 2px; flex: none; background: var(--dsw-alias-bg-module-platform, #ececec); border: 1px solid var(--dsw-alias-border-l3, #d0d0d0); border-radius: 6px; color: inherit; font-size: 11px; padding: 1px 2px 1px 6px; white-space: nowrap; max-width: 160px; }",
      ".dshf-tab-chip-active { background: #094771; border-color: #094771; color: #fff; }",
      ".dshf-tab-chip-name { background: transparent; border: none; padding: 0; margin: 0; font: inherit; color: inherit; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }",
      ".dshf-tab-chip-close { background: transparent; border: none; padding: 0 3px; font-size: 10px; line-height: 1; color: inherit; cursor: pointer; opacity: 0.55; border-radius: 4px; }",
      ".dshf-tab-chip-close:hover { opacity: 1; }",
      ".dshf-status-meta { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; min-width: 0; }",
      ".dshf-empty { display: flex; align-items: center; justify-content: center; flex: 1; color: var(--dsw-alias-label-secondary, #868e96); font-size: 12px; }",
      ".dshf-monaco { flex: 1; min-height: 0; }",
      ".dshf-lined { display: flex; flex: 1; min-height: 0; background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, #1f2328); overflow: hidden; }",
      ".dshf-gutter { flex: none; min-width: 48px; overflow: hidden; text-align: right; padding: 8px 10px 8px 8px; color: var(--dsw-alias-label-tertiary, #868e96); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 19px; user-select: none; white-space: pre; }",
      ".dshf-textarea { flex: 1; min-height: 0; min-width: 0; resize: none; border: none; outline: none; padding: 8px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 19px; background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, #1f2328); tab-size: 2; }",
      ".dshf-lined .dshf-textarea { padding-left: 0; }",
      ".dshf-md-preview { flex: 1; min-height: 0; overflow: auto; padding: 12px 20px 32px; line-height: 1.65; color: var(--dsw-alias-label-primary, #1f2328); background: var(--dsw-alias-bg-base, #ffffff); box-sizing: border-box; }",
      ".dshf-md-preview h1,.dshf-md-preview h2,.dshf-md-preview h3 { margin: 1.1em 0 0.45em; line-height: 1.3; }",
      ".dshf-md-preview h1 { font-size: 1.6em; border-bottom: 1px solid var(--dsw-alias-border-l3, #e6e6e6); padding-bottom: 0.3em; }",
      ".dshf-md-preview h2 { font-size: 1.3em; border-bottom: 1px solid var(--dsw-alias-border-l3, #e6e6e6); padding-bottom: 0.2em; }",
      ".dshf-md-preview p,.dshf-md-preview ul,.dshf-md-preview ol { margin: 0.6em 0; }",
      ".dshf-md-preview ul,.dshf-md-preview ol { padding-left: 1.6em; }",
      ".dshf-md-preview code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.92em; background: var(--dsw-alias-bg-layer-1, #f3f3f3); border-radius: 4px; padding: 0.1em 0.35em; }",
      ".dshf-md-preview pre { margin: 0.8em 0; padding: 10px 12px; background: var(--dsw-alias-bg-layer-1, #f7f7f8); border: 1px solid var(--dsw-alias-border-l3, #e6e6e6); border-radius: 8px; overflow: auto; }",
      ".dshf-md-preview pre code { background: transparent; padding: 0; }",
      ".dshf-md-preview a { color: var(--dsw-alias-link, #4176e6); text-decoration: none; }",
      ".dshf-md-preview blockquote { margin: 0.8em 0; padding: 0.1em 1em; border-left: 3px solid var(--dsw-alias-border-l3, #d0d0d0); color: var(--dsw-alias-label-secondary, #868e96); }",
      ".dshf-md-preview hr { border: none; border-top: 1px solid var(--dsw-alias-border-l3, #e6e6e6); }",
      ".dshf-context-menu { position: fixed; z-index: 2147483002; min-width: 180px; padding: 4px; border: 1px solid var(--dsw-alias-border-l3, #d0d0d0); border-radius: 8px; background: var(--dsw-alias-bg-overlay, #ffffff); color: var(--dsw-alias-label-primary, #1f2328); box-shadow: 0 8px 30px rgba(0,0,0,0.14); font: 13px/1.5 system-ui, sans-serif; user-select: none; }",
      ".dshf-menu-item { display: flex; align-items: center; width: 100%; padding: 5px 10px; border: none; border-radius: 6px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }",
      ".dshf-menu-item:hover { background: rgba(0,0,0,0.06); }",
      ".dshf-menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ].join(" ");

    function ensureStyle() {
      var existing = document.getElementById(STYLE_ID);
      if (existing) {
        existing.textContent = cssText;
        return;
      }
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = cssText;
      document.head.appendChild(style);
    }

    function sessionIdOf(props) {
      if (!props) return "";
      if (typeof props.sessionId === "string") return props.sessionId;
      if (props.session && typeof props.session.id === "string") return props.session.id;
      if (props.session && props.session.header && typeof props.session.header.id === "string") {
        return props.session.header.id;
      }
      try {
        if (typeof props.useTabInfo === "function") {
          var info = props.useTabInfo();
          if (info && info.tab && typeof info.tab.sessionId === "string") return info.tab.sessionId;
        }
      } catch {
        // optional
      }
      return "";
    }

    function FilesGlyph(props) {
      var size = props && props.size != null ? props.size : 26;
      return React.createElement(
        "svg",
        {
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.7",
          className: props && props.className,
          "aria-hidden": "true",
        },
        React.createElement("path", { d: "M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" }),
        React.createElement("path", { d: "M3 7V5a2 2 0 0 1 2-2h4l2 2" }),
      );
    }

    function FilesTitle() {
      return React.createElement("span", null, "文件");
    }

    function basename(path) {
      var parts = String(path || "").split("/");
      return parts[parts.length - 1] || path;
    }

    function isMarkdownPath(path) {
      var ext = String(path || "").split(".").pop().toLowerCase();
      return ext === "md" || ext === "markdown";
    }

    function languageOf(path) {
      var base = basename(path).toLowerCase();
      if (base === ".env" || base.indexOf(".env.") === 0) return "ini";
      if (base === "makefile" || base === "dockerfile") return "plaintext";
      var ext = base.split(".").pop();
      if (ext === "ts" || ext === "tsx" || ext === "mts") return "typescript";
      if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") return "javascript";
      if (ext === "json") return "json";
      if (ext === "md" || ext === "markdown") return "markdown";
      if (ext === "html" || ext === "htm") return "html";
      if (ext === "css") return "css";
      if (ext === "scss") return "scss";
      if (ext === "py") return "python";
      if (ext === "go") return "go";
      if (ext === "rs") return "rust";
      if (ext === "java") return "java";
      if (ext === "c" || ext === "h") return "c";
      if (ext === "cpp" || ext === "cc" || ext === "hpp") return "cpp";
      if (ext === "sh" || ext === "bash") return "shell";
      if (ext === "yml" || ext === "yaml") return "yaml";
      if (ext === "xml" || ext === "svg") return "xml";
      if (ext === "sql") return "sql";
      if (ext === "php") return "php";
      return "plaintext";
    }

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function renderInline(text) {
      var source = String(text);
      var token = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;
      var out = [];
      var end = 0;
      var match;
      while ((match = token.exec(source))) {
        out.push(escapeHtml(source.slice(end, match.index)));
        if (match[1] != null) out.push("<code>" + escapeHtml(match[1]) + "</code>");
        else if (match[2] != null) out.push("<strong>" + escapeHtml(match[2]) + "</strong>");
        else if (match[3] != null) out.push("<em>" + escapeHtml(match[3]) + "</em>");
        else {
          var valid = false;
          try {
            var url = new URL(match[5]);
            valid = url.protocol === "http:" || url.protocol === "https:";
          } catch { /* invalid links remain text */ }
          out.push(valid ? '<a href="' + escapeHtml(match[5]) + '" rel="noopener noreferrer">' + escapeHtml(match[4]) + "</a>" : escapeHtml(match[0]));
        }
        end = token.lastIndex;
      }
      out.push(escapeHtml(source.slice(end)));
      return out.join("");
    }

    function renderMarkdown(src) {
      var lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
      var out = [];
      var i = 0;
      var inCode = false;
      var code = [];
      var list = [];
      function flushList() {
        if (!list.length) return;
        out.push("<ul>" + list.map(function (item) { return "<li>" + renderInline(item) + "</li>"; }).join("") + "</ul>");
        list = [];
      }
      function flushCode() {
        if (!inCode) return;
        out.push("<pre><code>" + escapeHtml(code.join("\n")) + "</code></pre>");
        code = [];
        inCode = false;
      }
      for (; i < lines.length; i++) {
        var line = lines[i];
        if (line.slice(0, 3) === "```") {
          if (inCode) flushCode();
          else {
            flushList();
            inCode = true;
            code = [];
          }
          continue;
        }
        if (inCode) {
          code.push(line);
          continue;
        }
        if (/^\s*[-*]\s+/.test(line)) {
          list.push(line.replace(/^\s*[-*]\s+/, ""));
          continue;
        }
        flushList();
        if (/^#{1,4}\s+/.test(line)) {
          var level = line.match(/^#+/)[0].length;
          out.push("<h" + level + ">" + renderInline(line.replace(/^#+\s+/, "")) + "</h" + level + ">");
        } else if (/^---+$/.test(line.trim())) {
          out.push("<hr>");
        } else if (/^>\s?/.test(line)) {
          out.push("<blockquote>" + renderInline(line.replace(/^>\s?/, "")) + "</blockquote>");
        } else if (line.trim() === "") {
          out.push("");
        } else {
          out.push("<p>" + renderInline(line) + "</p>");
        }
      }
      flushList();
      flushCode();
      return out.join("\n") || "<p></p>";
    }

    // Monaco 0.52.2 loader drops ".js" when paths.vs contains "?". Fetch the
    // same-origin files ourselves and execute them from blob URLs.
    var MONACO_BASE = "/api/bianji/monaco?file=vs";
    var monacoLoading = null;

    function monacoUnavailable() {
      return new Error("monaco unavailable");
    }

    function fetchMonaco(url, expectJs) {
      return fetch(url, { credentials: "same-origin" }).then(function (res) {
        if (!res || !res.ok || typeof res.text !== "function") throw monacoUnavailable();
        if (expectJs) {
          var type = res.headers && res.headers.get ? (res.headers.get("content-type") || "") : "";
          if (type.indexOf("javascript") < 0) throw monacoUnavailable();
        }
        return res.text();
      });
    }

    function loadScriptText(text) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
        var el = document.createElement("script");
        var done = false;
        var timeout = setTimeout(fail, 15000);
        function clean() {
          clearTimeout(timeout);
          el.onload = null;
          el.onerror = null;
          try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        }
        function fail() {
          if (done) return;
          done = true;
          clean();
          try { el.remove(); } catch { /* ignore */ }
          reject(monacoUnavailable());
        }
        el.async = true;
        el.src = url;
        el.onload = function () {
          if (done) return;
          done = true;
          clean();
          resolve();
        };
        el.onerror = fail;
        (document.head || document.getElementsByTagName("head")[0]).appendChild(el);
      });
    }

    function monacoFileFromUrl(src) {
      var marker = "?file=";
      var at = String(src).indexOf(marker);
      if (at < 0) throw monacoUnavailable();
      var file = src.slice(at + marker.length);
      var cut = file.search(/[&#]/);
      if (cut >= 0) file = file.slice(0, cut);
      try { file = decodeURIComponent(file); } catch { throw monacoUnavailable(); }
      if (!file || file.indexOf("..") >= 0 || file.indexOf("\\") >= 0 || file.indexOf("\0") >= 0 || file.charAt(0) === "/") {
        throw monacoUnavailable();
      }
      if (!/\.(js|css|ttf|json)$/i.test(file)) file += ".js";
      return file;
    }

    function installMonacoScriptBridge() {
      if (installMonacoScriptBridge.done) return;
      var head = document.head || document.getElementsByTagName("head")[0];
      if (!head || !head.appendChild) return;
      installMonacoScriptBridge.done = true;
      var orig = head.appendChild.bind(head);
      head.appendChild = function (node) {
        var src = node && node.getAttribute ? (node.getAttribute("src") || "") : "";
        if (!node || String(node.tagName || "").toUpperCase() !== "SCRIPT" || src.indexOf("/api/bianji/monaco?file=") !== 0) {
          return orig(node);
        }
        var file;
        try { file = monacoFileFromUrl(src); } catch {
          try { node.dispatchEvent(new Event("error")); } catch { /* ignore */ }
          return node;
        }
        fetchMonaco("/api/bianji/monaco?file=" + file, true).then(function (text) {
          var blobUrl = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
          var drop = function () { try { URL.revokeObjectURL(blobUrl); } catch { /* ignore */ } };
          node.addEventListener("load", drop);
          node.addEventListener("error", drop);
          node.setAttribute("src", blobUrl);
          orig(node);
        }).catch(function () {
          try { node.dispatchEvent(new Event("error")); } catch { /* ignore */ }
        });
        return node;
      };
    }

    function rewriteMonacoCss(css) {
      var base = ["vs", "editor"];
      return String(css).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, function (full, _quote, raw) {
        var value = String(raw).trim();
        if (!value || /^(?:data:|https?:|blob:|#|\/)/i.test(value)) return full;
        var parts = base.slice();
        var pieces = value.split("/");
        for (var i = 0; i < pieces.length; i++) {
          if (!pieces[i] || pieces[i] === ".") continue;
          if (pieces[i] === "..") parts.pop();
          else parts.push(pieces[i]);
        }
        if (!parts.length || parts[0] !== "vs" || parts.indexOf("..") >= 0) return full;
        return "url(\"/api/bianji/monaco?file=" + parts.join("/") + "\")";
      });
    }

    function injectMonacoCss(css) {
      var id = "bianji-monaco-css";
      var text = rewriteMonacoCss(css);
      var existing = document.getElementById(id);
      if (existing) {
        existing.textContent = text;
        return;
      }
      var style = document.createElement("style");
      style.id = id;
      style.textContent = text;
      (document.head || document.getElementsByTagName("head")[0]).appendChild(style);
    }

    function installMonacoWorkers() {
      var base = "/api/bianji/monaco?file=";
      var workerFile = base + "vs/base/worker/workerMain.js";
      window.MonacoEnvironment = {
        getWorker: function (_workerId, label) {
          var source = "globalThis.MonacoEnvironment={baseUrl:" + JSON.stringify(base) + "};importScripts(" + JSON.stringify(workerFile) + ");";
          return new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })), { name: label });
        },
      };
    }

    function requireEditorMain() {
      return new Promise(function (resolve, reject) {
        var settled = false;
        var timeout = setTimeout(function () {
          if (settled) return;
          settled = true;
          reject(monacoUnavailable());
        }, 15000);
        function finish(error, value) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve(value);
        }
        try {
          window.require(["vs/editor/editor.main"], function () {
            if (!window.monaco || !window.monaco.editor) finish(monacoUnavailable());
            else finish(null, window.monaco);
          }, function () {
            finish(monacoUnavailable());
          });
        } catch (error) {
          finish(error);
        }
      });
    }

    function loadLocalMonaco() {
      installMonacoWorkers();
      return fetchMonaco(MONACO_BASE + "/loader.js", true).then(function (text) {
        return loadScriptText(text);
      }).then(function () {
        if (!window.require || typeof window.require.config !== "function") throw monacoUnavailable();
        window.require.config({ paths: { vs: MONACO_BASE }, "vs/css": { disabled: true } });
        installMonacoScriptBridge();
        return fetchMonaco(MONACO_BASE + "/editor/editor.main.css", false);
      }).then(function (css) {
        injectMonacoCss(css);
        return requireEditorMain();
      });
    }

    function ensureMonaco() {
      if (window.monaco && window.monaco.editor) return Promise.resolve(window.monaco);
      if (monacoLoading) return monacoLoading;
      monacoLoading = Promise.resolve().then(loadLocalMonaco).catch(function (error) {
        monacoLoading = null;
        throw error;
      });
      return monacoLoading;
    }

    function LinedTextarea(props) {
      var taRef = React.useRef(null);
      var gutRef = React.useRef(null);
      var lines = String(props.value || "").split("\n").length;
      var nums = [];
      for (var n = 1; n <= Math.max(lines, 1); n++) nums.push(String(n));
      function sync() {
        if (gutRef.current && taRef.current) gutRef.current.scrollTop = taRef.current.scrollTop;
      }
      return React.createElement(
        "div",
        { className: "dshf-lined" },
        React.createElement("div", { className: "dshf-gutter", ref: gutRef }, nums.join("\n")),
        React.createElement("textarea", {
          ref: taRef,
          className: "dshf-textarea",
          value: props.value,
          spellCheck: false,
          onScroll: sync,
          onChange: props.onChange,
        }),
      );
    }

    function CodeEditor(props) {
      var hostRef = React.useRef(null);
      var editorRef = React.useRef(null);
      var onChangeRef = React.useRef(props.onChange);
      var applyingRef = React.useRef(false);
      onChangeRef.current = props.onChange;
      var modeState = React.useState("loading");
      var mode = modeState[0];
      var setMode = modeState[1];

      React.useEffect(function () {
        var gone = false;
        setMode("loading");
        ensureMonaco().then(function () {
          if (!gone) setMode("monaco");
        }).catch(function () {
          if (!gone) setMode("textarea");
        });
        return function () { gone = true; };
      }, [props.path]);

      React.useEffect(function () {
        if (mode !== "monaco" || !hostRef.current || !window.monaco) return undefined;
        var model;
        var editor;
        var subscription;
        try {
          model = window.monaco.editor.createModel(props.value, languageOf(props.path));
          editor = window.monaco.editor.create(hostRef.current, {
            model: model,
            theme: "vs-light",
            automaticLayout: true,
            fontSize: 13,
            lineNumbers: "on",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 2,
            wordWrap: "off",
            renderLineHighlight: "line",
          });
          subscription = editor.onDidChangeModelContent(function () {
            if (!applyingRef.current) onChangeRef.current(editor.getValue());
          });
          editorRef.current = editor;
        } catch {
          if (editor) editor.dispose();
          if (model) model.dispose();
          setMode("textarea");
          return undefined;
        }
        return function () {
          if (subscription) subscription.dispose();
          editor.dispose();
          model.dispose();
          editorRef.current = null;
        };
      }, [mode, props.path]);

      React.useEffect(function () {
        var editor = editorRef.current;
        if (!editor || editor.getValue() === props.value) return;
        applyingRef.current = true;
        try { editor.setValue(props.value); } finally { applyingRef.current = false; }
      }, [mode, props.value]);

      if (mode === "loading") {
        return React.createElement("div", { className: "dshf-empty" }, "加载编辑器…");
      }
      if (mode === "monaco") {
        return React.createElement("div", { className: "dshf-monaco", ref: hostRef });
      }
      return React.createElement(React.Fragment, null,
        React.createElement("div", { className: "dshf-status", role: "status" }, "高级编辑器加载失败，已使用文本编辑器。"),
        React.createElement(LinedTextarea, { value: props.value, onChange: function (event) { props.onChange(event.target.value); } }));
    }

    function MarkdownPreview(props) {
      var html = React.useMemo(function () { return renderMarkdown(props.content); }, [props.content]);
      return React.createElement("div", {
        className: "dshf-md-preview",
        tabIndex: 0,
        onClick: function (event) {
          var a = event.target.closest && event.target.closest("a");
          if (!a) return;
          event.preventDefault();
          var href = a.getAttribute("href") || "";
          if (/^https?:\/\//i.test(href)) window.open(href, "_blank", "noopener,noreferrer");
        },
        dangerouslySetInnerHTML: { __html: html },
      });
    }

    function apiResponse(res) {
      return res.json().catch(function () {
        throw new Error("服务返回无效响应" + (res.status ? " (HTTP " + res.status + ")" : ""));
      }).then(function (body) {
        if (res.ok === false && (!body || body.ok !== false)) throw new Error("请求失败 (HTTP " + res.status + ")");
        if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.ok !== "boolean") throw new Error("服务返回无效响应格式");
        return body;
      });
    }

    var API_TIMEOUT_MS = 15000;

    function apiTimeoutSignal() {
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return AbortSignal.timeout(API_TIMEOUT_MS);
      }
      if (typeof AbortController !== "function") return undefined;
      var controller = new AbortController();
      setTimeout(function () { controller.abort(); }, API_TIMEOUT_MS);
      return controller.signal;
    }

    function apiGet(params) {
      var signal = apiTimeoutSignal();
      return fetch(API_PATH + "?" + new URLSearchParams(params).toString(), signal ? { signal: signal } : undefined).then(apiResponse).catch(function (error) {
        if (error && (error.name === "AbortError" || error.name === "TimeoutError")) throw new Error("请求超时");
        throw error;
      });
    }

    function apiWrite(sessionId, path, content, version) {
      return fetch(API_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "write", sessionId: sessionId, path: path, content: content, version: version }),
      }).then(apiResponse);
    }

    function apiPost(body) {
      return fetch(API_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(apiResponse);
    }

    function mentionOf(relative, isDir) {
      var rel = String(relative || ".");
      // DSH's reference grammar has no escape syntax for quotes or controls.
      if (/[\u0000-\u001f\u007f-\u009f"]/.test(rel)) return null;
      if (rel === ".") rel = "./";
      if (isDir && rel.charAt(rel.length - 1) !== "/") rel += "/";
      if (/\s/.test(rel)) return '@"' + rel + '"';
      return "@" + rel;
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return Promise.reject(new Error("clipboard unavailable"));
    }

    function composerShell(ctx, sessionId) {
      var sessions = ctx.get ? ctx.get("sessions") : ctx.sessions;
      var conversation = ctx.get ? ctx.get("conversation") : ctx.conversation;
      if (!conversation || !conversation.input) return null;
      var input = conversation.input;
      var shell = typeof input.shell === "function" ? input.shell(sessionId) : null;
      if (shell) return shell;
      var binding = sessions && sessions.binding(sessionId);
      return binding ? input.for(binding.ctx) : null;
    }

    function insertIntoComposer(ctx, sessionId, node) {
      if (!ctx || !sessionId) return "没有会话";
      var isDir = node.type === "directory";
      var mention = mentionOf(node.relative, isDir);
      if (!mention) return "此路径包含 DSH 引用不支持的引号或控制字符，请复制路径。";
      var label = node.name + (isDir ? "/" : "");
      var reference = {
        source: "reference",
        ref: mention,
        label: label,
        appearance: isDir ? "folder" : "file",
        clipboardText: mention,
      };
      try {
        var shell = composerShell(ctx, sessionId);
        if (!shell || typeof shell.insertReference !== "function") return "输入框不支持引用";
        var snap = shell.snapshot || (shell.state && shell.state.getSnapshot && shell.state.getSnapshot());
        if (!snap) return "无法读取输入框状态";
        if (snap.phase !== "plain" && snap.phase !== "claimed") return "当前不能插入引用";
        var detect = "";
        if (shell.projection && typeof shell.projection.detectText === "string") detect = shell.projection.detectText;
        else if (snap.draft === "") detect = "";
        else detect = snap.draft;
        var start = detect.length;
        var span = { start: start, end: start, draftRev: snap.draftRev };
        if (shell.insertReference(reference, span)) return "";
        if (typeof shell.insertText === "function" && shell.insertText(mention + " ", span, false)) return "";
        return "插入引用失败";
      } catch (error) {
        return error && error.message ? error.message : String(error);
      }
    }

    function ContextMenu(props) {
      var menuRef = React.useRef(null);
      var posState = React.useState(null);
      var pos = posState[0];
      var setPos = posState[1];
      React.useEffect(function () {
        var el = menuRef.current;
        if (!el) return undefined;
        var rect = el.getBoundingClientRect();
        setPos({
          left: Math.max(4, Math.min(props.x, window.innerWidth - rect.width - 4)),
          top: Math.max(4, Math.min(props.y, window.innerHeight - rect.height - 4)),
        });
        function onDown(event) {
          if (menuRef.current && !menuRef.current.contains(event.target)) props.onClose();
        }
        function onKey(event) {
          if (event.key === "Escape") props.onClose();
        }
        window.addEventListener("pointerdown", onDown, true);
        window.addEventListener("keydown", onKey, true);
        return function () {
          window.removeEventListener("pointerdown", onDown, true);
          window.removeEventListener("keydown", onKey, true);
        };
      }, [props.x, props.y, props.onClose]);
      return React.createElement(
        "div",
        {
          ref: menuRef,
          className: "dshf-context-menu",
          role: "menu",
          style: pos ? { left: pos.left, top: pos.top } : { visibility: "hidden", left: props.x, top: props.y },
          onContextMenu: function (event) { event.preventDefault(); },
        },
        props.items.map(function (item) {
          return React.createElement(
            "button",
            {
              key: item.id,
              type: "button",
              role: "menuitem",
              className: "dshf-menu-item",
              onClick: function () {
                item.onSelect();
                props.onClose();
              },
            },
            React.createElement("span", { className: "dshf-menu-label" }, item.label),
          );
        }),
      );
    }

    function TreeNode(props) {
      var node = props.node;
      var depth = props.depth;
      var active = props.active;
      var onToggle = props.onToggle;
      var onOpen = props.onOpen;
      var onMenu = props.onMenu;
      var onDragNode = props.onDragNode;
      var pad = 8 + depth * 12;
      function openMenu(event) {
        event.preventDefault();
        event.stopPropagation();
        onMenu(event.clientX, event.clientY, node);
      }
      function startDrag(event) {
        if (!event.dataTransfer) return;
        var mention = mentionOf(node.relative, node.type === "directory");
        if (!mention) { event.preventDefault(); return; }
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", mention);
        if (onDragNode) onDragNode(node);
      }
      if (node.type === "directory") {
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "button",
            {
              type: "button",
              className: "dshf-node",
              style: { paddingLeft: pad },
              draggable: !!mentionOf(node.relative, true),
              onClick: function () { onToggle(node.path); },
              onContextMenu: openMenu,
              onDragStart: startDrag,
            },
            React.createElement("span", { className: "dshf-caret" }, node.open ? "▾" : "▸"),
            React.createElement("span", { className: "dshf-name" }, node.name),
          ),
          node.open && node.children
            ? node.children.map(function (child) {
                return React.createElement(TreeNode, {
                  key: child.path,
                  node: child,
                  depth: depth + 1,
                  active: active,
                  onToggle: onToggle,
                  onOpen: onOpen,
                  onMenu: onMenu,
                  onDragNode: onDragNode,
                });
              })
            : null,
          node.open && node.truncated ? React.createElement("div", { className: "dshf-status", role: "status", style: { paddingLeft: pad + 12 } }, "目录内容过多，当前列表仅显示部分项目。") : null,
        );
      }
      var editable = node.type === "file";
      return React.createElement(
        "button",
        {
          type: "button",
          className: "dshf-node" + (active === node.path ? " dshf-selected" : ""),
          style: { paddingLeft: pad },
          draggable: editable && !!mentionOf(node.relative, false),
          disabled: !editable,
          title: editable ? node.path : "不支持打开此类型（" + node.type + "）",
          onClick: editable ? function () { onOpen(node.path); } : undefined,
          onContextMenu: openMenu,
          onDragStart: startDrag,
        },
        React.createElement("span", { className: "dshf-caret" }, ""),
        React.createElement("span", { className: "dshf-name" }, node.name),
      );
    }

    function EditorApp(props) {
      var sessionId = sessionIdOf(props);
      var useState = React.useState;
      var useEffect = React.useEffect;
      var useCallback = React.useCallback;
      if (!editorSessions.has(sessionId)) {
        editorSessions.forEach(function (cached, id) {
          if (!cached.listeners.size && !cached.saves.size && !cached.reloads.size && !cached.tabs.current.some(function (tab) { return tab.conflict || tab.content !== tab.original; })) editorSessions.delete(id);
        });
        editorSessions.set(sessionId, {
          tabs: { current: [] }, active: "", timers: new Map(), saves: new Map(), reloads: new Set(), listeners: new Set(),
        });
      }
      var sessionEditor = editorSessions.get(sessionId);
      var treeState = useState(null);
      var treeVal = treeState[0];
      var setTree = treeState[1];
      var tabsState = useState(sessionEditor.tabs.current);
      var tabsVal = tabsState[0];
      var setTabsState = tabsState[1];
      var activeState = useState(sessionEditor.active);
      var activeVal = activeState[0];
      var setActiveState = activeState[1];
      var errorState = useState("");
      var errorVal = errorState[0];
      var setError = errorState[1];
      var noticeState = useState("");
      var noticeVal = noticeState[0];
      var setNotice = noticeState[1];
      var savingState = useState(false);
      var savingVal = savingState[0];
      var setSavingState = savingState[1];
      var rootNameState = useState("工作区");
      var rootName = rootNameState[0];
      var setRootName = rootNameState[1];
      var mdModeState = useState("source");
      var mdMode = mdModeState[0];
      var setMdMode = mdModeState[1];
      var tabsRef = sessionEditor.tabs;
      var saveTimerRef = React.useRef(sessionEditor.timers);
      var savingRef = React.useRef(sessionEditor.saves);
      function publishEditor() {
        sessionEditor.listeners.forEach(function (listener) { listener(); });
      }
      function setActive(value) {
        sessionEditor.active = typeof value === "function" ? value(sessionEditor.active) : value;
        publishEditor();
      }
      function setSaving() { publishEditor(); }
      // Saving may finish before React renders. Keep the latest draft and its
      // saved baseline together so the next request cannot reuse an old version.
      function setTabs(value) {
        var next = typeof value === "function" ? value(tabsRef.current) : value;
        tabsRef.current = next;
        publishEditor();
      }
      useEffect(function () {
        function update() {
          setTabsState(sessionEditor.tabs.current);
          setActiveState(sessionEditor.active);
          setSavingState(sessionEditor.saves.size > 0);
        }
        sessionEditor.listeners.add(update);
        update();
        return function () { sessionEditor.listeners.delete(update); };
      }, [sessionEditor]);
      var menuState = useState(null);
      var menu = menuState[0];
      var setMenu = menuState[1];
      var pluginCtx = props.pluginCtx;
      var dragNodeRef = React.useRef(null);
      var panelRef = React.useRef(null);
      var retryRef = React.useRef(null);

      var current = null;
      for (var i = 0; i < tabsVal.length; i++) {
        if (tabsVal[i].path === activeVal) current = tabsVal[i];
      }
      var dirty = current && current.content !== current.original;
      var mdFile = current && isMarkdownPath(current.path);

      var loadList = useCallback(function (rel, nodePath) {
        if (!sessionId) return Promise.resolve();
        function failed(message) {
          setError(message);
          retryRef.current = function () { loadList(rel, nodePath); };
        }
        return apiGet({ action: "list", sessionId: sessionId, path: rel || "." }).then(function (res) {
          if (!res || !res.ok) {
            failed((res && res.error) || "无法列出目录");
            return;
          }
          if (!Array.isArray(res.entries)) throw new Error("目录响应缺少 entries");
          setError("");
          retryRef.current = null;
          var children = res.entries.map(function (entry) {
            return {
              name: entry.name,
              type: entry.type,
              path: entry.path,
              relative: entry.relative,
              open: false,
              children: null,
            };
          });
          if (!nodePath) {
            setRootName(basename(res.root) || "工作区");
            setTree({
              name: basename(res.root) || res.root,
              type: "directory",
              path: res.root,
              relative: ".",
              open: true,
              children: children,
              truncated: !!res.truncated,
            });
            return;
          }
          setTree(function (prev) {
            if (!prev) return prev;
            function patch(node) {
              if (node.path === nodePath) return Object.assign({}, node, { open: true, children: children, truncated: !!res.truncated });
              if (!node.children) return node;
              return Object.assign({}, node, { children: node.children.map(patch) });
            }
            return patch(prev);
          });
        }).catch(function (error) { failed("目录加载失败：" + String(error && error.message || error)); });
      }, [sessionId]);

      useEffect(function () {
        if (!sessionId) return undefined;
        loadList(".", null);
        return undefined;
      }, [sessionId, loadList]);

      useEffect(function () {
        function acceptsDrop(event) {
          if (!dragNodeRef.current || event.defaultPrevented || !pluginCtx) return false;
          try {
            var shell = composerShell(pluginCtx, sessionId);
            var root = shell && shell.editor && shell.editor.getRootElement();
            return !!(root && root.isContentEditable && root.contains(event.target));
          } catch { return false; }
        }
        function onDragOver(event) {
          if (!acceptsDrop(event)) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        }
        function onDrop(event) {
          var node = dragNodeRef.current;
          if (!node || !acceptsDrop(event)) return;
          event.preventDefault();
          event.stopPropagation();
          dragNodeRef.current = null;
          var err = insertIntoComposer(pluginCtx, sessionId, node);
          if (err) {
            setNotice(err);
            return;
          }
          setNotice("已添加到对话");
          if (props.openView) {
            try { props.openView("chat"); } catch { /* ignore */ }
          }
        }
        function onDragEnd() {
          dragNodeRef.current = null;
        }
        window.addEventListener("dragover", onDragOver, true);
        window.addEventListener("drop", onDrop, true);
        window.addEventListener("dragend", onDragEnd, true);
        return function () {
          window.removeEventListener("dragover", onDragOver, true);
          window.removeEventListener("drop", onDrop, true);
          window.removeEventListener("dragend", onDragEnd, true);
        };
      }, [sessionId, pluginCtx, props.openView]);

      var toggleDir = useCallback(function (dirPath) {
        setTree(function (prev) {
          if (!prev) return prev;
          var target = null;
          function walk(node) {
            if (node.path === dirPath) target = node;
            (node.children || []).forEach(walk);
          }
          walk(prev);
          if (!target) return prev;
          if (target.open) {
            function close(node) {
              if (node.path === dirPath) return Object.assign({}, node, { open: false });
              if (!node.children) return node;
              return Object.assign({}, node, { children: node.children.map(close) });
            }
            return close(prev);
          }
          loadList(target.relative, dirPath);
          return prev;
        });
      }, [loadList]);

      var openFile = useCallback(function (filePath) {
        if (!sessionId) return;
        if (tabsVal.some(function (tab) { return tab.path === filePath; })) {
          setActive(filePath);
          return;
        }
        function failed(message) {
          setError(message);
          retryRef.current = function () { openFile(filePath); };
        }
        return apiGet({ action: "read", sessionId: sessionId, path: filePath }).then(function (res) {
          if (!res || !res.ok) {
            failed((res && res.error) || "无法读取文件");
            return;
          }
          if (typeof res.content !== "string" || typeof res.path !== "string" || !res.path || typeof res.version !== "string" || !res.version) throw new Error("文件响应缺少内容、路径或版本");
          setError("");
          retryRef.current = null;
          var tab = {
            path: res.path,
            relative: res.relative,
            content: res.content,
            original: res.content,
            mtimeMs: res.mtimeMs,
            version: res.version,
            conflict: false,
            saveError: "",
          };
          setTabs(function (prev) {
            if (prev.some(function (item) { return item.path === tab.path; })) return prev;
            return prev.concat([tab]);
          });
          setActive(res.path);
          if (isMarkdownPath(res.path)) setMdMode("preview");
          else setMdMode("source");
        }).catch(function (error) { failed("文件加载失败：" + String(error && error.message || error)); });
      }, [sessionId, tabsVal]);

      var savePath = useCallback(function (path, label) {
        var list = tabsRef.current;
        var tab = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i].path === path) tab = list[i];
        }
        if (!sessionId || !tab) return Promise.resolve(true);
        if (savingRef.current.has(path)) return savingRef.current.get(path);
        if (sessionEditor.reloads.has(path)) return Promise.resolve(false);
        if (tab.conflict) return Promise.resolve(false);
        if (tab.content === tab.original) return Promise.resolve(true);
        var written = tab.content;
        function failed(message, conflict) {
          setNotice(basename(path) + "：" + message);
          setTabs(function (prev) {
            return prev.map(function (item) {
              return item.path === path ? Object.assign({}, item, { saveError: message, conflict: conflict }) : item;
            });
          });
          return false;
        }
        var request = apiWrite(sessionId, path, written, tab.version).then(function (res) {
          if (!res || !res.ok) {
            return failed((res && res.error) || "保存失败", !!(res && (res.code === "FS_STALE_VERSION" || res.code === "FS_NOT_OBSERVED")));
          }
          if (typeof res.version !== "string" || !res.version) throw new Error("保存响应缺少有效版本，本地内容仍未确认保存");
          setNotice((label || "已自动保存") + " " + basename(path));
          setTabs(function (prev) {
            return prev.map(function (item) {
              if (item.path !== path) return item;
              return Object.assign({}, item, { original: written, version: res.version, saveError: "", conflict: false });
            });
          });
          savingRef.current.delete(path);
          return savePath(path, label);
        }).catch(function (err) {
          return failed(String(err), false);
        }).finally(function () {
          if (savingRef.current.get(path) === request) savingRef.current.delete(path);
          setSaving();
        });
        savingRef.current.set(path, request);
        setSaving();
        return request;
      }, [sessionId]);

      var scheduleAutosave = useCallback(function (path) {
        if (saveTimerRef.current.has(path)) clearTimeout(saveTimerRef.current.get(path));
        saveTimerRef.current.set(path, setTimeout(function () {
          saveTimerRef.current.delete(path);
          savePath(path, "已自动保存");
        }, 450));
      }, [savePath]);

      var flushAutosave = useCallback(function (path, label) {
        if (saveTimerRef.current.has(path)) {
          clearTimeout(saveTimerRef.current.get(path));
          saveTimerRef.current.delete(path);
        }
        return savePath(path, label || "已保存");
      }, [savePath]);

      var closeFile = useCallback(function (path) {
        return flushAutosave(path, "已保存").then(function (saved) {
          var tab = tabsRef.current.find(function (item) { return item.path === path; });
          if (!saved || (tab && (tab.content !== tab.original || tab.conflict))) return;
          var next = tabsRef.current.filter(function (item) { return item.path !== path; });
          setTabs(next);
          setActive(function (active) { return active === path ? (next.length ? next[next.length - 1].path : "") : active; });
        });
      }, [flushAutosave]);

      var reloadFile = useCallback(function (path, discardConfirmed) {
        var tab = tabsRef.current.find(function (item) { return item.path === path; });
        if (!tab || savingRef.current.has(path) || sessionEditor.reloads.has(path)) return;
        if (tab.content !== tab.original && !discardConfirmed) {
          setTabs(function (prev) {
            return prev.map(function (item) { return item.path === path ? Object.assign({}, item, { reloadPrompt: true }) : item; });
          });
          return;
        }
        if (saveTimerRef.current.has(path)) {
          clearTimeout(saveTimerRef.current.get(path));
          saveTimerRef.current.delete(path);
        }
        sessionEditor.reloads.add(path);
        setTabs(function (prev) {
          return prev.map(function (item) { return item.path === path ? Object.assign({}, item, { reloading: true }) : item; });
        });
        var draft = tab.content;
        function failed(message) {
          setNotice(message);
          setTabs(function (prev) {
            return prev.map(function (item) { return item.path === path ? Object.assign({}, item, { saveError: message }) : item; });
          });
        }
        apiGet({ action: "read", sessionId: sessionId, path: path }).then(function (res) {
          if (!res || !res.ok) { failed("重新加载失败，本地内容仍保留：" + ((res && res.error) || "无法读取文件")); return; }
          if (typeof res.content !== "string" || typeof res.version !== "string" || !res.version) throw new Error("文件响应缺少内容或版本");
          var latest = tabsRef.current.find(function (item) { return item.path === path; });
          if (!latest || latest.content !== draft || latest.original !== tab.original || latest.version !== tab.version) { setNotice("读取期间本地内容发生变化，已取消重新加载"); return; }
          setTabs(function (prev) {
            return prev.map(function (item) {
              return item.path === path ? Object.assign({}, item, { content: res.content, original: res.content, version: res.version, conflict: false, saveError: "", reloadPrompt: false }) : item;
            });
          });
          setNotice("已重新加载 " + basename(path));
        }).catch(function (error) { failed("重新加载失败，本地内容仍保留：" + String(error && error.message || error)); }).finally(function () {
          sessionEditor.reloads.delete(path);
          setTabs(function (prev) {
            return prev.map(function (item) { return item.path === path ? Object.assign({}, item, { reloading: false }) : item; });
          });
          var latest = tabsRef.current.find(function (item) { return item.path === path; });
          if (latest && latest.content !== draft && latest.content !== latest.original && !latest.conflict) scheduleAutosave(path);
        });
      }, [sessionId]);

      var save = useCallback(function () {
        if (!current) return;
        flushAutosave(current.path, "已保存");
      }, [current, flushAutosave]);

      useEffect(function () {
        function onKey(event) {
          if (event.defaultPrevented || event.isComposing || !panelRef.current || !panelRef.current.contains(event.target) || !current) return;
          if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
            event.preventDefault();
            save();
          }
          if ((event.metaKey || event.ctrlKey) && event.altKey && !event.shiftKey && event.key.toLowerCase() === "m") {
            if (current && isMarkdownPath(current.path)) {
              event.preventDefault();
              setMdMode(function (prev) { return prev === "preview" ? "source" : "preview"; });
            }
          }
        }
        window.addEventListener("keydown", onKey);
        return function () { window.removeEventListener("keydown", onKey); };
      }, [save, current]);

      useEffect(function () {
        return function () {
          saveTimerRef.current.forEach(function (timer) { clearTimeout(timer); });
          saveTimerRef.current.clear();
          var list = tabsRef.current;
          for (var i = 0; i < list.length; i++) {
            if (list[i].content !== list[i].original) savePath(list[i].path, "已自动保存");
          }
        };
      }, [savePath]);

      if (!sessionId) {
        return React.createElement("div", { className: "dshf-editor-view" },
          React.createElement("div", { className: "dshf-empty" }, "没有会话，无法定位工作区。"));
      }

      var treePane = React.createElement(
        "div",
        { className: "dshf-root" },
        React.createElement(
          "div",
          { className: "dshf-toolbar" },
          React.createElement("span", { className: "dshf-title", title: treeVal && treeVal.path }, rootName),
          React.createElement("span", { className: "dshf-spacer" }),
          React.createElement("button", {
            type: "button",
            className: "dshf-btn dshf-btn-icon",
            title: "刷新",
            onClick: function () { loadList(".", null); },
          }, "↻"),
        ),
        errorVal ? React.createElement("div", { className: "dshf-error", role: "alert" }, errorVal,
          React.createElement("button", { type: "button", className: "dshf-btn", onClick: function () { if (retryRef.current) retryRef.current(); } }, "重试")) : null,
        React.createElement(
          "div",
          { className: "dshf-tree-pane" },
          treeVal
            ? React.createElement(TreeNode, {
                node: treeVal,
                depth: 0,
                active: activeVal,
                onToggle: toggleDir,
                onOpen: openFile,
                onMenu: function (x, y, node) { setMenu({ x: x, y: y, node: node }); },
                onDragNode: function (node) { dragNodeRef.current = node; },
              })
            : React.createElement("div", { className: "dshf-empty" }, errorVal ? "目录未加载，请重试。" : "加载目录…"),
        ),
        React.createElement("div", { className: "dshf-status" }, noticeVal || ""),
        menu
          ? React.createElement(ContextMenu, {
              x: menu.x,
              y: menu.y,
              onClose: function () { setMenu(null); },
              items: [
                {
                  id: "add",
                  label: "添加到对话",
                  onSelect: function () {
                    var err = insertIntoComposer(pluginCtx, sessionId, menu.node);
                    if (err) {
                      setNotice(err);
                      return;
                    }
                    setNotice("已添加到对话");
                    if (props.openView) {
                      try { props.openView("chat"); } catch { /* ignore */ }
                    }
                  },
                },
                {
                  id: "copy",
                  label: "复制路径",
                  onSelect: function () {
                    copyText(menu.node.path).then(function () {
                      setNotice("已复制路径");
                    }).catch(function () {
                      setNotice("复制失败");
                    });
                  },
                },
                {
                  id: "reveal",
                  label: "在访达中打开",
                  onSelect: function () {
                    apiPost({ action: "reveal", sessionId: sessionId, path: menu.node.path }).then(function (res) {
                      setNotice(res && res.ok ? "已在访达中打开" : ((res && res.error) || "无法打开访达"));
                    }).catch(function (err) {
                      setNotice(String(err));
                    });
                  },
                },
              ],
            })
          : null,
      );

      var editorBody = null;
      if (!current) {
        editorBody = React.createElement("div", { className: "dshf-empty" }, "在左侧打开一个文件");
      } else if (mdFile && mdMode === "preview") {
        editorBody = React.createElement(MarkdownPreview, { content: current.content, path: current.path });
      } else {
        editorBody = React.createElement(CodeEditor, {
          key: current.path,
          path: current.path,
          value: current.content,
          onChange: function (value) {
            var path = current.path;
            setTabs(function (prev) {
              return prev.map(function (tab) {
                if (tab.path !== path) return tab;
                return Object.assign({}, tab, { content: value });
              });
            });
            scheduleAutosave(path);
          },
        });
      }

      var editor = React.createElement(
        "div",
        { className: "dshf-editor-view" },
        React.createElement(
          "div",
          { className: "dshf-editor-toolbar" },
          React.createElement("span", { className: "dshf-title" }, "文件"),
          current
            ? React.createElement("span", { className: "dshf-tabname" + (dirty ? " dshf-dirty" : "") },
                (dirty ? "● " : "") + basename(current.path))
            : null,
          React.createElement("span", { className: "dshf-spacer" }),
          current
            ? React.createElement("span", { className: "dshf-editor-path", title: current.path }, current.path)
            : null,
          mdFile
            ? React.createElement("button", {
                type: "button",
                className: "dshf-btn dshf-md-toggle",
                title: mdMode === "preview" ? "显示源码 (⌘/Ctrl+Alt+M)" : "显示预览 (⌘/Ctrl+Alt+M)",
                onClick: function () { setMdMode(mdMode === "preview" ? "source" : "preview"); },
              }, mdMode === "preview" ? "源码" : "预览")
            : null,
          React.createElement("button", {
            type: "button",
            className: "dshf-btn",
            disabled: !dirty || !!(current && (current.conflict || current.reloading)) || savingRef.current.has(current && current.path),
            title: "立即保存 (⌘S)。输入停顿后会自动保存。",
            onClick: save,
          }, "保存"),
          current
            ? React.createElement("button", {
                type: "button",
                className: "dshf-btn",
                title: "关闭文件",
                onClick: function () { closeFile(current.path); },
              }, "✕")
            : null,
        ),
        React.createElement(
          "div",
          { className: "dshf-status dshf-status-top" },
          React.createElement(
            "span",
            { className: "dshf-tabs-strip" },
            tabsVal.map(function (tab) {
              return React.createElement(
                "span",
                {
                  key: tab.path,
                  className: "dshf-tab-chip" + (tab.path === activeVal ? " dshf-tab-chip-active" : ""),
                  title: tab.path,
                },
                React.createElement("button", {
                  type: "button",
                  className: "dshf-tab-chip-name",
                  onClick: function () {
                    if (current) flushAutosave(current.path, "已自动保存");
                    setActive(tab.path);
                  },
                }, basename(tab.path) + (tab.content !== tab.original ? " •" : "")),
                React.createElement("button", {
                  type: "button",
                  className: "dshf-tab-chip-close",
                  onClick: function (event) {
                    event.stopPropagation();
                    closeFile(tab.path);
                  },
                }, "✕"),
              );
            }),
          ),
          React.createElement("span", { className: "dshf-status-meta" },
            current && current.reloading ? "正在重新加载…" : current && current.conflict ? "保存冲突，自动保存已暂停" : savingVal ? "正在保存…" : (current && current.saveError ? "保存失败，内容仍未保存" : dirty ? "等待自动保存…" : noticeVal)),
        ),
        current && current.saveError ? React.createElement("div", { className: "dshf-error", role: "alert" },
          current.saveError,
          React.createElement("button", { type: "button", className: "dshf-btn", onClick: function () {
            copyText(current.content).then(function () { setNotice("已复制本地内容"); }).catch(function () { setNotice("复制失败，本地内容仍保留"); });
          } }, "复制本地内容"),
          React.createElement("button", { type: "button", className: "dshf-btn", disabled: current.reloading || savingRef.current.has(current.path), onClick: function () { reloadFile(current.path); } }, "重新加载"),
          current.reloadPrompt ? React.createElement("div", null,
            "重新加载将丢弃本地未保存内容，请先复制需要保留的内容。",
            React.createElement("button", { type: "button", className: "dshf-btn", disabled: current.reloading, onClick: function () { reloadFile(current.path, true); } }, "确认丢弃并重新加载"),
            React.createElement("button", { type: "button", className: "dshf-btn", disabled: current.reloading, onClick: function () {
              var path = current.path;
              setTabs(function (prev) { return prev.map(function (item) { return item.path === path ? Object.assign({}, item, { reloadPrompt: false }) : item; }); });
            } }, "取消"),
          ) : null,
        ) : null,
        editorBody,
      );

      return React.createElement("div", { className: "dshf-split", ref: panelRef }, treePane, editor);
    }

    function apply(ctx) {
      ensureStyle();
      function FilesTab(props) {
        return React.createElement(EditorApp, Object.assign({}, props, { pluginCtx: ctx, key: sessionIdOf(props) }));
      }
      ctx.effect(function () {
        return ctx.sidebarRightTabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          priority: "extension",
          title: function () { return "文件"; },
          guide: [{
            id: "open",
            order: 22,
            title: function () { return "文件"; },
            description: function () { return "浏览工作区并编辑文本"; },
            icon: FilesGlyph,
          }],
        });
      }, "bianji.type");
      ctx.effect(function () {
        return ctx.slots.inject("sidebar.right.pane.tab", function () {
          return ctx.slots.register(
            { name: "sidebar.right.pane.tab", key: TAB_ID },
            FilesTab,
          );
        });
      }, "bianji.body");
      ctx.effect(function () {
        return ctx.slots.inject("sidebar.right.pane.tab.title", function () {
          return ctx.slots.register(
            { name: "sidebar.right.pane.tab.title", key: TAB_ID },
            FilesTitle,
          );
        });
      }, "bianji.title");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
