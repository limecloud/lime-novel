# Lime Novel 代理运行时设计

> 版本：0.3
> 更新：2026-04-02

---

## 1. 运行时目标

`Lime Novel` 的代理运行时不是一个聊天 SDK 封装层，而是系统的后台编排核心。

它必须解决下面问题：

- 用户正在写作时，谁负责主上下文
- 后台检查、提取、修订、发布如何并发执行
- 技能如何按场景挂载
- 工具如何受控执行
- 什么结果可以自动回写，什么结果必须审批
- 大上下文如何压缩与保留长期记忆

## 2. 角色模型

推荐运行时内置五类一等代理：

### 2.1 `ProjectCoordinatorAgent`

负责：

- 识别当前项目状态
- 调度其他专项代理
- 汇总后台结果
- 给出下一步建议

不负责：

- 直接做大段正文改写
- 直接维护具体设定事实

### 2.2 `ChapterAgent`

负责：

- 章节续写
- 选区改写
- 场景推进
- 风格跟随
- 章节摘要

### 2.3 `CanonAgent`

负责：

- 提取角色与设定候选
- 检查设定冲突
- 同步人物状态
- 生成时间线事件

### 2.4 `RevisionAgent`

负责：

- 连续性检查
- 视角与语气漂移检查
- 节奏问题定位
- 生成多版本修订提议

### 2.5 `PublishAgent`

负责：

- 导出预检
- 发布元数据生成
- 平台要求校验
- 导出任务编排

## 3. 运行时核心对象

### 3.1 `AgentSession`

代理会话的职责：

- 绑定一个代理角色
- 绑定一个项目上下文
- 维护当前工作记忆
- 维护任务与消息历史

建议属性：

```ts
type AgentSession = {
  sessionId: string
  agentType: 'project' | 'chapter' | 'canon' | 'revision' | 'publish'
  projectId: string
  chapterId?: string
  status: 'idle' | 'running' | 'waiting_approval' | 'completed' | 'failed'
  memorySnapshotId?: string
}
```

### 3.2 `AgentTask`

任务是代理执行单元，不是消息。

建议状态机：

```text
created
-> queued
-> running
-> waiting_approval
-> applying
-> completed
-> failed
-> cancelled
```

### 3.3 `SkillPack`

技能包是动作层，不直接面向最终用户。

建议定义：

```ts
type SkillPack = {
  skillId: string
  name: string
  appliesTo: Array<'project' | 'chapter' | 'canon' | 'revision' | 'publish'>
  triggers: string[]
  requiredTools: string[]
  buildContext: (input: SkillContextInput) => Promise<SkillContext>
  run: (ctx: SkillExecutionContext) => Promise<SkillResult>
}
```

### 3.4 `Tool`

工具必须是确定性执行单元。

建议定义：

```ts
type ToolDef<Input, Output> = {
  name: string
  description: string
  requiresApproval: boolean
  execute: (input: Input, ctx: ToolExecutionContext) => Promise<Output>
}
```

### 3.5 `TaskArtifact`

运行时对外回流的最小结果单元不应是原始模型文本，而应是结构化产物：

```ts
type TaskArtifact = {
  artifactId: string
  taskId: string
  kind: 'status' | 'evidence' | 'proposal' | 'issue' | 'approval' | 'risk'
  createdAt: string
  payloadRef: string
}
```

右栏 `建议` 与 `对话` 都应从这组产物投影，而不是各自维护私有消息状态。

## 4. 任务模型

### 4.1 前台任务

特征：

- 与当前章节或当前对象紧密相关
- 结果需要即时展示
- 通常会生成提议、证据或差异

示例：

- 续写当前段落
- 选区改写
- 对当前人物卡补全信息

### 4.2 后台任务

特征：

- 不阻塞正文写作
- 可以延迟完成
- 完成后以结果卡回流

示例：

- 设定候选提取
- 连续性扫描
- 发布打包准备

### 4.3 审批任务

必须等待人工确认后才能进入下一阶段。

示例：

- 覆盖正文
- 批量更新设定
- 删除冲突卡片
- 发布导出

## 5. 记忆系统

### 5.1 三层记忆

### 工作记忆

只服务当前任务：

- 当前章节目标
- 当前选区
- 当前任务说明
- 最近证据片段

### 章节记忆

只服务当前章节与邻近章节：

