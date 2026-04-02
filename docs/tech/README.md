# Lime Novel 技术架构文档

> 版本：0.3
> 更新：2026-04-02
> 作用：为 `Lime Novel` 提供一组可直接指导实现的技术架构文档

---

## 1. 文档目标

这组文档服务于 `Lime Novel` 的技术落地，不再重复产品文案，而是回答下面几个工程问题：

- 系统应该怎么分层
- 代理运行时应该放在哪一层
- 小说领域模型和代理模型怎么解耦
- Electron 桌面壳、React 工作台、后台代理、存储层怎么分工
- 目录应该怎么拆，哪些依赖是允许的，哪些是禁止的

这组文档默认对齐下面两份上游文档：

- `../prd/lime-novel-electron-product-design.md`
- `../prd/lime-novel-ui-design.md`

它们是产品与交互的事实来源；这里的技术文档负责把这些事实翻译为实现结构。

## 2. 阅读顺序

建议按下面顺序阅读：

| 文档 | 作用 |
| --- | --- |
| [architecture-overview.md](./architecture-overview.md) | 总览系统分层、依赖方向、主链路 |
| [module-boundaries.md](./module-boundaries.md) | 定义仓库结构、模块边界与导入规则 |
| [agent-runtime.md](./agent-runtime.md) | 定义代理、任务、技能、工具与记忆系统 |
| [data-model.md](./data-model.md) | 定义项目、章节、设定、修订、发布的数据模型与存储策略 |
| [state-architecture.md](./state-architecture.md) | 定义项目状态、代理任务状态、局部 UI 状态与右栏双态协作协议 |
| [desktop-architecture.md](./desktop-architecture.md) | 定义 Electron 进程、IPC、后台作业、缓存与安全边界 |

## 3. 基线决策

当前技术架构默认采用以下基线决策：

- 桌面底座采用 `Electron + React + TypeScript`
- 正文编辑器采用 `Tiptap`
- 异步资源态采用 `TanStack Query`
- 系统采用“作品工作台”和“代理运行时”分离的双中枢结构
- 前端状态按“项目异步资源态 / 代理任务状态 / 局部 UI 态”三层组织
- 用户可见资产采用“文件系统为主、SQLite 为辅”的混合本地优先存储
- 代理运行时默认不放在 renderer，而由主进程调度后台运行单元
- Electron 安全基线固定为 `contextIsolation: true`、`nodeIntegration: false`
- preload 只暴露 typed API，不暴露原始 `ipcRenderer`

## 4. 关键术语

### 4.1 项目对象

- `Series`：系列或共享宇宙
- `Project`：单本书或单部作品
- `Volume`：卷册或项目内的逻辑分卷
- `Chapter`：章节
- `Scene`：场景
- `Canon`：设定资产，包含角色、地点、组织、规则、时间线等

### 4.2 代理对象

- `Project Coordinator`：项目总控代理
- `Chapter Agent`：章节写作代理
- `Canon Agent`：设定代理
- `Revision Agent`：修订代理
- `Publish Agent`：发布代理
- `Task`：代理执行单元
- `Skill`：可复用动作包
- `Tool`：确定性执行单元

### 4.3 数据对象

- `Memory`：代理持久记忆
- `Evidence`：证据片段
- `Proposal`：可应用提议
- `Issue`：修订问题
- `Export Job`：导出任务

## 5. 设计原则

- 作品对象优先于代理对象
- 小说领域优先于实现细节
- 后台代理优先异步执行，前台只展示可解释结果
- 领域模型不依赖 Electron、React、LLM SDK
- renderer 不能直接访问文件系统、密钥和外部连接器
- 所有自动改写都必须经过“提议 -> 比较 -> 应用”流程

## 6. 架构依据

除上游产品与 UI 文档外，这组文档还吸收了两类框架级事实：

- `Electron` 官方关于进程模型、preload / contextBridge、IPC 与安全边界的建议
- `TanStack Query` 官方关于异步资源态与局部 UI 状态边界的建议

它们主要影响以下设计判断：

- renderer 不直接接触文件系统、密钥与原始 IPC
- 请求流与事件流分离
- 项目异步资源态进入 Query Cache，本地面板开关与当前视图保留在局部 UI 态
- 后台任务结果不拆成两份状态，而是统一沉淀为同一条任务与结果流

## 7. 这组文档不做什么

这组文档暂时不覆盖下面内容：

- 视觉语言细节
- 精确像素级页面规范
- 每个按钮与快捷键的交互说明
- 模型供应商接入细节
- 云端协作与账户系统

这些内容后续应分别进入：

- 产品与 UI 文档
- API/连接器文档
- 质量与测试文档
