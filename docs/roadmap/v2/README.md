# Lime Novel v2 产品需求文档：Novel Harness Engine

> 版本：v2 PRD 草案 0.1
> 更新：2026-05-15
> 状态：待评审
> 依据：Agent Novel v0.1.2 标准、当前 `lime-novel` v0.3.0 基线、现有产品/技术文档
> 目标版本：Lime Novel v2

---

## 1. 一句话结论

Lime Novel v2 不再只是“本地优先的长篇小说 Agent 工作台”，而要升级为 **长篇小说驾驭工程系统**。

v2 的核心新增能力是 `Novel Harness Engine / 小说驾驭引擎`：像马具一样把作者意图、故事骨架、人物弧光、伏笔链、章节节奏、读者反馈和发布约束连接起来，让作者能驾驭一部长篇，而不是被长篇复杂性拖着走。

---

## 2. 背景与现状

当前 v0.3.0 基线已经完成第一阶段“可用工作台”能力：

- Electron 桌面壳与本地项目工作区。
- 写作、知识、设定、修订、发布等稳定工作面。
- `legacy`、`anthropic`、`openai-compatible` 三类 agent provider 路径。
- 单代理 task loop、tool calling、`submit_task_result` 结构化收尾。
- 工作区读取、章节读取、搜索、知识问答、proposal 保存、候选设定写入、修订问题写入。
- 知识导入到 `raw/research`，知识问答写入 `outputs/`。
- Markdown / EPUB 导出与 manifest。
- `verify:runtime-smoke` 与 GUI smoke 覆盖主要闭环。

但它仍然偏“工作台 + 代理动作”，缺少 v2 必须补齐的产品层：

- 作者无法一眼看到整部小说的结构健康状况。
- 修订仍以 issue/proposal 为主，缺少“作者意图 -> 多方案 -> 冲击波 -> 决策”的闭环。
- 发布前没有系统性的沙盘推演能力。
- 发布后没有区分“已发布不可逆历史”和“未来章节可修复空间”。
- 读者反馈还没有成为可映射、可聚合、可行动的结构证据。

v2 的目标不是多加几个 Agent 按钮，而是建立 `Harness` 层：让所有代理动作都服务于作者对长篇复杂性的驾驭。

---

## 3. 产品定位

### 3.1 它是什么

Lime Novel v2 是：

- 面向长篇、系列、连载小说作者的桌面创作系统。
- 以本地项目为事实源的 Agent 工作台。
- 以 `Novel Harness Engine` 为结构控制层的小说驾驭工程系统。
- 支持发布前沙盘诊断、发布后时间线迭代的创作副驾驶。

### 3.2 它不是什么

Lime Novel v2 不是：

- 自动替作者写完整本书的流水线。
- 只根据评论迎合读者的舆情工具。
- 把工程态 agent console 暴露给作者的调试器。
- 只会给泛泛建议的写作评审器。
- 可以静默回改已发布章节的历史改写器。

### 3.3 产品原则

| 原则 | v2 含义 |
| --- | --- |
| 作者驾驭优先 | AI 给结构、证据、方案和风险，最终方向由作者决定。 |
| 正文事实优先 | `manuscript/` 是作品本体，Harness 不直接覆盖正文。 |
| 沙盘可重构 | 发布前允许大结构调整，但必须有冲击波分析。 |
| 时间线不可逆 | 发布后已发布章节只读，修复落在未来章节。 |
| 证据可追踪 | 诊断、反馈、方案和修订都必须引用来源。 |
| 低打扰 | 后台 Harness 结果以卡片、报告、issue、proposal 回流，不抢写作焦点。 |

---

## 4. 目标用户与场景

### 4.1 核心用户

有长篇规划、追求结构精密性的网络小说作者。

典型特征：

