# Lime Novel 数据模型与存储策略

> 版本：0.3
> 更新：2026-04-02

---

## 1. 设计目标

`Lime Novel` 的数据层必须同时满足：

- 作者资产可见、可备份、可迁移
- 系统索引可查询、可重建、可扩展
- 代理运行可持久、可恢复、可追踪

因此推荐采用：

**用户资产文件系统为主，运行时索引和派生数据 SQLite 为辅。**

## 2. 事实源划分

### 2.1 文件系统中的事实源

适合放用户可见、可迁移、可版本管理的正式资产：

- 项目配置
- 章节正文
- 设定卡
- 时间线数据
- 导出结果

### 2.2 SQLite 中的事实源

适合放系统运行所需、可重建的结构化索引：

- 全文索引
- 候选事实
- 修订问题
- 代理任务
- 证据片段
- 记忆摘要
- 向量分块元数据

## 3. 推荐项目目录

建议每个作品项目目录采用如下结构：

```text
my-novel/
  novel.json
  manuscript/
    chapters/
      001-opening.md
      002-conflict.md
  canon/
    characters/
    locations/
    factions/
    rules/
    timeline/
  revisions/
    snapshots/
  exports/
  references/
  .lime/
    runtime/
      project.db
    embeddings/
    cache/
    logs/
```

### 3.1 隐藏运行目录命名

首期建议固定使用 `.lime/` 作为项目内隐藏运行目录。

原因是：

- 它可以承接 Lime 系列产品的底层协议命名
- 对作者可见资产没有污染
- 后续如需迁移命名，可通过 `schemaVersion` 做一次性迁移

不建议首期同时支持 `.lime/` 和 `.lime-novel/` 两套目录，否则会增加迁移和恢复复杂度。

## 4. 核心对象

### 4.1 `Series`

建议字段：

```ts
type Series = {
  seriesId: string
  title: string
  summary?: string
  status: 'planning' | 'active' | 'paused' | 'completed'
}
```

### 4.2 `Project`

建议字段：

```ts
type Project = {
  projectId: string
  title: string
  genre?: string
  premise?: string
  language: string
  status: 'planning' | 'drafting' | 'revising' | 'publishing'
  activeChapterId?: string
  seriesId?: string
}
```

### 4.3 `Volume`

卷册首期建议先作为逻辑分组存在，不强制要求独立文件目录边界。

```ts
type Volume = {
  volumeId: string
  projectId: string
  order: number
  title: string
  summary?: string
  status: 'planning' | 'drafting' | 'completed'
}
```

### 4.4 `Chapter`

建议字段：

```ts
type Chapter = {
  chapterId: string
  projectId: string
  volumeId?: string
  order: number
  title: string
  summary?: string
  status: 'idea' | 'draft' | 'reviewing' | 'revised' | 'published'
  wordCount: number
  updatedAt: string
}
```

### 4.5 `Scene`

```ts
type Scene = {
  sceneId: string
  chapterId: string
  order: number
  title?: string
  summary?: string
  goal?: string
  status: 'planned' | 'drafting' | 'completed' | 'revised'
}
```

### 4.6 `CanonCard`

统一抽象角色、地点、组织、规则等设定卡：

```ts
type CanonCard = {
  cardId: string
  projectId: string
  kind: 'character' | 'location' | 'faction' | 'rule' | 'item' | 'timeline-event'
  name: string
  summary: string
  visibility: 'confirmed' | 'candidate' | 'archived'
  sourceRefs: string[]
}
```

### 4.7 `RevisionIssue`

```ts
type RevisionIssue = {
  issueId: string
  projectId: string
  chapterId?: string
  kind: 'continuity' | 'pov' | 'pace' | 'style' | 'logic'
  severity: 'low' | 'medium' | 'high'
  status: 'open' | 'accepted' | 'ignored' | 'resolved'
  summary: string
}
```

### 4.8 `RevisionProposal`

