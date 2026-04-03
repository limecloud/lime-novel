# Lime Novel

Lime Novel 是一个面向长篇小说创作的 AI Agent 桌面工作台，围绕“写作、设定、修订、发布”四条主链，把正文编辑器、章节代理、设定记忆和发布整理收在同一套本地优先的 Electron 桌面壳里。

当前仓库版本基线已提升到 `0.2.0`，并补齐了适合桌面应用的发布流水线：

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
node scripts/sync-version.mjs 0.2.0
```

当前建议的发布标签是 `v0.2.0`。

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
  目标版本标签，例如 `v0.2.0`
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
- macOS ARM64：`lime-novel-v0.2.0-macos-arm64.dmg`、`lime-novel-v0.2.0-macos-arm64.zip`
- macOS x64：`lime-novel-v0.2.0-macos-x64.dmg`、`lime-novel-v0.2.0-macos-x64.zip`
- Linux：`AppImage`、`tar.gz`

说明：

- macOS 发布链参考了 Lime 主仓库的双机型思路，分别在 Apple Silicon 与 Intel runner 上构建，避免用户下载后再做架构转换判断
- macOS 流程当前默认关闭自动代码签名发现，优先保证 unsigned 构建可产出
- 如果后续接入苹果签名、公证或 Windows 代码签名，只需要在 release workflow 里补环境变量与签名步骤

## 发版建议

本地准备：

```bash
npm ci
node scripts/sync-version.mjs 0.2.0
npm run verify:local
npm run verify:gui-smoke
```

正式发布：

```bash
git tag v0.2.0
git push origin v0.2.0
```

也可以直接在 GitHub Actions 里手动运行 `Release`，指定：

- `tag = v0.2.0`
- `source_ref = main`
- `platform = all`