- 作品超过 30 章或计划超过 30 万字。
- 需要同时管理人物、伏笔、设定、读者反馈和更新节奏。
- 经常遇到“感觉哪里不对，但不知道该改哪里”。
- 发布后需要回应读者争议，但不希望直接改旧章破坏连载体验。

### 4.2 扩展用户

- 剧本杀编剧。
- 互动叙事设计师。
- 多角色、多线叙事创作者。
- 需要长期维护 IP 世界观的内容团队。

### 4.3 核心用户故事

| 用户故事 | 期望结果 |
| --- | --- |
| 作为作者，我想扫描全书结构问题 | 得到小说体检报告，而不是泛泛评价。 |
| 作为作者，我想让某个人物更早显露危险感 | 得到 A/B/C 改法，并知道每种改法影响哪些章节。 |
| 作为作者，我想知道第 7 章提前揭示信息会不会破坏第 12 章反转 | 得到冲击波分析。 |
| 作为连载作者，我想回应读者说男主降智的问题 | 得到未来章节补强方案，而不是回改已发布章节。 |
| 作为作者，我想检查黄金三章是否留得住人 | 得到钩子、主角共鸣、世界沉浸、继续阅读动机的专项评估。 |

---

## 5. v2 核心能力

### 5.1 Novel Harness Engine

`Novel Harness Engine` 是 v2 的核心能力层。它由三层组成：

| Harness | 驾驭对象 | 输出 |
| --- | --- | --- |
| Story Harness | 主线、支线、章节序列、场景功能、信息释放、伏笔链 | 结构 finding、章节重排建议、伏笔回收计划、冲击波分析 |
| Character Harness | 人物目标、信念、关系、能力、创伤、转折 | 人物状态机、弧光问题、关系推进 proposal |
| Reader Harness | 黄金三章、爽点、悬念、节奏、评论反馈、弃读风险 | 读者风险、回潮声明、未来章节补强策略 |

#### 产品要求

- Harness 是工作台的结构控制层，不是独立聊天页。
- Harness 输出必须结构化：report、issue、intent plan、impact analysis、timeline iteration、proposal。
- Harness 不能绕过作者确认修改正文或 confirmed canon。
- Harness 需要能被写作、设定、修订、发布工作面调用。

---

## 6. 生命周期模式

### 6.1 沙盘模式：`sandbox`

适用于发布前。

作者可以在私有世界中推倒重建：

- 重排章节。
- 重写关键场景。
- 移动伏笔。
- 调整人物弧光。
- 改变信息释放顺序。
- 重构黄金三章。

但每次结构修改必须经过：

```text
作者意图 -> 候选方案 -> 冲击波分析 -> 作者确认 -> proposal/apply -> revision record
```

### 6.2 时间线模式：`timeline`

适用于发布后。

已发布章节进入只读边界：

- 不允许静默改剧情事实。
- 勘误级修改必须与剧情事实修改区分。
- 旧争议优先通过未来章节修复。
- 读者反馈进入 reader feedback loop。

典型修复方式：

- 回潮声明：在新章节自然回应旧争议。
- 未来桥段：用未来事件补足旧动机或关系可信度。
- 伏笔回收：将读者认为无用的元素转为后续关键线索。
- 预期重置：通过新信息调整读者对主线或角色的理解。

---

## 7. 功能需求

### 7.1 小说体检报告

#### 目标

把“感觉哪里不对”转成可定位、可排序、可修复的问题清单。

#### 范围

- 单章体检。
- 多章区间体检。
- 全书体检。
- 黄金三章专项评估。
- 人物弧光扫描。
- 伏笔完整性扫描。
- 发布前阻断项扫描。

#### 诊断维度

| 维度 | 检查问题 |
| --- | --- |
| 结构 | 主线、卷册目标、章节功能是否一致。 |
| 节奏 | 冲突密度、信息释放、情绪高低、长平段。 |
| 人物 | 目标、信念、关系、能力、创伤、转折是否有因果。 |
| 伏笔 | 是否无根、断裂、过期、可回收或重复。 |
| 信息差 | 作者、角色、读者知道的信息是否清晰区分。 |
| 连续性 | 时间线、地点、设定、物件、能力规则是否冲突。 |
| 世界观负载 | 设定解释是否压垮场景推进。 |
| 读者风险 | 弃读点、误读点、期待落空点。 |

