window.__ModuleLoader__.load({
  id: "bianji",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    var inject = ["slots"];
    var API_PATH = "/api/bianji";
    var STYLE_ID = "bianji-style";
    var MONACO_VERSION = "0.52.2";
    var MONACO_MIRRORS = [
      "https://cdn.jsdelivr.net/npm/monaco-editor@" + MONACO_VERSION + "/min/vs",
      "https://unpkg.com/monaco-editor@" + MONACO_VERSION + "/min/vs",
      "https://fastly.jsdelivr.net/npm/monaco-editor@" + MONACO_VERSION + "/min/vs",
    ];

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
      ".dshf-tabs-strip { display: inline-flex; align-items: center; gap: 4px; overflow: hidden; max-width: 70%; }",
      ".dshf-tab-chip { display: inline-flex; align-items: center; gap: 2px; background: var(--dsw-alias-bg-module-platform, #ececec); border: 1px solid var(--dsw-alias-border-l3, #d0d0d0); border-radius: 6px; color: inherit; font-size: 11px; padding: 1px 2px 1px 6px; white-space: nowrap; max-width: 160px; }",
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
      return "";
    }

    function basename(path) {
      var parts = String(path || "").split(/[\\/]/);
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
        .replace(/>/g, "&gt;");
    }

    function renderInline(text) {
      var html = escapeHtml(text);
      html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      html = html.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
      return html;
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

    var monacoLoading = null;
    function ensureMonaco() {
      if (window.monaco && window.monaco.editor) return Promise.resolve(window.monaco);
      if (monacoLoading) return monacoLoading;
      monacoLoading = new Promise(function (resolve, reject) {
        var mirrors = MONACO_MIRRORS.slice();
        function tryNext() {
          if (!mirrors.length) {
            monacoLoading = null;
            reject(new Error("monaco unavailable"));
            return;
          }
          var base = mirrors.shift();
          var el = document.createElement("script");
          el.src = base + "/loader.js";
          el.async = true;
          el.onload = function () {
            try {
              window.require.config({ paths: { vs: base } });
              window.require(["vs/editor/editor.main"], function () {
                resolve(window.monaco);
              }, function () {
                tryNext();
              });
            } catch {
              tryNext();
            }
          };
          el.onerror = function () { tryNext(); };
          document.head.appendChild(el);
        }
        tryNext();
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
        var editor = window.monaco.editor.create(hostRef.current, {
          value: props.value,
          language: languageOf(props.path),
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
        editor.onDidChangeModelContent(function () {
          onChangeRef.current(editor.getValue());
        });
        editorRef.current = editor;
        return function () {
          editor.dispose();
          editorRef.current = null;
        };
      }, [mode, props.path]);

      if (mode === "loading") {
        return React.createElement("div", { className: "dshf-empty" }, "加载编辑器…");
      }
      if (mode === "monaco") {
        return React.createElement("div", { className: "dshf-monaco", ref: hostRef });
      }
      return React.createElement(LinedTextarea, { value: props.value, onChange: function (event) { props.onChange(event.target.value); } });
    }

    function MarkdownPreview(props) {
      var html = React.useMemo(function () { return renderMarkdown(props.content); }, [props.content]);
      return React.createElement("div", {
        className: "dshf-md-preview",
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

    function apiGet(params) {
      return fetch(API_PATH + "?" + new URLSearchParams(params).toString()).then(function (res) {
        return res.json();
      });
    }

    function apiWrite(sessionId, path, content) {
      return fetch(API_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "write", sessionId: sessionId, path: path, content: content }),
      }).then(function (res) {
        return res.json();
      });
    }

    function apiPost(body) {
      return fetch(API_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (res) {
        return res.json();
      });
    }

    function mentionOf(relative, isDir) {
      var rel = String(relative || ".").replace(/\\/g, "/");
      if (rel === ".") rel = "./";
      if (isDir && rel.charAt(rel.length - 1) !== "/") rel += "/";
      if (/[\s"']/.test(rel)) return '@"' + rel.replace(/"/g, '\\"') + '"';
      return "@" + rel;
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return Promise.reject(new Error("clipboard unavailable"));
    }

    function insertIntoComposer(ctx, sessionId, node) {
      if (!ctx || !sessionId) return "没有会话";
      var isDir = node.type === "directory";
      var mention = mentionOf(node.relative, isDir);
      var label = node.name + (isDir ? "/" : "");
      var reference = {
        source: "reference",
        ref: mention,
        label: label,
        appearance: isDir ? "folder" : "file",
        clipboardText: mention,
      };
      try {
        var sessions = ctx.get ? ctx.get("sessions") : ctx.sessions;
        var conversation = ctx.get ? ctx.get("conversation") : ctx.conversation;
        if (!sessions || !conversation || !conversation.input) return "输入框服务不可用";
        var input = conversation.input;
        var shell = typeof input.shell === "function" ? input.shell(sessionId) : null;
        if (!shell) {
          var binding = sessions.binding(sessionId);
          if (!binding) return "找不到会话";
          shell = input.for(binding.ctx);
        }
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
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", mentionOf(node.relative, node.type === "directory"));
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
              draggable: true,
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
        );
      }
      return React.createElement(
        "button",
        {
          type: "button",
          className: "dshf-node" + (active === node.path ? " dshf-selected" : ""),
          style: { paddingLeft: pad },
          draggable: true,
          onClick: function () { onOpen(node.path); },
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
      var treeState = useState(null);
      var treeVal = treeState[0];
      var setTree = treeState[1];
      var tabsState = useState([]);
      var tabsVal = tabsState[0];
      var setTabs = tabsState[1];
      var activeState = useState("");
      var activeVal = activeState[0];
      var setActive = activeState[1];
      var errorState = useState("");
      var errorVal = errorState[0];
      var setError = errorState[1];
      var noticeState = useState("");
      var noticeVal = noticeState[0];
      var setNotice = noticeState[1];
      var savingState = useState(false);
      var savingVal = savingState[0];
      var setSaving = savingState[1];
      var rootNameState = useState("工作区");
      var rootName = rootNameState[0];
      var setRootName = rootNameState[1];
      var mdModeState = useState("source");
      var mdMode = mdModeState[0];
      var setMdMode = mdModeState[1];
      var tabsRef = React.useRef(tabsVal);
      tabsRef.current = tabsVal;
      var saveTimerRef = React.useRef(null);
      var savingRef = React.useRef(false);
      var pendingPathRef = React.useRef(null);
      var menuState = useState(null);
      var menu = menuState[0];
      var setMenu = menuState[1];
      var pluginCtx = props.pluginCtx;
      var dragNodeRef = React.useRef(null);

      var current = null;
      for (var i = 0; i < tabsVal.length; i++) {
        if (tabsVal[i].path === activeVal) current = tabsVal[i];
      }
      var dirty = current && current.content !== current.original;
      var mdFile = current && isMarkdownPath(current.path);

      var loadList = useCallback(function (rel, nodePath) {
        if (!sessionId) return Promise.resolve();
        return apiGet({ action: "list", sessionId: sessionId, path: rel || "." }).then(function (res) {
          if (!res || !res.ok) {
            setError((res && res.error) || "无法列出目录");
            return;
          }
          setError("");
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
            });
            return;
          }
          setTree(function (prev) {
            if (!prev) return prev;
            function patch(node) {
              if (node.path === nodePath) return Object.assign({}, node, { open: true, children: children });
              if (!node.children) return node;
              return Object.assign({}, node, { children: node.children.map(patch) });
            }
            return patch(prev);
          });
        });
      }, [sessionId]);

      useEffect(function () {
        if (!sessionId) return undefined;
        loadList(".", null);
        return undefined;
      }, [sessionId, loadList]);

      useEffect(function () {
        function onDragOver(event) {
          if (!dragNodeRef.current) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        }
        function onDrop(event) {
          var node = dragNodeRef.current;
          if (!node) return;
          var target = event.target;
          if (target && target.closest && target.closest(".dshf-split")) return;
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
        apiGet({ action: "read", sessionId: sessionId, path: filePath }).then(function (res) {
          if (!res || !res.ok) {
            setError((res && res.error) || "无法读取文件");
            return;
          }
          setError("");
          var tab = {
            path: res.path,
            relative: res.relative,
            content: res.content,
            original: res.content,
            mtimeMs: res.mtimeMs,
          };
          setTabs(function (prev) {
            if (prev.some(function (item) { return item.path === tab.path; })) return prev;
            return prev.concat([tab]);
          });
          setActive(res.path);
          if (isMarkdownPath(res.path)) setMdMode("preview");
          else setMdMode("source");
        });
      }, [sessionId, tabsVal]);

      var savePath = useCallback(function (path, label) {
        var list = tabsRef.current;
        var tab = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i].path === path) tab = list[i];
        }
        if (!sessionId || !tab || tab.content === tab.original) return Promise.resolve(true);
        if (savingRef.current) {
          pendingPathRef.current = path;
          return Promise.resolve(false);
        }
        savingRef.current = true;
        setSaving(true);
        var written = tab.content;
        return apiWrite(sessionId, path, written).then(function (res) {
          savingRef.current = false;
          setSaving(false);
          if (!res || !res.ok) {
            setNotice((res && res.error) || "保存失败");
            return false;
          }
          setNotice((label || "已自动保存") + " " + basename(path));
          var stillDirty = false;
          setTabs(function (prev) {
            return prev.map(function (item) {
              if (item.path !== path) return item;
              if (item.content !== written) {
                stillDirty = true;
                return item;
              }
              return Object.assign({}, item, { original: written, mtimeMs: res.mtimeMs });
            });
          });
          var queued = pendingPathRef.current;
          pendingPathRef.current = null;
          if (queued || stillDirty) return savePath(queued || path, label);
          return true;
        }).catch(function (err) {
          savingRef.current = false;
          setSaving(false);
          setNotice(String(err));
          return false;
        });
      }, [sessionId]);

      var scheduleAutosave = useCallback(function (path) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(function () {
          saveTimerRef.current = null;
          savePath(path, "已自动保存");
        }, 450);
      }, [savePath]);

      var flushAutosave = useCallback(function (path, label) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        return savePath(path, label || "已保存");
      }, [savePath]);

      var save = useCallback(function () {
        if (!current) return;
        flushAutosave(current.path, "已保存");
      }, [current, flushAutosave]);

      useEffect(function () {
        function onKey(event) {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            save();
          }
          if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "v") {
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
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
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
        errorVal ? React.createElement("div", { className: "dshf-error" }, errorVal) : null,
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
            : React.createElement("div", { className: "dshf-empty" }, "加载目录…"),
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
                title: mdMode === "preview" ? "显示源码 (⌘⇧V)" : "显示预览 (⌘⇧V)",
                onClick: function () { setMdMode(mdMode === "preview" ? "source" : "preview"); },
              }, mdMode === "preview" ? "源码" : "预览")
            : null,
          React.createElement("button", {
            type: "button",
            className: "dshf-btn",
            disabled: !dirty || savingVal,
            title: "立即保存 (⌘S)。输入停顿后会自动保存。",
            onClick: save,
          }, "保存"),
          current
            ? React.createElement("button", {
                type: "button",
                className: "dshf-btn",
                title: "关闭文件",
                onClick: function () {
                  var path = current.path;
                  flushAutosave(path, "已保存");
                  setTabs(function (prev) {
                    var next = prev.filter(function (item) { return item.path !== path; });
                    setActive(next.length ? next[next.length - 1].path : "");
                    return next;
                  });
                },
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
                    var path = tab.path;
                    flushAutosave(path, "已保存");
                    setTabs(function (prev) {
                      var next = prev.filter(function (item) { return item.path !== path; });
                      if (activeVal === path) setActive(next.length ? next[next.length - 1].path : "");
                      return next;
                    });
                  },
                }, "✕"),
              );
            }),
          ),
          React.createElement("span", { className: "dshf-status-meta" },
            savingVal ? "正在保存…" : (dirty ? "自动保存中…" : noticeVal)),
        ),
        editorBody,
      );

      return React.createElement("div", { className: "dshf-split" }, treePane, editor);
    }

    function apply(ctx) {
      ensureStyle();
      ctx.slots.inject("conversation.view", function () {
        return ctx.slots.register(
          { name: "conversation.view", id: "bianji", order: 25, label: "文件" },
          function (props) {
            return React.createElement(EditorApp, Object.assign({}, props, { pluginCtx: ctx }));
          },
        );
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
