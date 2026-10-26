<div align="center">
<img src="docs/repo-assets/hero.svg" width="100%" alt="bianji 工作区、草稿和版本保护的原创示意，非实际截图" />
<h1>bianji · 工作区编辑器</h1>
<p><strong>在对话旁编辑文件，让草稿与工作区保持连贯。</strong></p>
<p>DeepSeek Harness 桌面端右侧栏的文件树、Monaco 编辑与 Markdown 预览。</p>
<p><strong>简体中文</strong> · <a href="README.en.md">English</a></p>
<p><a href="package.json">v0.1.1</a> · <a href="LICENSE">MIT</a> · DSH desktop plugin</p>
<p><a href="#核心能力">核心能力</a> · <a href="#工作方式">工作方式</a> · <a href="#快速开始">快速开始</a> · <a href="#保存与边界">保存与边界</a> · <a href="#验证">验证</a></p>
</div>

---

面向个人桌面工作流的文件编辑插件，可供参考，不建议未经核对直接照搬到其他 DSH 版本。它保留独立 `kind: bianji`，不替换官方文件面板，也不是 macOS 原生 Edit 菜单。

## 核心能力

<table><tr>
<td width="33%"><strong>🗂 工作区文件树</strong><br/><br/>从当前会话解析工作区，浏览文件并在右侧打开；不为读取历史会话启动 Agent。</td>
<td width="33%"><strong>✍️ 文本与预览</strong><br/><br/>Monaco 编辑、受限 Markdown 预览；Monaco 不可用时退回带行号文本框。</td>
<td width="33%"><strong>🧾 版本保护</strong><br/><br/>读取版本并使用官方 replaceIfVersion 保存，冲突暂停自动保存而不丢弃草稿。</td>
</tr><tr>
<td><strong>🔗 对话引用</strong><br/><br/>右键添加到对话、复制路径、访达打开，或拖到输入框插入 @引用。</td>
<td><strong>💾 独立自动保存</strong><br/><br/>逐文件安排保存，在途输入保留最新草稿；失败或冲突可复制本地内容后重载。</td>
<td><strong>🛡 会话策略</strong><br/><br/>读写限定在当前工作区，并复用官方文件服务和该会话的沙箱权限。</td>
</tr></table>

## 工作方式

![会话工作区经文件服务加载为编辑草稿，保存时核对权限与文件版本。](docs/repo-assets/workflow.zh-CN.svg)

工作区来自 live Agent，或官方 `sessionController.inspect()` 的只读历史快照。保存重新解析权限，经官方文件服务及版本锁执行；不是由 Client 直接写任意磁盘路径。

## 快速开始

需要 DeepSeek Harness 官方桌面端及与其 API 兼容的环境。源码是桌面文件系统插件，不是独立网页应用。

```sh
export DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
git clone https://github.com/yueyexiayu/dsh-bianji.git "$DSH_HOME/plugins/bianji"
```

将以下项**合并**到 `$DSH_HOME/profiles/desktop/cordis.patch.yml`，不要覆盖其他插件：

```yaml
- insert:
    - id: bianji
      name: ../../plugins/bianji/lib/index.js
```

相对路径以该 profile 文件为基准。**⌘Q 完全退出 DSH 后重开**，展开右侧栏，在「开始」中打开「编辑器」。更新源码不等于正在运行的 Host 已重载。

## 保存与边界

- 严格 UTF-8：二进制、GBK 等非 UTF-8 及过大文件明确拒绝。不删除 BOM，不自动转换编码或换行；保存拒绝 NUL、孤立 surrogate 和不支持的控制字节。
- POSIX 文件名中的 `\` 保持原义；路径和真实目标需处于工作区内。检查能拒绝已复现的 symlink 替换越界，不是内核级原子隔离。
- 缺少会话/绝对 cwd 返回400，未知会话404，缺少检查服务503，历史读取损坏500；不会用空工作区掩盖错误。
- 冷历史使用未发布的 `sessions.prepare` 快照恢复该会话的权限，不 create/resume Agent，不继承 Host 的宽松权限。缺少策略或文件版本服务时拒绝保存。
- 外部改写、替换或删除会使旧版本保存冲突；不重建已删除文件。冲突保留草稿，重新加载需确认丢弃未保存内容；保存失败时关闭标签不会丢稿。
- 重载期间锁定保存与关闭，读取期间继续编辑会取消过期结果。草稿在客户端内存中按会话保留，**刷新客户端、完全退出或停用插件后不保留**，请先保存或复制。
- 版本检查与官方 AI 文件工具共用实例/写入锁，但不是操作系统跨进程条件写入；其他编辑器仍可能恰好在检查后、替换前写入。
- Markdown 仅生成转义后的受限标签和 HTTP(S) 链接，不执行原始 HTML。访达启动和目录请求失败会明确显示。

## 验证

```sh
cd "$DSH_HOME/plugins/bianji"
for file in lib/*.js; do node --check "$file" || exit 1; done
node --test
```

测试可能跳过缺少官方安装包/浏览器环境的项；跳过不能计为通过。本次更新只验证文档、图示和链接，**未重跑产品测试、未重启桌面**。

<details>
<summary><strong>官方文件服务与浏览器测试说明</strong></summary>

安装包内的真实文件服务回归只创建临时文件，不修改官方包：

```sh
BIANJI_OFFICIAL_RUNTIME='/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh' \
ELECTRON_RUN_AS_NODE=1 '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness' \
  --test test/official-fs.test.mjs
```

也可在普通 Node 中以 `BIANJI_OFFICIAL_RUNTIME` 指向只读解包参考。`test/client-security.test.mjs` 需要实际 Playwright、React/ReactDOM 18 UMD 和匹配的 Chromium headless shell；配置键为 `BIANJI_PLAYWRIGHT_MODULE`、`BIANJI_CHROMIUM_EXECUTABLE`、`BIANJI_REACT_UMD`、`BIANJI_REACT_DOM_UMD`。不要用用户 Chrome 或完整 Chrome.app 冒充无窗口验收。

旧文档记录2026-10-12在 DSH 0.2.1-alpha.2 只读参考上 bianji+jiyi 合计245项通过、无跳过，包含21项官方服务集成；这是当时跨插件的记录，不是本次重跑结果，也不等于已加载最新代码的桌面端到端验收。

</details>

## 更新与许可

更新前保存内存草稿；卸载只移除 desktop patch 中的 bianji 项，然后完全重启 DSH。仓库不包含账号、凭据或通用安装器。源码采用 [MIT License](LICENSE)。

<div align="center"><sub>编辑清楚，保存有据。 · <a href="README.en.md">Read in English →</a></sub></div>