#### 验收标准

- 每个 finding 必须有 target、evidence、severity、diagnosis、recommendation。
- 报告不能只给评分，必须能生成 issue 或 intent plan。
- 黄金三章报告必须包含钩子质量、主角共鸣、世界沉浸、继续阅读动机。

### 7.2 作者意图到多方案

#### 目标

作者输入创作意图后，系统生成可比较的 A/B/C 修订方案。

#### 输入示例

```text
让女主更早显露危险感，但不要破坏第 12 章反转。
```

#### 输出要求

每个方案包含：

- 方案摘要。
- 涉及章节/场景/设定/伏笔。
- 收益。
- 代价。
- 风险。
- 冲击波引用。
- 推荐程度。

#### 验收标准

- 至少给出两个可执行方案。
- 不能只输出单一“最佳答案”。
- 必须保留作者选择与拒绝原因。

### 7.3 冲击波分析

#### 目标

改正文前预测影响范围，避免局部改动破坏长篇结构。

#### 触发场景

- 章节提前、后移或删除。
- 关键事实提前暴露或延后暴露。
- 伏笔新增、删除、换承载章节。
- 人物关系或立场提前变化。
- 世界规则修改。
- 发布后 future fix。

#### 输出对象

- 受影响章节。
- 受影响场景。
- 受影响人物状态。
- 受影响伏笔链。
- 受影响时间线。
- 受影响 canon。
- 读者体验风险。
- 发布边界风险。

#### 验收标准

- 高风险改动必须标记 `high` 或 `blocking`。
- timeline 模式下若影响已发布事实，必须转为 future fix 建议。
- 冲击波分析必须能被 revision record 引用。

### 7.4 人物状态机

#### 目标

让人物弧光从“感觉”变成可追踪状态。

#### 状态维度

- 目标。
- 信念。
- 已知信息。
- 误判。
- 关系。
- 能力边界。
- 创伤/弱点。
- 转折事件。

#### UI 要求

- 设定工作面新增“人物状态机”视图。
- 横轴为章节或场景。
- 纵轴为状态维度。
- 支持从章节正文和 canon 反向提取候选状态。

#### 验收标准

- 能看出人物状态何时变化、为什么变化。
- 人物失真 issue 能引用状态机证据。
- 作者确认后才同步 confirmed canon。

### 7.5 伏笔链

#### 目标

让伏笔从散落笔记升级为可诊断链路。

#### 伏笔状态

- `seeded`：已埋设。
- `reinforced`：已强化。
- `misdirected`：已误导。
- `ready-to-payoff`：可回收。
- `paid-off`：已回收。
- `orphaned`：无根或失联。
- `expired`：过期或回收窗口已错过。

#### 验收标准

- 设定工作面可查看伏笔链。
- 小说体检能发现 orphaned / expired 伏笔。
- 冲击波分析能显示修改会影响哪些伏笔节点。

### 7.6 读者反馈闭环

#### 目标

将评论、吐槽、讨论、弃读信号转成结构证据。

#### 输入

- 手动粘贴评论。
- 导入平台反馈文件。
- 作者手记。
- 后续可扩展平台连接器。

#### 流程

```text
收集反馈
-> 去重与噪音过滤
-> 情绪和主题聚类
-> 映射到章节 / 人物 / 节奏 / 设定 / 伏笔
-> 生成 issue / proposal / timeline iteration
```

#### 验收标准

- 反馈是证据，不是命令。
- 能区分真实结构问题、目标读者偏好差异、误读但可利用的悬念、噪音反馈。
- timeline 模式下默认输出未来章节补强策略。

