# Release Notes

## v0.5.0 - 2026-05-15

本版本将 Lime Novel 从 v1 的写作/设定/修订/发布闭环，推进到 v2 的 `Novel Harness Engine / 小说驾驭引擎` 起步版本。实现重点不是增加聊天按钮，而是把长篇小说的结构诊断、改动模拟、读者反馈、时间线边界和发布锁定变成可持久化、可审计、可回流的工程事实。

### 新增

- 新增 v2 PRD：`docs/roadmap/v2/README.md`，定义 Story / Character / Reader Harness、sandbox/timeline 生命周期、小说体检、冲击波分析、A/B/C 方案、读者反馈映射、Harness Lock 和时间线迭代。
- 新增 Harness 数据契约：`DiagnosticReport`、`ImpactAnalysis`、`IntentPlan`、`ReaderFeedback`、`TimelineIteration`、`HarnessLock`。
- 新增 SQLite 表和本地 JSON 产物落盘：
  - `compiled/reports/diagnostic/`
  - `compiled/reports/impact/`
  - `compiled/reports/reader-feedback/`
  - `revisions/harness/intent-plans/`
  - `revisions/harness/timeline-iterations/`
  - `revisions/harness/locks/`
- 新增 live agent Harness 工具：
  - `generate_diagnostic_report`
  - `simulate_impact`
  - `create_intent_plan`
  - `map_reader_feedback`
  - `plan_timeline_iteration`
- 新增 legacy runtime Harness 结果生成器，让本地规则模式也能完整生成并验证五类 Harness 产物。
- 发布流程新增 Harness Lock：确认导出后记录锁定版本、已发布章节、只读边界、高风险问题和 manifest 关联。

### 变更

- 发布确认后项目生命周期切换为 `timeline`，导出章节写入 `publishedChapterRefs` / `lockedChapterRefs`，后续正文保存、提议应用和修订撤销都会拦截已发布章节写入。
- AgentFeed 继续严格使用 Agent Novel 标准 kind：`status`、`evidence`、`proposal`、`issue`、`approval`；Harness 内部的 `blocking` 风险投影到右栏时映射为 `high`。
- 首页展示 Harness 产物数量、生命周期模式、最近体检、冲击波和时间线迭代。
- 写作工作面显示当前章节 Harness 约束；timeline 只读章节禁用保存，并提示未来章节补强路径。
- 设定工作面新增 Harness 视图，提供人物状态机和伏笔链 MVP 展示。
- 发布工作面新增 Harness Lock 卡片，显示锁定状态、高风险问题、最近体检和发布后回潮入口。

### 验证

- `npm run typecheck`
- `npm run verify:runtime-smoke`
- `npm run verify:local`
- `npm run verify:gui-smoke`

### 已知边界

- v0.5.0 完成 v2 Harness 的底座与核心闭环，不包含多人协作、云同步、评论平台实时抓取或全自动连载发布。
- 人物状态机与伏笔链当前为 MVP 视图，后续版本应继续增强结构编辑、引用跳转和差异审计。