```ts
type RevisionProposal = {
  proposalId: string
  issueId?: string
  targetType: 'chapter' | 'scene' | 'canon-card'
  targetId: string
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  diffPayload: string
}
```

### 4.9 `ApprovalRequest`

```ts
type ApprovalRequest = {
  approvalId: string
  taskId: string
  actionType: 'apply-proposal' | 'batch-update-canon' | 'export-write'
  targetRefs: string[]
  riskLevel: 'medium' | 'high'
  status: 'pending' | 'approved' | 'rejected' | 'expired'
}
```

## 5. `novel.json`

建议把项目级稳定配置放在项目根目录：

```json
{
  "schemaVersion": 1,
  "projectId": "proj_001",
  "title": "未命名长篇",
  "language": "zh-CN",
  "seriesId": null,
  "defaults": {
    "narrativePerspective": "third-limited",
    "tense": "past"
  }
}
```

## 6. SQLite 建议表

### 6.1 目录与索引

- `series_index`
- `volume_index`
- `chapter_index`
- `scene_index`
- `canon_index`
- `timeline_index`

### 6.2 运行时对象

- `agent_sessions`
- `agent_tasks`
- `agent_task_events`
- `task_artifacts`
- `approval_requests`
- `memory_snapshots`
- `evidence_snippets`
- `skill_runs`

### 6.3 修订对象

- `revision_issues`
- `revision_proposals`
- `proposal_applications`

### 6.4 检索对象

- `document_chunks`
- `embedding_vectors`
- `search_sources`

## 7. 数据流策略

### 7.1 正文写作

正文修改的正式事实源始终是：

- `manuscript/chapters/*.md`

SQLite 只保存：

- 章节摘要
- 切片索引
- 命中设定
- 最近任务与提议
- 审批请求与任务产物索引

### 7.2 设定提取

自动提取的设定先进入候选层：

- SQLite `canon_index` 中标记为 `candidate`

用户确认后，再写入：

- `canon/*/*.md`

并同步更新：

- `task_artifacts`
- `approval_requests`
- `canon_index`

### 7.3 修订闭环

修订问题与提议先进入 SQLite：

- `revision_issues`
- `revision_proposals`

应用完成后，写回正文或设定文件，并记录应用日志。

## 8. 右栏双态的数据事实源

右栏 `建议` 与 `对话` 不应维护两份数据。

推荐做法：

- 任务生命周期进入 `agent_task_events`
- 结构化结果进入 `task_artifacts`
- 高风险动作进入 `approval_requests`

前台再从这些表与对应 DTO 投影出：

- `建议` 视图的可处理列表
- `对话` 视图的时间序列流

## 9. 版本与快照

建议建立两类快照：

### 8.1 轻快照

适用场景：

- 自动提议应用前
- 批量修订前

保存内容：

- 目标文件差异
- 触发任务 ID
- 可回退元数据

### 8.2 发布快照

适用场景：

- 导出前
- 发布前

保存内容：

- 导出版本号
- 导出配置
- 构建时间
- 产物文件列表

## 10. 索引重建策略

必须支持在以下情况下重建派生数据：

- 删除 `.lime/project.db`
- embedding 模型更新
- 章节文件结构变动
- 引用来源清理

因此要保证：

- 章节与设定文件本身足以恢复作品
- 数据库损坏不导致作品损坏
- 向量索引可完全重建

## 11. 为什么不全放 SQLite

不建议把作品正式资产全部塞进 SQLite，原因是：

- 作者难以直接迁移和备份
- Git 与外部工具不友好
- 导出和集成不自然
- 容易把运行时缓存和正式资产混为一谈

## 12. 为什么也不能只放文件

也不建议把所有运行时状态都散落成 JSON/Markdown 文件，原因是：

- 查询复杂
- 候选事实与问题难管理
- 后台任务恢复困难
- 大项目索引与检索成本过高

混合策略更适合 `Lime Novel`。