### 7.7 发布前 Harness 锁定

#### 目标

发布前给作者一份明确的“能不能发”判断。

#### 检查项

- 是否存在 blocking issue。
- 黄金三章是否低于作者设定阈值。
- confirmed canon 是否与正文冲突。
- 高风险伏笔是否无回收计划。
- 导出范围是否完整。
- 将进入只读边界的章节范围是否明确。

#### 验收标准

- 发布工作面显示 Harness Lock 卡片。
- 有阻断项时不能默认进入发布确认。
- 作者可以明确选择“延后处理并放行”，但必须留下记录。

### 7.8 发布后时间线迭代

#### 目标

让发布后修订从“偷偷改旧章”变成“用未来章节重塑过去”。

#### 输出类型

- 回潮声明。
- 未来桥段。
- 伏笔回收。
- 人物重解释。
- 预期重置。

#### 验收标准

- 已发布章节默认只读。
- 每个 timeline iteration 必须标记 readOnlyPublishedRefs 和 targetFutureRefs。
- 高 retcon 风险必须显式提示。

---

## 8. 信息架构与 UI 需求

### 8.1 首页

新增项目健康区：

- 当前 lifecycle mode。
- 最近一次小说体检摘要。
- 未解决高风险 issue。
- 当前 Harness 推荐动作。
- 发布后反馈风险摘要。

### 8.2 写作工作面

新增 Harness 侧提示：

- 当前章节叙事功能。
- 当前场景目标。
- 当前人物状态。
- 当前伏笔状态。
- 信息差提示。
- timeline 模式下已发布只读提示。

### 8.3 设定工作面

新增视图：

- 人物状态机。
- 伏笔链。
- 信息差矩阵。
- 已发布事实边界。

### 8.4 修订工作面

新增主入口：

- 小说体检。
- 意图规划。
- 冲击波分析。
- A/B/C 方案比较。
- Harness revision record。

### 8.5 发布工作面

新增发布前/发布后状态：

- Harness Lock。
- publishedChapterRefs。
- timeline mode 切换确认。
- 读者反馈导入入口。
- timeline iteration 列表。

### 8.6 右侧 Agent 栏

新增结构化卡片：

- `DiagnosticReportCard`。
- `ImpactAnalysisCard`。
- `IntentPlanCard`。
- `ReaderFeedbackCard`。
- `TimelineIterationCard`。
- `HarnessLockCard`。

---

## 9. 数据模型需求

### 9.1 `novel.json`

新增：

```ts
type NovelLifecycle = {
  mode: 'sandbox' | 'timeline'
  publishedChapterRefs?: string[]
  lockedChapterRefs?: string[]
  switchedAt?: string
}
```

```ts
type HarnessProfile = {
  profileId: string
  projectId: string
  mode: 'sandbox' | 'timeline'
  layers: Array<'story' | 'character' | 'reader'>
  constraints: string[]
  updatedAt: string
}
```

### 9.2 SQLite / runtime objects

新增或扩展表：

- `diagnostic_reports`。
- `impact_analyses`。
- `intent_plans`。
- `reader_feedback_batches`。
- `timeline_iterations`。
- `character_state_events`。
- `foreshadowing_nodes`。
- `harness_locks`。

### 9.3 文件系统输出

建议路径：

```text
outputs/
  reports/
    diagnostic/
    impact/
    reader-feedback/
revisions/
  harness/
    intent-plans/
    timeline-iterations/
canon/
  foreshadowing/
  character-states/
```

原则：

- 正式正文仍在 `manuscript/chapters/`。
- confirmed canon 仍在 `canon/`。
- Harness 产物可以在 SQLite 中索引，但应支持导出为 Markdown/JSON。
- `.lime/` 中的索引和缓存必须可重建。

---

## 10. Agent 与工具需求

### 10.1 新增 Agent 能力

