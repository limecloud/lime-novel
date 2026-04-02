# Lime Novel 总体架构

> 版本：0.3
> 更新：2026-04-02

---

## 1. 架构目标

`Lime Novel` 的目标不是做一个“带聊天侧栏的编辑器”，而是做一个“作品工作台 + 代理运行时”的复杂桌面系统。

这意味着架构必须同时满足五类要求：

- 支持长篇作品的长期演进
- 支持多代理并发协作
- 支持本地优先与跨平台桌面壳
- 支持大体量项目的索引、记忆和压缩
- 支持未来逐步增加远程运行和连接器，而不破坏当前主链

## 2. 系统全景

可以把系统看成六层：

```text
用户交互层
  小说工作面、代理协作栏、系统反馈

应用编排层
  创建项目、续写章节、提炼设定、修订问题、导出发布

小说领域层
  Series、Project、Volume、Chapter、Scene、Canon、Issue、Proposal、Export

代理运行时层
  Coordinator、Specialist Agents、Task、Skill、Tool、Memory

基础设施层
  SQLite、文件仓库、Embedding、搜索、LLM Provider、导出器

桌面平台层
  Electron Main、Preload、Renderer、Worker、系统 API
```

## 3. 核心判断

### 3.1 双中枢

系统存在两个中枢，但职责不同：

- `作品中枢`
  - 负责作品对象
  - 包含章节、设定、修订与发布资产
- `代理中枢`
  - 负责理解意图、拆分任务、调度技能、回写结果

产品前台围绕作品中枢组织，后台运行围绕代理中枢组织。

### 3.2 领域优先

`Chapter`、`Character`、`Timeline`、`RevisionIssue` 这些对象必须先成为独立领域模型，然后代理才能围绕它们工作。

不允许出现下面的倒挂：

- 用 prompt 代替领域规则
- 用消息列表代替章节状态
- 用工具输出代替正式作品资产

### 3.3 本地优先

即使后续引入云端运行，`Lime Novel` 仍然默认是本地优先系统：

- 用户作品可以脱离服务端存在
- 正文、设定、修订和导出资产可本地保存与备份
- 索引与缓存本地可重建
- 用户密钥不进入 renderer

### 3.4 状态分层

前端与运行时状态必须拆成三层，而不是堆进一个统一 store：

- `项目状态`
  - 作品对象的异步资源态
  - 包含项目摘要、章节文档、设定卡、修订问题、导出记录
- `代理任务状态`
  - 任务快照、事件流、证据、提议、审批请求
  - 是右栏 `建议` 与 `对话` 两种视图共享的事实源
- `UI 状态`
  - 当前工作面、右栏当前视图、焦点模式、选中对象、面板开关
  - 不应反向成为作品与任务的事实源

## 4. 分层职责

### 4.1 用户交互层

负责：

- 页面布局
- 编辑器交互
- 任务结果展示
- 证据和提议可视化
- 审批与应用动作

不负责：

- 直接执行代理
- 直接访问文件系统
- 直接持有 API 密钥

### 4.2 应用编排层

负责：

- 把用户动作翻译成用例
- 组装领域对象和运行时请求
- 调度代理运行时或直接调用基础设施
- 把结果标准化为 UI 可消费结构

典型用例：

- `ContinueChapterUseCase`
- `ExtractCanonFactsUseCase`
- `ReviewContinuityUseCase`
- `ApplyRevisionProposalUseCase`
- `PrepareExportUseCase`

### 4.3 小说领域层

负责：

- 定义实体、值对象和规则
- 定义系列、项目、卷册、章节、场景层级
- 定义章节状态流转
- 定义设定一致性规则
- 定义修订问题与提议的结构
- 定义导出资产与发布目标

它不应该依赖：

- React
- Electron
- LLM Provider
- 数据库存储实现

### 4.4 代理运行时层

负责：

- 维护代理会话
- 执行任务生命周期
- 组装上下文
- 挑选技能和工具
- 产出结构化结果
- 决定哪些结果需要审批

运行时不应该直接知道：

- 页面布局
- 组件树
- Tiptap 选区实现细节

### 4.5 基础设施层

负责：

- 文件系统读写
- 项目数据库
- 向量索引与检索
- 搜索和外部连接器
- LLM 调用
- 发布导出

基础设施通过端口接口接入应用层和运行时层。

### 4.6 桌面平台层

负责：

- 窗口生命周期
- 系统路径
- 安全边界
- 后台作业调度
- IPC
- 文件观察

桌面平台层为上层提供宿主能力，但不承载小说规则。

