# bianji

当前项目是深度适配个人使用，项目只是给大家提供思路和借鉴，尽量不要直接照搬。

DeepSeek Harness 官方桌面端的工作区文件编辑器。右侧栏「开始」页增加 **文件** 入口（与官方工作区文件、浏览器并列）：左侧文件树，右侧 Monaco（失败时带行号文本框），支持 Markdown 预览、自动保存、右键添加到对话 / 复制路径 / 在访达中打开，以及拖到输入框插入 `@引用`。

面向 **官方桌面**（`connection.fetch`），不依赖 `webServer`，也不走 `dsh plugin --profile desktop`。

## 安装

复制到 `$DSH_HOME/plugins/bianji`（默认 `$DSH_HOME` 为 `~/.dsh`），在 `$DSH_HOME/profiles/desktop/cordis.patch.yml` 写入：

```yaml
- insert:
    - id: bianji
      name: ../../plugins/bianji/lib/index.js
```

完全退出 DeepSeek Harness（macOS：⌘Q）再打开。展开右侧栏，在「开始」里会出现 **文件**。

## 说明

- 读写限制在当前会话工作区 `cwd` 内
- 只支持严格 UTF-8 文本；非 UTF-8（如本次验证的 GBK 字节）、二进制与过大文件会明确拒绝打开，不做有损替换。读写接口不移除 UTF-8 BOM，不自动转换编码或换行。保存前拒绝 NUL、孤立 UTF-16 surrogate 和读端不支持的控制字节，避免保存后乱码或无法重新打开。
- POSIX（含 macOS）路径保留文件名中的 `\`，不将它转换为目录分隔符。读写继续使用官方 `fs`，并通过 `processPath()` 核对实际目标及读取前后真实路径，拒绝已复现的符号链接替换越界返回；这不是内核级原子路径隔离。
- Markdown 预览只生成经过转义的受限标签和 HTTP(S) 链接，不执行原始 HTML。编辑快捷键限于编辑区，文件拖拽引用限于聊天输入区；目录和文件请求失败显示错误并提供重试，访达启动失败不会显示成功。
- 不包含安装器、账号或凭据
- 保存复用当前会话的官方 `fs` 服务和沙箱策略；读取返回版本，保存使用 `replaceIfVersion`。外部修改、替换或删除后，旧版本保存返回冲突，不重建已删除文件。缺少版本或文件服务时明确失败，禁止无保护写入。
- 冲突会暂停该文件的自动保存，保留本地编辑内容。可先「复制本地内容」，再「重新加载」磁盘版本；重新加载需要确认丢弃未保存内容。保存失败时关闭标签不会丢弃草稿。
- 每个文件独立安排自动保存；保存期间继续输入会保留最新草稿，并用成功返回的新版本继续保存。
- 重新加载期间锁定该文件的保存与关闭；读取时继续编辑会取消过期的重载结果。
- 未保存或冲突草稿按会话保留在客户端内存中，切换会话或关闭侧栏后返回可恢复；在途保存共用状态，失败也保留草稿。完全退出应用、刷新客户端或停用插件后内存草稿不保留，退出前请复制或完成保存。

版本保护与官方 AI 文件工具共用实例和写入锁。它能拒绝保存前已发生的外部变化，但不是操作系统提供的跨进程条件写入：其他编辑器恰好在版本检查后、原子替换前写入，仍存在短暂竞争窗口。不要把这种保护理解为对任意外部写入时刻的绝对保证。

## 开发

```bash
for file in lib/*.js; do node --check "$file"; done
node --test
```

默认测试会明确跳过没有对应环境的官方安装包 / 真实浏览器测试，不能把跳过计为验收通过。

macOS 上用已安装的官方服务执行集成回归（测试只创建临时文件，不修改官方包）：

```bash
BIANJI_OFFICIAL_RUNTIME='/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh' \
ELECTRON_RUN_AS_NODE=1 '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness' \
  --test test/official-fs.test.mjs
```

真实浏览器测试使用独立 headless profile，配置已有 Playwright、Chrome 和 React 18 UMD 路径即可运行，不访问用户桌面浏览器：

```bash
BIANJI_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
BIANJI_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
BIANJI_REACT_UMD=/path/to/react/umd/react.development.js \
BIANJI_REACT_DOM_UMD=/path/to/react-dom/umd/react-dom.development.js \
  node --test test/client-security.test.mjs
```

本次在 DSH **0.2.1-alpha.1** 上实际执行：37 项 Host 回归、24 项 Client 回归、2 项真实浏览器检查（14 组 XSS payload 及 React 交互），以及 17 项官方安装包集成，全部通过且无跳过。官方集成涵盖版本保护、读写冲突、AI 编辑共用锁、只读拒写、严格编码和路径检查。

历史会话范围也用安装包服务在隔离上下文实际验证：没有 live session / agent 时，官方文件树能用持久化 header 找到工作区并列目录；本插件目前只认 live agent，会明确返回 `no workspace for this session`。本轮未扩展这部分行为。

上述浏览器检查使用模拟 API；官方服务检查使用临时上下文。这些不是已经重启加载新代码的桌面端端到端验收。Host / Client 修改后仍须完全退出并重新打开应用；刷新页面不足以更新 Host。退出前先保存或复制尚未落盘的内存草稿。
