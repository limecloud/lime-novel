# Lime Novel

Lime Novel 是一个面向长篇小说创作的 AI Agent 桌面工作台，围绕“写作、设定、修订、发布”四条主链，把正文编辑器、章节代理、设定记忆和发布整理收在同一套本地优先的 Electron 桌面壳里。

当前仓库版本基线已提升到 `0.3.0`，并补齐了适合桌面应用的发布流水线：

- `Quality`：面向 `pull_request`、`push main` 和手动触发的持续集成校验
- `Release`：面向 `v*.*.*` tag 或手动触发的跨平台桌面构建与 GitHub Draft Release

## 技术栈

- `Electron + React + TypeScript`
- `electron-vite`
- `Tiptap Headless`
- `TanStack Query`
- 本地优先的项目工作区与代理运行时

## 仓库结构

- `apps/desktop`
  Lime Novel 桌面端主进程、preload 与 renderer
- `packages/application`
  应用用例、DTO、端口协议
- `packages/domain-novel`
  小说领域模型与业务语义
- `packages/agent-runtime`
  代理任务、记忆与运行时编排
- `packages/infrastructure`
  本地数据、文件系统和项目初始化
- `docs/prd`
  产品与交互事实来源
- `docs/tech`
  技术架构文档

## 本地开发

```bash
npm ci
npm run dev
```

常用校验命令：

```bash
npm run typecheck
npm run verify:local
npm run verify:gui-smoke
```

## Live Agent 配置

当前 `agent-runtime` 支持两条执行路径：

- `legacy`
  不配置模型时，继续使用仓库内置的规则型本地 runtime
- `anthropic`
  对齐 CC 的 Claude / Anthropic messages + tool use 主链
- `openai-compatible`
  配置模型后，启用真实的单代理 + tool calling 执行内核

最小配置示例：

```bash
export LIME_NOVEL_AGENT_PROVIDER=anthropic
export LIME_NOVEL_AGENT_API_KEY=your_anthropic_key
export LIME_NOVEL_AGENT_MODEL=claude-sonnet-4-6
```

```bash
export LIME_NOVEL_AGENT_PROVIDER=openai-compatible
export LIME_NOVEL_AGENT_BASE_URL=https://api.openai.com/v1
export LIME_NOVEL_AGENT_API_KEY=your_api_key
export LIME_NOVEL_AGENT_MODEL=gpt-4.1-mini
```

桌面端也可以直接在左上角品牌按钮打开“工作台设置”，在 `AI Agent 引擎` 中保存 provider / API Key / model / Base URL。保存后只影响新发起的任务，当前运行中的任务不会被中断。

可选环境变量：

- `LIME_NOVEL_AGENT_MAX_STEPS`
  单次任务最多模型轮次，默认 `6`
- `LIME_NOVEL_AGENT_MAX_TOOL_CONCURRENCY`
  只读工具最大并发数，默认 `4`
- `LIME_NOVEL_AGENT_MAX_STRUCTURED_OUTPUT_RETRIES`
  `submit_task_result` 最大尝试次数，默认 `5`
- `LIME_NOVEL_AGENT_REQUEST_TIMEOUT_MS`
  单次模型请求超时毫秒数，默认 `90000`
- `LIME_NOVEL_AGENT_TEMPERATURE`
  模型温度，默认 `0.2`

行为说明：

- 未配置上述 provider / key / base URL 时，自动走 `legacy`
- 当 `provider=anthropic` 且 `model` / `baseUrl` 留空时，默认使用 `claude-sonnet-4-6` 与 `https://api.anthropic.com/v1/messages`
- 当 `provider=openai-compatible` 且 `model` / `baseUrl` 留空时，默认使用 `gpt-4.1-mini` 与 `https://api.openai.com/v1`
- 已配置 live provider 时，任务会走真实模型调用；如果模型调用失败，任务会标记为 `failed`，不会静默伪造结果
- 当前 live agent 只实现第一阶段能力：单代理、受控 tool calling、结构化结果回流；还没有接入多代理、MCP、远端 worktree 或插件市场

桌面安装包构建命令：

```bash
npm run dist
npm run dist:mac
npm run dist:mac:arm64
npm run dist:mac:x64
npm run dist:win
npm run dist:linux
```

## 版本管理

仓库提供了统一版本同步脚本，会同时更新根包与所有 workspace 子包：

```bash
node scripts/sync-version.mjs 0.3.0
```

当前建议的发布标签是 `v0.3.0`。

## CI / CD

### Quality

文件位置：

- `.github/workflows/quality.yml`

职责：

- 安装依赖
- 执行 `npm run verify:local`
- 在 macOS 上执行 `npm run verify:gui-smoke`

### Release

文件位置：

- `.github/workflows/release.yml`

触发方式：

- 推送 tag：`v*.*.*`
- 手动触发 `workflow_dispatch`

手动触发参数：

- `tag`
  目标版本标签，例如 `v0.3.0`
- `source_ref`
  构建来源，默认 `main`
- `platform`
  `all / windows / mac / linux`

发布流程：

1. 按目标版本同步工作区 `package.json` 版本
2. 在对应平台执行 `electron-builder`
3. macOS 按 `arm64` 与 `x64` 两条独立流水线分别产出直装包
4. 上传平台产物
5. 汇总产物并创建 GitHub Draft Release

当前默认产物：

- Windows：`nsis`、`zip`
- macOS ARM64：`lime-novel-v0.3.0-macos-arm64.dmg`、`lime-novel-v0.3.0-macos-arm64.zip`
- macOS x64：`lime-novel-v0.3.0-macos-x64.dmg`、`lime-novel-v0.3.0-macos-x64.zip`
- Linux：`AppImage`、`tar.gz`

说明：

- macOS 发布链参考了 Lime 主仓库的双机型思路，分别在 Apple Silicon 与 Intel runner 上构建，避免用户下载后再做架构转换判断
- macOS 流程当前默认关闭自动代码签名发现，优先保证 unsigned 构建可产出
- 如果后续接入苹果签名、公证或 Windows 代码签名，只需要在 release workflow 里补环境变量与签名步骤

## 发版建议

本地准备：

```bash
npm ci
node scripts/sync-version.mjs 0.3.0
npm run verify:local
npm run verify:gui-smoke
```

正式发布：

```bash
git tag v0.3.0
git push origin v0.3.0
```

也可以直接在 GitHub Actions 里手动运行 `Release`，指定：

- `tag = v0.3.0`
- `source_ref = main`
- `platform = all`