## 5. 依赖方向

### 5.1 编译期依赖

推荐遵守下面的编译期依赖关系：

```text
shared-kernel
  <- domain-novel
  <- application
  <- agent-runtime

domain-novel
  <- application
  <- agent-runtime

application/contracts + application/ports + application/dto
  <- agent-runtime
  <- infrastructure

apps/desktop
  <- 负责组装 application + agent-runtime + infrastructure
```

### 5.2 运行时装配

运行时的真实调用链允许是：

```text
Renderer
-> Preload Typed API
-> Main Composition Root
-> Application Use Case
-> Agent Runtime / Infrastructure
-> DTO / Task Event
-> Renderer
```

这意味着：

- `Application` 不直接导入 `Electron`
- `Application` 不直接依赖 `Agent Runtime` 的具体实现，而是依赖抽象端口
- `Agent Runtime` 只允许依赖 `application` 暴露的 `contracts / ports / dto`
- `Renderer` 不能直接依赖 `Infrastructure` 的文件、数据库和密钥实现
- 具体实现的装配统一发生在 main 侧组合根

## 6. 关键主链路

### 6.1 打开项目

```text
Renderer 打开项目
-> Application 加载 ProjectSummary
-> Infrastructure 读取项目目录与索引库
-> Agent Runtime 恢复项目总控代理状态
-> UI 渲染首页与最近任务
```

### 6.2 继续写章节

```text
用户在正文中发起续写或改写
-> Application 读取当前章节、选区、章目标、相关设定
-> Agent Runtime 组装工作记忆和上下文
-> Chapter Agent 选择技能并调用工具
-> 产出 Proposal / Evidence / Risk
-> UI 以行内提议和右栏结果卡展示
-> 用户应用或拒绝
-> Application 回写作品资产
```

### 6.3 后台设定同步

```text
章节内容变化
-> Application 触发后台 Canon Sync Task
-> Canon Agent 提取候选事实
-> Infrastructure 写入候选表与证据片段
-> UI 在设定工作面与右栏提示用户确认
```

### 6.4 修订闭环

```text
用户发起修订检查
-> Revision Agent 扫描章节、设定、时间线
-> 生成 RevisionIssue 列表
-> 对每个 Issue 生成一个或多个 Proposal
-> UI 展示问题队列、差异对照与审批动作
-> 用户应用后回写章节与问题状态
```

## 7. 质量属性

### 7.1 可解释

任何自动改写都必须带：

- 原因
- 证据
- 影响范围
- 可回退结果

### 7.2 可恢复

代理任务失败时，作品资产不能损坏；任务可以重试，索引可以重建。

### 7.3 可扩展

新增一个代理、技能或导出器时，不应要求重写主工作台。

### 7.4 可裁剪

即使后续不做远程代理，当前架构也不应该被远程能力绑死。

### 7.5 状态一致

同一条后台结果必须同时服务：

- 右栏 `建议` 视图
- 右栏 `对话` 视图
- 问题队列、设定候选、导出预检等对象工作面

不允许把同一个任务结果拆成多套互不同步的状态副本。

## 8. 架构禁区

以下做法应明确禁止：

- 把所有状态塞进一个巨型 renderer store
- 把代理运行时放进 React 组件树内部
- 让 renderer 直接访问 SQLite、文件系统和密钥
- 用消息列表充当章节、设定、问题的事实源
- 让自动改写直接覆盖正文而不经过提议层
- 让 `建议` 与 `对话` 各自维护一套独立任务状态

## 9. 当前推荐技术栈

| 层 | 推荐 |
| --- | --- |
| 桌面壳 | Electron + electron-vite |
| UI | React + TypeScript |
| 编辑器 | Tiptap |
| 异步资源态 | TanStack Query |
| 轻量 UI 状态 | 自定义 store 或极轻 Zustand |
| 持久索引 | SQLite |
| 向量检索 | 项目级 embedding index |

## 10. 首期范围收敛

为了和当前 `prd` 中的阶段路线图保持一致，技术方案首期应优先服务下面主链：

- 统一工作壳
- 首页工作面
- 写作工作面
- 右栏双态协作协议
- 项目总控代理
- 章节代理
- 基础设定代理
- 基础修订代理
- 章节记忆、设定提取、问题队列
- Markdown / PDF / EPUB 导出

首期暂不主动扩展：

- 开放式技能市场
- 过多代理类型
- 多人实时协作
- 重云端依赖
- 满屏工程调试入口
| 后台作业 | Electron utility process 或 worker threads |
