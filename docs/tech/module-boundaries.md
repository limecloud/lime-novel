# Lime Novel 模块边界与目录建议

> 版本：0.3
> 更新：2026-04-02

---

## 1. 目标

`Lime Novel` 不是一个单纯的桌面页面项目，而是一个会快速长出代理、任务、记忆、导出、连接器和后台作业的复杂系统。

为了避免早期就滑向“大仓巨文件 + 到处互相引用”，推荐从第一天就按逻辑边界拆模块。

## 2. 推荐仓库结构

推荐采用轻量 workspace 单仓多包结构：

```text
lime-novel/
  docs/
    tech/
  apps/
    desktop/
      src/
        main/
        preload/
        renderer/
  packages/
    shared-kernel/
    domain-novel/
    application/
    agent-runtime/
    infrastructure/
```

## 3. 各模块职责

### 3.1 `apps/desktop`

负责：

- Electron 启动
- BrowserWindow 生命周期
- preload API
- React 页面与交互
- 后台运行单元调度

不负责：

- 定义小说领域对象
- 定义代理工具协议
- 实现存储细节

### 3.2 `packages/shared-kernel`

负责：

- 通用类型
- `Result` / `Option` 风格工具
- 事件 ID、时间、路径、UUID 等基础值对象
- 错误码和公共契约

限制：

- 不放业务规则
- 不放 React、Electron、LLM SDK

### 3.3 `packages/domain-novel`

负责：

- `Series`
- `Project`
- `Volume`
- `Chapter`
- `Scene`
- `Character`
- `CanonFact`
- `RevisionIssue`
- `RevisionProposal`
- `ExportTarget`

还负责：

- 状态流转规则
- 一致性校验规则
- 修订问题分类

### 3.4 `packages/application`

负责：

- 用例
- DTO
- 端口接口
- 应用服务
- 事务边界

典型目录建议：

```text
packages/application/src/
  ports/
  contracts/
  use-cases/
  dto/
  services/
  policies/
```

### 3.5 `packages/agent-runtime`

负责：

- 代理角色定义
- 会话生命周期
- 任务模型
- 技能装配
- 工具协议
- 记忆组装
- 结果标准化

典型目录建议：

```text
packages/agent-runtime/src/
  agents/
  sessions/
  tasks/
  skills/
  tools/
  memory/
  context/
  policies/
  contracts/
```

### 3.6 `packages/infrastructure`

负责：

- SQLite 仓储
- 文件仓储
- embedding 和向量索引
- 搜索与抓取适配器
- LLM provider 适配器
- 导出适配器

典型目录建议：

```text
packages/infrastructure/src/
  persistence/
  filesystem/
  llm/
  embeddings/
  search/
  exporters/
  adapters/
```

## 4. 依赖规则

### 4.1 允许的依赖

- `shared-kernel` 不依赖其他业务包
- `domain-novel` 只依赖 `shared-kernel`
- `application` 依赖 `shared-kernel` 和 `domain-novel`
- `application` 负责声明 `ports / contracts / dto`
- `agent-runtime` 依赖 `shared-kernel`、`domain-novel`，以及 `application` 暴露的 `ports / contracts / dto`
- `infrastructure` 实现 `application` 与 `agent-runtime` 所声明的端口
- `apps/desktop` 负责组装所有包

### 4.2 禁止的依赖

- `domain-novel -> application`
- `domain-novel -> agent-runtime`
- `domain-novel -> infrastructure`
- `application -> electron/react`
- `application -> agent-runtime` 的具体实现
- `agent-runtime -> react`
- `agent-runtime -> application/use-cases`
- `renderer -> infrastructure` 的具体实现

## 5. `apps/desktop` 内部结构

推荐结构如下：

```text
apps/desktop/src/
  main/
    app/
    composition-root/
    windows/
    ipc/
    workers/
    storage/
  preload/
    api/
    types/
  renderer/
    app/
    pages/
    widgets/
    features/
    entities/
    shared/
```

## 6. renderer 侧组织建议

### 6.1 `pages`

承接路由级工作面：

- 首页
- 写作
- 设定
- 修订
- 发布

### 6.2 `features`

承接独立业务能力：

- `chapter-tree`
- `editor`
- `ai-sidebar`
- `agent-feed`
- `approval-bar`
- `canon-cards`
- `revision-queue`
- `export-sheet`

### 6.3 `entities`

承接前端展示模型与 selector：

- `chapter`
- `canon`
- `issue`
- `proposal`
- `agent-task`

### 6.4 `shared`

承接：

- hooks
- ui primitives
- query keys
- formatter
- view model helper

### 6.5 `widgets`

承接跨页面复用但不承载业务决策的结构化组合件：

- `agent-header-card`
- `task-card`
- `evidence-card`
- `proposal-card`
- `diff-card`
- `memory-chip`

## 7. 组合根

整个系统的组合根应放在 `apps/desktop` 的 main 侧，而不是 renderer。

组合根负责：

- 创建仓储实现
- 创建 LLM provider
- 创建 Agent Runtime
- 注册工具与技能
- 注入到 IPC handlers 或后台任务管理器

建议固定到：

- `apps/desktop/src/main/composition-root`

这样 renderer 永远只看到：

- typed API
- query response DTO
- task event stream

## 8. 状态边界建议

renderer 侧建议继续拆成三层状态：

- `Query Cache`
  - 项目摘要、章节文档、设定卡、问题列表、导出记录
- `Agent Feed Store`
  - 任务快照、任务事件、证据、提议、审批请求
- `Local UI State`
  - 右栏视图、当前选中问题、焦点模式、抽屉展开状态

三层之间只允许通过明确的 selector 和 action 交互，不允许互相偷写。

## 9. 模块命名建议

建议使用稳定、可迁移的名称，不用临时页面语义。

推荐：

- `chapter-agent`
- `canon-sync`
- `revision-review`
- `publish-export`
- `project-memory`

避免：

- `chat2`
- `newNovelPanel`
- `writer-ai-box`
- `storyHelperFinal`

## 10. 模块边界检查

建议尽早建立三类检查：

- TypeScript path alias 约束
- ESLint import boundary 规则
- 每个 package 自己的入口导出清单

目标是让“跨层偷依赖”在代码评审前就被阻止。