| Agent | 新增职责 |
| --- | --- |
| ProjectCoordinatorAgent | 判断 lifecycle mode，调度 Harness 任务，汇总项目健康度。 |
| ChapterAgent | 读取 Harness 约束后再续写或改写。 |
| CanonAgent | 维护人物状态机、伏笔链、已发布事实边界。 |
| RevisionAgent | 生成体检报告、意图方案、冲击波分析。 |
| PublishAgent | 执行 Harness Lock，切换 timeline，导入反馈。 |

### 10.2 新增工具

| 工具 | 风险 | 说明 |
| --- | --- | --- |
| `generate_diagnostic_report` | propose/write-output | 生成小说体检报告。 |
| `create_intent_plan` | propose | 将作者意图转为多方案。 |
| `simulate_impact` | propose/write-output | 生成冲击波分析。 |
| `upsert_character_state_event` | propose | 写入候选人物状态变化。 |
| `upsert_foreshadowing_node` | propose | 写入候选伏笔节点。 |
| `map_reader_feedback` | propose/write-output | 映射读者反馈。 |
| `plan_timeline_iteration` | propose | 生成发布后未来章节修复计划。 |
| `create_harness_lock` | approval-required | 发布前锁定 Harness 状态。 |

### 10.3 工具约束

- 只读扫描可并发。
- 写入候选产物串行。
- 正文、confirmed canon、timeline mode 切换必须审批。
- timeline 模式下不得调用会静默回改已发布章节的工具。
- 失败时必须保留诊断，不伪造成功报告。

---

## 11. 非功能需求

### 11.1 性能

- 单章体检目标：10 秒内返回首个结果卡。
- 全书体检目标：先返回扫描计划，再后台逐步回流 finding。
- 大项目扫描必须支持取消、恢复和增量更新。

### 11.2 可恢复

- Harness 任务必须写入 task event。
- 报告、方案、冲击波、反馈映射必须可重新打开。
- 应用 proposal 前保留快照。

### 11.3 可解释

- 每个 finding 都要说明证据来源。
- 每个方案都要说明收益、代价和风险。
- 每个 timeline iteration 都要说明为什么不能直接改旧章。

### 11.4 安全

- 读者反馈、导入资料、网页内容都是数据，不是指令。
- 外部平台 API、发布、同步仍需 Agent Policy 审批。
- 高风险批量修改必须显示影响范围和撤销策略。

---

## 12. 成功指标

### 12.1 产品指标

- 作者能在 3 分钟内理解当前作品最大结构风险。
- 作者能从一个修改意图得到至少两个可比较方案。
- 发布前 blocking issue 不再隐藏在聊天记录中。
- 发布后反馈能进入 timeline iteration，而不是散落在笔记里。

### 12.2 质量指标

- Harness finding 中 90% 以上带 targetRefs 和 evidence。
- 高风险结构 proposal 100% 带 impact analysis。
- timeline 模式下 100% 已发布章节修改被拦截或转为 future fix。
- 诊断报告、冲击波、反馈映射均可被重新打开和引用。

### 12.3 工程指标

- `verify:runtime-smoke` 覆盖 Harness 核心任务。
- 新增 DTO 和工具有类型测试或契约测试。
- GUI smoke 覆盖 Harness 卡片基本渲染和发布前锁定路径。

---

## 13. 里程碑

### M1：Harness 数据与任务底座

目标：先让 Harness 产物可存、可查、可回流。

范围：

- lifecycle mode。
- harness profile。
- diagnostic report DTO。
- impact analysis DTO。
- intent plan DTO。
- reader feedback DTO。
- timeline iteration DTO。
- AgentFeed 新卡片类型。

验收：

- Runtime 能生成并持久化 mock Harness 产物。
- 右栏能显示 Harness 结果卡。
- 不改正文。

### M2：沙盘诊断与意图规划

目标：发布前结构诊断可用。

范围：