- 场景推进状态
- 已出现人物
- 已写出关键事实
- 本章未收束的问题

### 项目记忆

服务全书与系列：

- 核心设定
- 长期人物画像
- 时间线主轴
- 已确认的修订规则

### 5.2 上下文组装

推荐上下文组装顺序：

```text
任务输入
-> 当前作品对象
-> 邻近章节摘要
-> 命中的设定事实
-> 活跃问题与风险
-> 相关长期记忆
-> 当前技能上下文
```

必须避免：

- 把整个项目全文直接塞给模型
- 把所有设定卡无差别拼接
- 把旧聊天历史当唯一记忆源

## 6. 主代理与子代理隔离

`Lime Novel` 的后台运行必须支持主代理与子代理并存，但两者不能共享可变上下文。

### 6.1 隔离原则

- 主代理持有主任务连续性
- 子代理基于上下文快照执行特定任务
- 子代理默认不能直接修改正文正式事实源
- 子代理只回传结构化产物与建议动作

### 6.2 典型子代理场景

- 章节代理发起一次设定冲突检查
- 项目总控代理发起一次全书修订扫描
- 发布代理发起一次平台预检或拆章准备

### 6.3 回流原则

子代理完成后只允许回流：

- `TaskNotification`
- `Evidence`
- `Issue`
- `Proposal`
- `ApprovalRequest`

## 7. 结果模型

运行时输出不应只是一段文本，而应结构化为以下几类结果：

### 7.1 `Evidence`

包含：

- 来源对象
- 原始片段
- 命中原因
- 可信度

### 7.2 `Proposal`

包含：

- 类型
- 目标对象
- 修改内容
- 原因
- 风险
- 是否需要审批

### 7.3 `Issue`

包含：

- 问题类别
- 严重级别
- 影响范围
- 定位信息
- 支撑证据

### 7.4 `TaskNotification`

包含：

- 任务状态
- 进度摘要
- 是否已回写
- 是否仍需用户处理

### 7.5 `ApprovalRequest`

包含：

- 动作类型
- 影响对象
- 风险级别
- 触发原因
- 过期策略
- 用户确认后可执行的动作

## 8. 工具分层

建议工具分四组：

### 8.1 作品工具

- 读取章节
- 更新章节草稿
- 读取设定卡
- 写入设定候选
- 更新修订状态

### 8.2 分析工具

- 章节摘要
- 实体抽取
- 一致性检查
- 差异生成

### 8.3 连接器工具

- 搜索
- 引用抓取
- 资料导入
- 外部平台发布

### 8.4 系统工具

- 任务管理
- 日志与追踪
- 记忆压缩
- 导出执行

## 9. 协作流协议

运行时必须把一次任务的结果沉淀成统一协作流，供前台不同视图消费。

### 9.1 协议目标

- 让 `建议` 与 `对话` 共用一套结果事实源
- 让问题队列、设定候选、导出预检也能复用同一批产物
- 避免“有结果但不知道为什么来”的黑盒体验

### 9.2 协议内容

每次任务至少应能产出：

- 任务状态变化
- 证据列表
- 风险列表
- 提议列表
- 审批请求

### 9.3 协议边界

运行时负责产物标准化，不负责：

- 页面布局
- 卡片像素细节
- 右栏切换逻辑
- 编辑器选区高亮实现

这些前台决策应留给 desktop / renderer 层。

## 10. 审批与安全

以下动作默认必须审批：

- 覆盖正文
- 批量修改多个章节
- 批量修改设定资产
- 导出并写入用户指定目录
- 访问外部敏感连接器

以下动作可默认后台执行：

- 提取候选设定
- 生成章节摘要
- 生成连续性问题列表
- 生成导出预检报告

## 11. 为什么不直接照搬 ClaudeCode

`ClaudeCode` 值得借鉴的是：

- 工具抽象
- 任务生命周期
- coordinator / worker 模型
- 后台任务回流

`Lime Novel` 不应照搬的是：

- CLI/TUI 交互形态
- tmux/worktree 为中心的协作模型
- 超重入口文件
- 将所有状态压进单个运行时容器

## 12. 当前实现建议

首期建议采用：

- 一个项目总控代理
- 三个专项代理：章节、设定、修订
- 一个统一任务总线
- 一套技能注册表
- 一套提议与审批协议

发布代理与远程代理能力可以晚一阶段进入。
