# Lime Novel 桌面壳架构

> 版本：0.3
> 更新：2026-04-02

---

## 1. 目标

桌面壳的目标不是“把网页包成桌面应用”，而是为小说代理系统提供一个安全、稳定、可后台运行的宿主环境。

它必须满足：

- 跨平台
- 本地文件访问
- 安全密钥存储
- 后台代理任务
- 长时间稳定运行
- 主界面不卡顿

## 2. 进程模型

推荐采用四层运行单元：

```text
Electron Main
  应用生命周期、窗口、IPC、后台作业调度

Preload
  受控桥接 API

Renderer
  React 工作台、Tiptap、TanStack Query、UI 状态

Background Workers
  代理运行时、索引、embedding、导出、重计算任务
```

### 2.1 安全基线

Electron 桌面壳默认采用以下安全基线：

- `contextIsolation: true`
- `nodeIntegration: false`
- preload 通过 `contextBridge` 暴露最小 API
- 不向 renderer 透出原始 `ipcRenderer`、文件句柄、密钥对象

## 3. Electron Main 职责

主进程只负责宿主与调度：

- 创建窗口
- 注册 IPC handler
- 管理项目级后台任务
- 管理安全存储和系统路径
- 管理文件观察与原生菜单
- 启停后台 worker

主进程不应该直接做：

- 正文渲染
- React 状态管理
- 大模型长任务执行
- embedding 重计算

## 4. Preload 职责

preload 只暴露最小 typed API，不直接暴露 Electron 原始对象。

建议形式：

```ts
type LimeNovelDesktopApi = {
  project: {
    openProject(path: string): Promise<ProjectSummaryDto>
    listRecentProjects(): Promise<ProjectSummaryDto[]>
  }
  chapter: {
    loadChapter(chapterId: string): Promise<ChapterDocumentDto>
    applyProposal(proposalId: string): Promise<ApplyProposalResultDto>
  }
  agent: {
    startTask(input: StartTaskDto): Promise<TaskHandleDto>
    getTask(taskId: string): Promise<TaskSnapshotDto>
    subscribeTaskEvents(taskId: string, cb: (event: TaskEventDto) => void): () => void
  }
}
```

补充原则：

- 请求响应优先通过 `ipcMain.handle()` / `ipcRenderer.invoke()` 风格接入
- 事件订阅通过受控回调包装，不把原始事件对象透给 renderer
- preload API 命名面向用例，不面向底层宿主实现

## 5. Renderer 职责

renderer 是工作台，不是执行器。

负责：

- 页面与组件
- 编辑器交互
- Query 缓存
- 轻量 UI 状态
- 提议和审批展示

不负责：

- 文件系统写入实现
- 密钥管理
- 后台代理编排

## 6. Background Worker 职责

建议把下面任务移出 renderer：

- 代理运行时主循环
- 章节扫描与索引
- embedding 构建
- 大体量 diff
- 导出打包

优先方案：

- Phase 1：由 main 调度 `worker_threads` 或 `child_process`
- Phase 2：对隔离和稳定性要求更高时迁移到 `utility process`

选择建议：

- `worker_threads`
  - 适合可信的 CPU 密集型任务，例如 embedding、diff、索引
- `utility process`
  - 适合需要更强隔离或更高稳定性的运行单元，例如外部连接器、风险更高的后台服务

## 7. IPC 设计原则

### 7.1 IPC 只传 DTO

不要在 IPC 边界上传：

- 领域实体实例
- 函数
- 编辑器对象
- 数据库连接

### 7.2 IPC 面向用例，不面向底层实现

推荐：

- `startRevisionReview`
- `applyProposal`
- `loadCanonCard`

避免：

- `runSql`
- `readFileDirectly`
- `invokeToolRaw`

### 7.3 事件流与请求流分离

建议分成两类：

- 请求响应型
  - 加载章节
  - 启动任务
  - 应用提议
- 订阅事件型
  - 任务进度
  - 文件变化
  - 索引完成

### 7.4 IPC 载荷收敛

每条 IPC 只允许传输：

- DTO
- 基础值对象
- 序列化安全的事件载荷

禁止把下面对象跨边界传输：

- Tiptap editor instance
- 数据库连接
- 仓储实例
- Tool 执行上下文

## 8. 路径与存储

### 8.1 用户作品路径

由用户决定项目根目录，作品资产保存在项目目录内。

### 8.2 应用级路径

通过 Electron 系统 API 获取：

- userData
- logs
- cache
- temp

不能硬编码平台路径。

### 8.3 密钥存储

API Key、OAuth token 等敏感信息必须保存在主进程可控范围：

- 优先系统安全存储
- 退化方案才是受保护本地配置

renderer 不直接拿到原始密钥值。

## 9. 文件观察

推荐对项目目录做分层观察：

- `manuscript/`
- `canon/`
- `.lime/project.db` 相关状态变更

变化处理原则：

- 正文变化触发章节重索引
- 设定变化触发 Canon 刷新
- 大批量变化走防抖和队列

## 10. UI 数据流

推荐数据流：

```text
Renderer Action
-> Query / Mutation
-> Preload API
-> Main Handler
-> Application Use Case
-> Infrastructure / Agent Runtime
-> DTO Result / Task Event
-> Query Cache Update
-> UI Re-render
```

## 11. 状态分层落地

renderer 侧建议明确落到三类状态容器：

- `TanStack Query`
  - 项目摘要、章节、设定卡、修订问题、导出记录
- `Agent Feed Store`
  - 任务快照、证据、提议、审批请求
- `Local UI State`
  - 右栏视图、抽屉开关、选中对象、专注模式

这样可以让：

- Query Cache 只管理异步资源态
- 代理任务流独立承接后台回流
- 局部 UI 态不污染作品事实源

## 12. Tiptap 集成原则

编辑器应作为独立 React 子树存在，避免父层大范围重渲染影响正文输入体验。

建议：

- 编辑器实例独立封装
- 正文内容与提议应用动作解耦
- 提议通过可控 transaction 或 patch 机制写回

不建议：

- 把整个页面状态和编辑器状态捆在一个组件里
- 每次右栏变化都重建 editor instance

## 13. TanStack Query 使用原则

推荐把以下内容视为“异步资源态”：

- 项目摘要
- 章节文档
- 设定卡列表
- 修订问题
- 任务快照
- 导出记录

以下内容视为“局部 UI 态”：

- 右栏当前视图
- 当前选中的问题
- 面板开关
- 专注模式

不要把异步资源态全部塞进单一全局 store。

TanStack Query 不是用来承接局部面板状态和右栏消息流的。

## 14. 安全边界

必须遵守：

- `contextIsolation: true`
- `nodeIntegration: false`
- 只用 preload 暴露受控 API
- 所有文件与外部连接器调用都在主进程或后台 worker
- 所有高风险写操作都通过明确用例进入

## 15. 可靠性建议

### 15.1 后台任务持久化

后台任务状态需要可恢复：

- 启动中
- 运行中
- 等待审批
- 已完成
- 已失败

### 15.2 崩溃后恢复

应用重启后至少应恢复：

- 最近项目
- 最近活跃章节
- 未处理的问题队列
- 未完成后台任务的状态

### 15.3 监控与日志

建议记录：

- 任务生命周期日志
- IPC 错误
- 文件系统异常
- LLM 请求摘要
- 导出失败原因

## 16. 首期实现建议

首期不建议做：

- 多窗口复杂协作
- 云端共享项目
- 远程代理桥接
- 实时多人编辑

首期应聚焦：

- 单窗口稳定工作台
- 本地项目目录
- 本地后台代理任务
- 提议和审批闭环
- 可重建索引
