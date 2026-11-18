# 证据与页面契约

`plan.json` 是宿主模型与确定性引擎的接口，校验实现在 `engine/core.mjs:validatePlan`。参考可执行样例 `examples/academic-blue.json`；其所有内容均为 demo，不可拿来生成真实科研结论。

顶层字段：`version: 2`，`demo: false`（真实论文），`theme: academic-blue | academic-red`，`mode: safe | standard`，以及 sources、evidence、claims、slides、coverage 数组。ID 在各自集合内唯一；数组不能用自然语言替代。未知引用、缺必需字段和无法容纳的内容会阻止生成。

## sources

每项包含 id、kind（main / supplement / external）、locator（本地绝对路径、DOI 或原始文献 URL）。原始文献的哈希和逐页文本由 intake 的 sources.json 保存。参考截图只支持设计判断，不支持科学结论。

## evidence：Panel 级 Figure Explanation

每项包含 id、source（来源 ID）、figure、panel、location（页码、图注/Methods 的精确位置）、question、method、condition、control、observation、statistics、limitation、keywords（字符串数组）、status、visual_status。

status 为 verified / unverified；verified 必须有 verified_by 和 verification_note。visual_status 为 read / unverified / not-applicable。真实结果的统计值、处理时间、单位、n 和实验重复类型写入这些字段，不能留通用话术。没有报告的信息写明“未报告：已查……”。确实不需要实验对照的背景证据写“不适用：……理由”。用于页面的 unverified 证据会阻止生成；未核实的视觉细节记录在核查报告和 evidence.md，不得在 observation 里伪装成观察事实。

## claims

每项包含 id、text、kind（observation / interpretation / external / hypothesis）、evidence（证据 ID 数组）。一个结论的支持证据须全部列入引用该结论的页面。结果页标题与结论 text 一致。程序只能检查引用关系，不能判断这些证据是否真的支持结论。

## slides

每项包含 id、slide_type、title、claim（结论 ID）、purpose、section（精简大章节，名称具体完整）、relationship、priority、evidence、figures、blocks、transition。

- relationship：context、comparison、detail、experiment_then_validation、sequence、workflow、mechanism、synthesis 等内容意图；用于候选排序。
- priority：figure_first 优先保留图面积。
- pattern：可选的布局偏好；必须在设计系统中存在。偏好不强制覆盖可读性检查。
- figure_share：仅 standard 模式接受，范围 0.5–0.8；适用于大图、上下双图、单图放大候选。
- figures：`{label, evidence: [ID], aspect: 宽/高, preserve: [必须保留的图例/坐标轴/比例尺]}`。aspect 用实际 Panel 组合估计，最终人工插图时复检。当前输出是原生形状占位框，而不是 PowerPoint 专用“插入图片”按钮。
- blocks：`{title, text, evidence: [ID]}`，页面上的简短解释。正文少字多图，首次出现的图类型仅保留必要读图提示；完整获取方法、逐元素说明和原理进入备注，来源保存在 evidence.md。
- experimental_result 类型要求展示证据有对应图片槽。附加方法信息可列入 `notes_evidence`，必须属于本页 evidence 并被 speaker_cues 引用，且不能同时支持页面主标题、正文块或图片槽。这样主图与补充材料备注可分别核查。

不输入坐标；不输入长口播稿；不把多个独立结论塞进一个页面。统计图中的 n、单位和重要限定不能为了排版省略。

## 提示备注

新计划顶层使用 `notes_mode: "cues"`；每页提供非空 `speaker_cues` 数组，每项为 `{kind, text, evidence: [ID]}`。kind 为 order / term / design / method / principle / background / readout；caution 兼容旧数据但不输出，新增计划不使用。引用必须属于当前页，提示须覆盖该页全部 evidence。详细写法见 [备注规范](../references/speaker-notes.md)。

模型依据完整证据写术语、读图、方法与原理，程序负责装配与引用验证。超过 8 条或 600 字符时提示检查针对性和重复，不截断必要解释。备注不附证据 ID、图索引、出处、边界或衔接；溯源和未核实事项单独保留 evidence.md。

省略 notes_mode 或设为 full 保留旧版完整备注，真实计划会产生迁移警告。两种模式都输出完整 `evidence.md`，不丢实验细节。

## coverage

每条 evidence 恰好一项 `{evidence, disposition, critical, reason}`。已用于 slides 的为 included；未展示的是 omitted 或 backup，必须解释原因。backup 表示仅保留在证据表中待补充，并不自动生成附录页；默认不生成实际备份幻灯片；补充信息采用备注文字。critical 为 true 的证据须关联相关页（可以仅用于备注，非必须插图）。

这只能检查“已经登记”的证据。宿主模型须对正文和补充材料建立完整清单，程序无法发现根本未登记的 Panel。

## 输出

build 输出 draft.pptx、每页 slide-NN.png、index.html、compiled.json、notes.md 和 evidence.md。compiled 记录输入哈希、主题、候选（最多三项展示）、选中布局与警告。所有图片框使用 contain 比例，正文 24 CSS px（18 pt）、标题 36 px（27 pt）、来源 16 px（12 pt）；正文不自动缩小。

文本容量是中英混排的保守估算，不是字体真实测量。PPTX 重导入预览、几何包检查和人工逐页观察是后续环节，仍不能替代目标 PowerPoint 环境中的检查。

蓝色主题使用 14 px 圆角灰卡片、水平居中且上边缘与虚线框上边缘对齐的圆角深蓝标签。标题区按一行或两行自适应：标题上移，分隔线紧随标题，腾出的空间分配给内容区。上述偏好保存在 themes.json，后续生成自动沿用。

## 人物与展示范围

`author_background` 是无内容图框/卡片框页面；`author_profiles` 为一至三位 `{name, portrait: 本地已核实照片路径, role}`；`institution` 为发文时机构。

顶层 `presentation_policy.supplementary_figures: "notes-text-only"` 禁止将 supplement 来源放入 figures，补充证据仍可关联页面与备注。transition 是内部规划字段，不自动输出到备注。
