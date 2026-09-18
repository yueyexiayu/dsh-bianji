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
- 二进制与过大文本会拒绝写入
- 不包含安装器、账号或凭据

## 开发

```bash
node --check lib/index.js lib/client.js lib/parse.js
node --test
```