- 单章体检。
- 黄金三章评估。
- 伏笔链候选扫描。
- 作者意图到 A/B/C 方案。
- 冲击波分析。

验收：

- 作者可从修订工作面发起体检。
- 能从体检 finding 生成 issue 或 intent plan。
- 高风险结构改动必须显示影响范围。

### M3：时间线模式与读者反馈闭环

目标：发布后修复体验可用。

范围：

- 发布前 Harness Lock。
- timeline mode 切换。
- publishedChapterRefs 只读边界。
- 读者反馈导入。
- timeline iteration。
- 回潮声明 proposal。

验收：

- 发布后不能静默改已发布章节。
- 反馈可映射到章节/人物/节奏/伏笔。
- 系统能给出未来章节补强方案。

### M4：人物状态机与伏笔链视图

目标：让复杂长篇结构可视化。

范围：

- 设定工作面人物状态机。
- 伏笔链视图。
- 信息差矩阵基础版。
- 与体检、冲击波、写作约束联动。

验收：

- 人物失真 issue 能引用状态机。
- 伏笔断裂 issue 能引用伏笔链。
- 写作工作面能显示当前章节 Harness 约束。

---

## 14. 不做范围

v2 首版不做：

- 多人实时协作。
- 全自动连载发布机器人。
- 评论平台实时爬取。
- 云端多租户项目管理。
- 大规模插件市场。
- 强制统一所有作者的叙事模板。
- 绕过作者确认的自动全文重写。

---

## 15. 风险与对策

| 风险 | 表现 | 对策 |
| --- | --- | --- |
| 诊断泛泛而谈 | 输出像作文点评，不能行动 | 强制 finding schema：target、evidence、severity、recommendation。 |
| Harness 变成复杂控制台 | 作者被工程概念淹没 | 前台用“体检、方案、影响、反馈、发布锁定”等作者语言。 |
| 误把反馈当命令 | 作品被评论牵着走 | 反馈只作为证据，必须由作者确认。 |
| 时间线边界被破坏 | 发布后静默改旧章 | publishedChapterRefs 只读，剧情事实修改转 future fix。 |
| 全书扫描太慢 | 用户等待无反馈 | 先返回任务卡和首批 finding，后台增量扫描。 |
| 方案太多无法决策 | 作者选择成本高 | 默认给 2-3 个高差异方案，并标注推荐理由。 |

---

## 16. 验收总清单

v2 可发布前必须满足：

- [ ] 项目能记录 `sandbox` / `timeline` lifecycle mode。
- [ ] 修订工作面能生成小说体检报告。
- [ ] 黄金三章评估可输出结构化 finding。
- [ ] 作者意图能生成 A/B/C 方案。
- [ ] 高风险方案能生成冲击波分析。
- [ ] 设定工作面能承载人物状态机或伏笔链的至少一个 MVP 视图。
- [ ] 发布工作面能执行 Harness Lock。
- [ ] 发布后已发布章节默认只读。
- [ ] 读者反馈能映射到章节/人物/节奏/伏笔/发布风险。
- [ ] timeline iteration 能生成未来章节补强策略。
- [ ] 所有 Harness 产物进入 AgentFeed 或可打开报告，不只存在聊天文本。
- [ ] `verify:runtime-smoke` 覆盖 Harness 核心路径。

---

## 17. 与现有文档关系

- `docs/prd/lime-novel-electron-product-design.md`：v1 产品与代理系统总纲。
- `docs/prd/lime-novel-ui-design.md`：v1 工作台 UI 事实源。
- `docs/tech/agent-runtime.md`：当前 runtime 已落地能力与边界。
- `docs/tech/data-model.md`：当前项目文件系统 + SQLite 混合存储策略。
- `docs/roadmap/v2/README.md`：v2 Novel Harness Engine 产品迭代 PRD。

v2 PRD 不替代上述文档，而是在当前基线之上定义第二版本的产品演进方向。
