# Lime Novel 状态与事件流架构

> 版本：0.2
> 更新：2026-04-02

---

## 1. 目标

`Lime Novel` 的复杂度不只来自代理数量，也来自状态形态的混杂。

如果不从一开始就把状态拆干净，系统很容易退化为：

- 一个巨型全局 store
- 一份既像消息流又像事实库的混合状态
- 编辑器状态、任务状态、页面状态互相污染

因此首期就应该明确三层状态和两类流。

## 2. 三层状态

### 2.1 项目状态

项目状态是作品对象的异步资源态，推荐由 `TanStack Query` 承接。

典型内容：

- 项目摘要
- 章节文档
- 设定卡列表与详情
- 修订问题列表
- 导出记录

判断标准：

- 它来自 preload API / IPC 请求
- 它有明确查询键
- 它需要缓存、失效、重取或后台同步

### 2.2 代理任务状态

代理任务状态是运行时对象，不是普通页面局部状态。

典型内容：

- 任务快照
- 任务生命周期事件
- 证据片段
- 提议结果
- 审批请求
- 风险提示

这层状态既服务右栏，也服务问题队列、设定候选、导出预检等工作面。

### 2.3 局部 UI 状态

局部 UI 状态只描述界面表现，不描述作品事实。

典型内容：

- 当前工作面
- 右栏当前视图是 `建议` 还是 `对话`
- 当前选中的问题、章节、卡片
- 焦点模式
- 结构列和右栏是否折叠

这层状态建议放在 React state 或极轻量本地 store 中。

## 3. 两类流

### 3.1 请求流

请求流适合一次性获取或提交：

```text
Renderer Action
-> Query / Mutation
-> Preload API
-> Main Handler
-> Use Case
-> DTO Result
```

典型场景：

- 打开项目
- 加载章节
- 应用提议
- 读取设定卡

### 3.2 事件流

事件流适合后台任务持续回流：

```text
Agent Runtime
-> Task Event Bus
-> Main
-> Preload Subscription
-> Agent Feed Reducer
-> Sidebar / Queue / Review Surface
```

典型场景：

- 任务开始、进度更新、完成、失败
- 证据产出
- 提议生成
- 审批请求出现
- 后台设定提取完成

## 4. 右栏双态协作协议

右栏 `建议` 与 `对话` 不是两套状态，只是同一条任务流的两种投影。

### 4.1 共享事实源

两种视图必须共享下面这些对象：

- 当前主代理
- 当前子代理任务
- 证据池
- 提议池
- 审批请求
- 风险与告警

### 4.2 视图差异

`建议` 视图关注：

- 当前最需要处理的事项
- 最新可应用提议
- 风险和审批

`对话` 视图关注：

- 时间顺序消息流
- 消息与结构化卡片混排
- 常驻输入框和继续追问

差异只发生在展示层，不发生在数据层。

### 4.3 推荐的 Feed Item 结构

```ts
type AgentFeedItem =
  | { kind: 'status'; taskId: string; createdAt: string; summary: string }
  | { kind: 'evidence'; taskId: string; evidenceId: string; createdAt: string }
  | { kind: 'proposal'; taskId: string; proposalId: string; createdAt: string }
  | { kind: 'issue'; taskId: string; issueId: string; createdAt: string }
  | { kind: 'approval'; taskId: string; approvalId: string; createdAt: string }
```

`建议` 视图从这条流中做分组与去重，`对话` 视图按时间顺序展示。

## 5. 编辑器状态隔离

Tiptap 编辑器是第四种特殊状态源，但它不应该升级为全局事实源。

建议原则：

- 编辑器实例独立封装
- 选区、输入法和事务只在编辑器子树内维护
- 提议应用通过 patch / transaction 进入编辑器
- 编辑器内容保存后，再由应用层回写章节正式资产

不要让右栏消息变化导致 editor instance 重建。

## 6. 缓存与失效

建议统一约束：

- 应用提议成功后，失效对应章节文档与问题列表
- 设定候选确认后，失效设定卡列表与相关章节摘要
- 导出完成后，失效导出记录
- 后台任务事件不要直接改写 Query Cache 的原始对象，先进入任务流，再由明确 action 触发刷新

## 7. 持久化建议

为保证重启恢复，建议持久化以下对象：

- 最近项目与最近活跃章节
- 未完成任务快照
- 任务事件简表
- 尚未处理的审批请求

局部 UI 状态只持久化少量高价值内容，例如：

- 最近工作面
- 右栏宽度
- 是否开启专注模式

## 8. 禁区

以下做法应禁止：

- 把 Query Cache 当作右栏消息流
- 把右栏消息流当作作品事实源
- 把 UI 选中态写回领域对象
- 用单一 store 同时承接编辑器状态、任务状态和项目资源态
