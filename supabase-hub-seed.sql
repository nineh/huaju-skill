-- 华炬 Skill 集市：把网站上现有的技能导入技能库（先运行 supabase-hub.sql，再运行本文件；可重复运行）
-- 本文件由脚本根据 downloads/ 里的技能包生成，SKILL.md 原文照录。

insert into public.hub_skills(slug, display_name, summary, category, source, author, license, source_url, detail_url, visibility, status, latest_version)
values ('gongwen-paiban', '公文排版助手', '一键统一标点、字体、段落和页码，按公文和法律文书格式出稿，支持参照样板排版。', '排版', '所内', '韩宇', 'MIT', 'https://github.com/KaguraNanaga/document-format-skills', 'skills/gongwen-paiban.html', 'public', 'published', '1.0.0')
on conflict (slug) do nothing;
insert into public.hub_versions(skill_id, version, changelog, skill_md, files, static_url, size_bytes, status, reviewed_email, reviewed_at)
select id, '1.0.0', '首次收录', $md$---
name: document-format-skills
description: Chinese Word document formatting toolkit for .docx/.doc/.wps workflows, including formatting a document to match a user-supplied reference/sample document (参照样板排版). Use when the agent needs to diagnose document formatting, fix mixed Chinese/English punctuation and spacing, apply official/academic/legal/custom presets, normalize tables and page numbers, preserve or output Word revision marks, convert plain text or Markdown into formatted DOCX, or batch/script document cleanup for Chinese official documents.
---

# Document Format Skills

Use these scripts to clean and format Chinese Word documents from the command line. Prefer `scripts/process.py` for normal work because it mirrors the desktop app's core pipeline without the GUI.

## Quick Workflow

Run one smart pass when the user wants the document cleaned end to end:

```bash
uv run --with python-docx python scripts/process.py smart input.docx output.docx --preset official
```

Run diagnostics only:

```bash
uv run --with python-docx python scripts/process.py analyze input.docx
uv run --with python-docx python scripts/process.py analyze input.docx --json
```

Run only punctuation/spacing cleanup:

```bash
uv run --with python-docx python scripts/process.py punctuation input.docx output.docx --space-mode keep_en_boundary
```

Format a document to match a reference document the user supplies ("照着这份文件的格式排", "按样板排版"):

```bash
uv run --with python-docx python scripts/process.py mimic input.docx output.docx --reference 样板.docx
uv run --with python-docx python scripts/process.py mimic input.docx output.docx --reference 样板.docx --save-preset 样板格式.json
```

`mimic` reads the reference's page margins, per-element fonts/sizes/bold/alignment/first-line indent/line spacing/paragraph spacing (title, headings 1–4, body, recipient, signature, date, attachment, closing), page-number style and position, and whether blank lines follow the title or precede the signature, then applies them with the normal formatting engine. Elements missing from the reference fall back to the `--preset` value (fonts inherited from the reference body). Show the user the printed recognition summary so they can confirm. Inspect a reference without formatting anything:

```bash
uv run --with python-docx python scripts/reference.py 样板.docx -o 样板格式.json
```

The saved JSON works with `--custom-settings` for later runs.

Run only formatting:

```bash
uv run --with python-docx python scripts/process.py format input.docx output.docx --preset official
```

On Windows, `.doc` and `.wps` input/output are supported through WPS or Microsoft Word COM automation:

```bash
uv run --with python-docx --with pywin32 python scripts/process.py smart input.wps output.wps
```

## Scripts

| Script | Use |
| --- | --- |
| `scripts/process.py` | One-shot CLI for `smart`, `analyze`, `punctuation`, and `format`; handles `.doc/.wps` conversion on Windows. |
| `scripts/reference.py` | Read a reference .docx and build a preset that reproduces its formatting (used by `mimic`). |
| `scripts/formatter.py` | Apply formatting presets, custom JSON settings, page numbers, table cleanup, revision marks, macOS font fallback. |
| `scripts/punctuation.py` | Fix punctuation while preserving run formatting; supports spacing strategies. |
| `scripts/from_text.py` | Create a DOCX from `.txt` or Markdown, then optionally run smart formatting. |
| `scripts/analyzer.py` | Lower-level diagnostic script. |
| `scripts/converter.py` | Windows-only `.doc/.wps` conversion helpers. |

## Formatting Options

Built-in presets:

- `official`: GB/T 9704-2012 style official document formatting.
- `academic`: academic paper formatting.
- `legal`: legal document formatting.
- `custom`: read the active desktop custom preset when available.

Useful flags:

```bash
--custom-settings path.json
--revision
--deep-clean
--smart-table-align
--no-page-number
--page-number-style dash|plain|page_text|page_total
--page-number-position outside|left|center|right
--page-number-offset-mm 7
--no-bold-serial
```

`--custom-settings` accepts desktop schema v2 config files, exported preset files shaped as `{"preset": {...}}`, or plain preset/override JSON. For non-custom presets, the JSON is merged over the selected preset.

## Punctuation And Spacing

Punctuation cleanup protects URLs, email addresses, Windows paths, time values like `9:30`, and standards like `ISO 9001:2015`. It fixes brackets, colons, semicolons, question/exclamation marks, Chinese comma/period contexts, ellipses, dashes, and paired quotes.

Spacing modes:

- `remove_all`: delete half-width and full-width spaces.
- `keep_en_boundary`: remove Chinese-to-Chinese spaces but keep exactly one space between Chinese and English/digits.
- `keep_all`: leave spaces unchanged.

## Text Or Markdown To DOCX

Generate and format a document from text:

```bash
uv run --with python-docx python scripts/from_text.py input.md output.docx --title "工作方案"
```

Markdown mode detects headings, bold spans, ordered/unordered lists, quotes, and fenced code blocks. `#` becomes the main title, `##` becomes `一、`, `###` becomes `（一）`, and deeper headings become numbered lower-level headings.

Use `--no-process` to only create the raw DOCX.

## Implementation Notes

- `.docx` processing needs only `python-docx`.
- `.doc/.wps` conversion needs Windows plus WPS Office or Microsoft Word and `pywin32`.
- Page number handling avoids overwriting non-page footer content and can replace existing page-number footers when requested.
- Default table formatting preserves original alignment; use `--smart-table-align` for numeric/right and short-text/center alignment.
- macOS font handling keeps installed official fonts when present and falls back to compatible system fonts only when detection confirms the original is missing.
$md$, '[{"path": "README_CN.md", "size": 4361}, {"path": "requirements.txt", "size": 58}, {"path": "SKILL.md", "size": 5931}, {"path": "pytest.ini", "size": 42}, {"path": "README.md", "size": 4531}, {"path": "NOTICE-华炬版.md", "size": 1004}, {"path": "LICENSE", "size": 1071}, {"path": ".gitignore", "size": 78}, {"path": "pyodide_py-0.29.5-py3-none-any.whl", "size": 66017}, {"path": "requirements-dev.txt", "size": 32}, {"path": "scripts/reference.py", "size": 20351}, {"path": "scripts/punctuation.py", "size": 13534}, {"path": "scripts/analyzer.py", "size": 9165}, {"path": "scripts/__init__.py", "size": 0}, {"path": "scripts/fix_spacing_simple.py", "size": 874}, {"path": "scripts/converter.py", "size": 5220}, {"path": "scripts/fix_spacing.py", "size": 1243}, {"path": "scripts/process.py", "size": 11190}, {"path": "scripts/from_text.py", "size": 10588}, {"path": "scripts/formatter.py", "size": 88814}, {"path": "scripts/webapi.py", "size": 5820}, {"path": "tests/test_formatter_regression.py", "size": 4698}, {"path": "tests/test_reference.py", "size": 6169}, {"path": "tests/test_punctuation_and_text.py", "size": 2020}, {"path": "示例/输出-借款律师函.docx", "size": 38921}, {"path": "示例/样板-华炬律师函.docx", "size": 38027}, {"path": "示例/待排版-借款律师函.docx", "size": 37015}]'::jsonb, 'downloads/gongwen-paiban-skill.zip', 237738, 'published', 'seed', now()
from public.hub_skills where slug = 'gongwen-paiban'
on conflict (skill_id, version) do nothing;

insert into public.hub_skills(slug, display_name, summary, category, source, author, license, source_url, detail_url, visibility, status, latest_version)
values ('lit-draft-complaint', '起诉状与仲裁申请', '诉讼请求具体可执行，事实理由逐条对应证据。', '诉讼', '开源', 'John He', 'MIT', 'https://github.com/Decikingship/legal-agent-skills', null, 'public', 'published', '1.0.0')
on conflict (slug) do nothing;
insert into public.hub_versions(skill_id, version, changelog, skill_md, files, static_url, size_bytes, status, reviewed_email, reviewed_at)
select id, '1.0.0', '首次收录', $md$---
name: 起诉状与仲裁申请
description: 起草民事起诉状或仲裁申请书——诉讼请求的具体化与可执行性校验、事实与理由的证据对应、法律依据的准确援引。务必在用户提到"写起诉状""起草诉状""仲裁申请书""立案材料""诉讼请求怎么写""要告他""准备起诉"时使用本 skill；用户要提起诉讼或仲裁并需要文书时同样使用。
---

# 起诉状与仲裁申请

> 技术标识：`lit-draft-complaint`

**诉讼请求是整份文书的核心，也是最容易写废的地方。**

写得不具体，法院会要求明确；写得不可执行，赢了也拿不到钱；漏了利息或费用，事后无法补。

## 诉讼请求的四条铁律

**① 具体、明确、可执行。**
❌「判令被告承担违约责任」——法院无法据此制作判项
✅「判令被告支付货款人民币 500,000 元」

**② 金额分项列明，计算方式写清。**
利息类请求必须写明：**基数、起算日、截止表述、计算标准、暂计金额**。
✅「以 500,000 元为基数，自 2024 年 3 月 1 日起至实际清偿之日止，按全国银行间同业拆借中心公布的一年期贷款市场报价利率计算」

**③ 该主张的一次主张完。** 诉讼费、保全费、保全担保费、律师费（有约定或法定依据时）、公证费、鉴定费——**漏了事后一般无法另案主张**。

**④ 请求之间不得矛盾。** 常见错误：同时主张继续履行与解除合同、同时主张违约金与定金罚则。

## 适用场景 / 不适用场景

| 情形 | 处置 |
|---|---|
| 起草起诉状、仲裁申请书 | 本 skill |
| 答辩、反诉 | 「答辩状与反诉」 |
| 上诉、再审 | 「上诉与再审申请」 |
| 已有初稿要校验 | 本 skill + 「法律文书校验」相关 skill |

## 输入要素清单

**必需**
- 双方当事人完整信息（名称、住所、法定代表人/身份信息、联系方式）
- 请求权基础与诉讼请求
- 事实经过与对应证据
- 受诉法院

**强烈建议**
- 已完成的「请求权基础分析」「管辖权分析」「诉讼时效分析」「证据清单」产出

## 依赖

- 模板：`assets/complaint-template.md`
- 上游：「请求权基础分析」「管辖权分析」「诉讼时效分析」「证据清单与举证责任」
- 计算：「法律计算器」（利息、诉讼费）
- 出门前：「法条引用核验」「论证依据审查」

## 工作流程

### 第一步：核对前置事项

- [ ] 管辖法院已确定（「管辖权分析」）
- [ ] 时效未届满（「诉讼时效分析」）
- [ ] 主体适格（原告有诉的利益、被告适格）
- [ ] 前置程序已完成（劳动仲裁、行政复议等）

**这四项任一不过，写得再好也白写。**

### 第二步：写诉讼请求

按四条铁律。利息与费用用「法律计算器」算准，**暂计金额必须与计算方式自洽**。

### 第三步：写事实与理由

原则：**每段事实对应一组证据**。写到某个事实时，心里要清楚用哪份证据证明。

无证据支撑的事实——用「案件事实时间轴」找出来的那些——要么补证据，要么删掉。**写进起诉状却证明不了，等于给对方送把柄。**

### 第四步：援引法律依据

放在理由部分末尾集中列明。所有条文必须经「法条引用核验」，确认现行有效、条号正确、内容相符。

⚠️ **行为发生在民法典施行前的，注意适用行为时法**——2021 年前的合同纠纷引民法典可能是错的。

### 第五步：核对格式与附件

副本份数、证据清单、主体资格证明、授权委托书、送达地址确认书。

## 输出模板

见 `assets/complaint-template.md`。

## 强制校验项

- [ ] 管辖、时效、主体、前置程序四项已核对
- [ ] 每项诉请具体、明确、**可直接制作判项**
- [ ] 利息类请求写明基数、起算日、计算标准、暂计金额
- [ ] 诉讼费等费用已一并主张
- [ ] 诉请之间无矛盾（继续履行 vs 解除、违约金 vs 定金）
- [ ] 每段事实对应到具体证据，**无证据支撑的已删除**
- [ ] 法律依据已核验现行有效，**已考虑行为时法**
- [ ] 附件清单完整

## 边界与降级

**不替客户决定诉请金额。** 主张多少是商业与策略判断（涉及诉讼费成本、和解空间、执行可能）。

**不承诺立案必成。** 立案审查、管辖异议、主体资格都可能出问题。

**信息不全时不编。** 当事人身份信息、送达地址缺失的，标注`<待补>`，**不要编造**——起诉状是要提交法院的正式文书。

## 示例

**示例一 · 诉请不具体**
输入：`诉请写"判令被告承担违约责任并赔偿损失"。`
→ 指出法院无法据此制作判项，要求拆成具体金额的分项请求，并补全利息的计算要素。

**示例二 · 诉请矛盾**
输入：`我们要求对方继续履行合同，同时赔偿因合同解除造成的损失。`
→ 指出继续履行与合同解除互斥，须先确定主张路径；如需备选，应以主位、备位请求的形式提出。
$md$, '[{"path": "SKILL.md", "size": 5335}, {"path": "references/output-formats.md", "size": 9672}, {"path": "assets/complaint-template.md", "size": 1597}, {"path": "evals/evals.json", "size": 1012}, {"path": "LICENSE", "size": 1080}, {"path": "来源说明.txt", "size": 417}]'::jsonb, 'downloads/external/lit-draft-complaint.zip', 11280, 'published', 'seed', now()
from public.hub_skills where slug = 'lit-draft-complaint'
on conflict (skill_id, version) do nothing;

insert into public.hub_skills(slug, display_name, summary, category, source, author, license, source_url, detail_url, visibility, status, latest_version)
values ('lit-draft-defense', '答辩状与反诉', '按程序、事实、法律三层组织答辩，评估是否反诉。', '诉讼', '开源', 'John He', 'MIT', 'https://github.com/Decikingship/legal-agent-skills', null, 'public', 'published', '1.0.0')
on conflict (slug) do nothing;
insert into public.hub_versions(skill_id, version, changelog, skill_md, files, static_url, size_bytes, status, reviewed_email, reviewed_at)
select id, '1.0.0', '首次收录', $md$---
name: 答辩状与反诉
description: 起草民事答辩状与反诉状——按程序抗辩、事实否认、法律抗辩三层组织答辩意见，评估反诉的可行性与策略价值。务必在用户提到"写答辩状""怎么答辩""收到起诉状了""要不要反诉""反诉状""被起诉了""应诉""管辖异议"时使用本 skill；用户作为被告方准备应诉材料时同样使用。
---

# 答辩状与反诉

> 技术标识：`lit-draft-defense`

答辩的关键不是逐句反驳，而是**按顺序打**——程序问题优先，因为程序抗辩成立可以直接终结诉讼，成本远低于实体对抗。

## 三层抗辩顺序

**① 程序抗辩（最先，且有期限）**

| 抗辩 | 期限 | 后果 |
|---|---|---|
| **管辖权异议** | **提交答辩状期间**（15 日内） | **逾期视为放弃，不可补** |
| 主体不适格 | 答辩时 | 驳回起诉 |
| 未经前置程序 | 答辩时 | 驳回起诉 |
| 重复起诉、一事不再理 | 答辩时 | 驳回起诉 |

⚠️ **管辖权异议必须在答辩期内提出，逾期丧失。** 这是被告方最容易错过的期限。

**② 实体抗辩**
- **事实否认**：否认原告主张的要件事实（举证责任仍在原告）
- **法律抗辩**：承认事实但主张法律上不成立（不可抗力、情势变更、免责条款）
- **权利抗辩**：**诉讼时效已过**（必须主动提出，法院不主动适用）、同时履行抗辩、先履行抗辩、不安抗辩

⚠️ **时效抗辩必须在一审提出**，二审才提的一般不予支持。

**③ 反诉**

## 反诉的四项评估

不是能反就反。反诉要花钱（诉讼费）、要举证、可能拖长审理。评估四项：

1. **是否符合反诉条件**：与本诉有牵连关系、同一法院管辖、同一程序审理
2. **胜算**：走一遍「请求权基础分析」与「证据清单」
3. **策略价值**：能否抵销、能否增加和解筹码、能否分散对方注意力
4. **成本**：诉讼费、举证负担、审理周期延长

**只有策略价值而无实体依据的反诉，容易被反噬**——法院会看出意图，且反诉败诉方要承担相应诉讼费。

## 适用场景 / 不适用场景

| 情形 | 处置 |
|---|---|
| 起草答辩状、反诉状 | 本 skill |
| 起诉方文书 | 「起诉状与仲裁申请」 |
| 对方证据的质证 | 「质证意见」 |
| 判断管辖异议是否成立 | 「管辖权分析」 |

## 输入要素清单

**必需**
- 起诉状全文、我方掌握的事实与证据、**收到起诉状副本的日期**（用于计算答辩期）

**建议**
- 我方对原告是否另有债权（评估反诉）

## 依赖

- 上游：「管辖权分析」「诉讼时效分析」「请求权基础分析」「证据清单与举证责任」
- 期间计算：「法律计算器」的 period 子命令
- 出门前：「法条引用核验」「论证依据审查」

## 工作流程

### 第一步：算答辩期与管辖异议期（**最先做**）

用「法律计算器」的 period 子命令，从收到起诉状副本之日起算。

**管辖权异议必须在答辩期内提出。** 这个期限过了就没有了，比任何实体准备都紧急。

### 第二步：逐项拆解原告的诉请与要件

对原告主张的每个要件，明确我方立场：认可 / 否认 / 部分认可。

**认可不争的事实。** 全盘否认会损害可信度，也会让法官难以聚焦。

### 第三步：按三层顺序组织抗辩

程序 → 实体 → 反诉。每层写清依据。

### 第四步：评估反诉

按四项评估。决定不反诉的，在内部备注中说明理由——客户可能会问。

### 第五步：核对期限清单

- [ ] 答辩期
- [ ] 管辖权异议期（**与答辩期同**）
- [ ] 举证期限
- [ ] 反诉提出期限（法庭辩论终结前，但越早越好）
- [ ] 申请证人出庭、鉴定的期限

## 输出模板

```markdown
# 民事答辩状

答辩人：<信息>
被答辩人：<原告信息>

因<案由>一案，答辩人现提出答辩如下：

## 一、程序方面
<管辖权异议 / 主体不适格 / 未经前置程序，如有>

## 二、事实方面
答辩人对被答辩人陈述的以下事实无异议：……
但对以下事实不予认可：……
理由：……（证据X）

## 三、法律方面
<法律抗辩、权利抗辩>
（一）本案已过诉讼时效
……
（二）答辩人享有同时履行抗辩权
……

## 四、结论
综上，被答辩人的诉讼请求缺乏事实与法律依据，请求依法驳回其全部诉讼请求。

此致
XX 人民法院
答辩人：
YYYY 年 M 月 D 日

---

## 内部备注（不提交）
| 事项 | 判断 | 理由 |
|---|---|---|
| 管辖异议 | 提 / 不提 | …… |
| 反诉 | 提 / 不提 | 四项评估结论 |
| 期限清单 | | |
```

## 强制校验项

- [ ] **答辩期与管辖权异议期已算准**，且异议在期内提出
- [ ] 已按程序 → 实体 → 反诉的顺序组织
- [ ] **时效抗辩已在一审提出**（如适用）
- [ ] 不争事实已明确认可，未全盘否认
- [ ] 反诉已做四项评估，决定不反诉的已说明理由
- [ ] 法律依据已核验现行有效
- [ ] 期限清单完整

## 边界与降级

**不承诺抗辩必然成立。** 管辖异议、时效抗辩能否成立由法院判断。

**反诉是策略决定。** 涉及成本与商业考量，本 skill 给评估维度，决定权在客户与律师。

**期限计算须核对节假日。** 「法律计算器」不给节假日表时仅按周末顺延，**答辩期与管辖异议期不可逆，务必补充当年节假日安排**。

## 示例

**示例一 · 期限优先**
输入：`昨天收到起诉状，帮我写答辩状。`
→ **先算答辩期与管辖异议期**，确认管辖是否有异议空间；再进入实体准备。管辖异议逾期不可补，比实体答辩更紧急。

**示例二 · 反诉评估**
输入：`对方告我们欠货款，我们觉得他的货有质量问题，要不要反诉？`
→ 四项评估：质量问题可作为**抗辩**（主张减价或拒付）也可作为**反诉**（主张赔偿）。若仅为抵销，抗辩成本更低；若损失超过货款，反诉才有意义。
$md$, '[{"path": "SKILL.md", "size": 6419}, {"path": "references/output-formats.md", "size": 9672}, {"path": "evals/evals.json", "size": 1002}, {"path": "LICENSE", "size": 1080}, {"path": "来源说明.txt", "size": 417}]'::jsonb, 'downloads/external/lit-draft-defense.zip', 10461, 'published', 'seed', now()
from public.hub_skills where slug = 'lit-draft-defense'
on conflict (skill_id, version) do nothing;

insert into public.hub_skills(slug, display_name, summary, category, source, author, license, source_url, detail_url, visibility, status, latest_version)
values ('lit-draft-appeal', '上诉与再审申请', '按法定事由组织理由，核对上诉期和再审期限。', '诉讼', '开源', 'John He', 'MIT', 'https://github.com/Decikingship/legal-agent-skills', null, 'public', 'published', '1.0.0')
on conflict (slug) do nothing;
insert into public.hub_versions(skill_id, version, changelog, skill_md, files, static_url, size_bytes, status, reviewed_email, reviewed_at)
select id, '1.0.0', '首次收录', $md$---
name: 上诉与再审申请
description: 起草上诉状或再审申请书——按法定事由组织理由、区分事实认定错误与法律适用错误、核对上诉期与再审期限。务必在用户提到"上诉状""要上诉""一审判了不服""再审申请""申请再审""抗诉""上诉期""判决书收到了不服"时使用本 skill；用户收到判决要决定是否上诉时同样使用。**上诉期不可逆**——见工作流程第一步。
---

# 上诉与再审申请

> 技术标识：`lit-draft-appeal`

## 第一件事：算期限

**上诉期是不可逆的。过了就只剩再审这条难得多的路。**

| 文书 | 期限 | 起算 |
|---|---|---|
| 民事判决上诉 | **15 日** | 判决书**送达之日**次日 |
| 民事裁定上诉 | **10 日** | 裁定书送达之日次日 |
| 申请再审 | **6 个月** | 判决、裁定发生法律效力后 |

⚠️ **各方当事人送达日期不同的，各自的上诉期分别计算。**
⚠️ 用「法律计算器」的 period 子命令算，**必须补当年法定节假日**——只按周末顺延会算错。

## 上诉与再审的根本区别

| | 上诉 | 再审 |
|---|---|---|
| 门槛 | 不服即可 | **须符合法定再审事由** |
| 审查 | 全面审查 | 只审查是否符合法定事由 |
| 难度 | 常规程序 | **显著更难** |

再审不是"再打一次官司"。**理由写成"一审认定事实错误"这种笼统表述，几乎必然被驳回**——必须对应到具体的法定事由。

## 上诉理由的组织

按三类分别组织，**不要混在一起写**：

**① 认定事实错误**
指出：哪项事实、一审如何认定、证据如何显示、结论应当是什么。
**必须指向具体证据**。空泛主张"事实不清"没有意义。

**② 适用法律错误**
指出：应适用而未适用 / 适用了不应适用的条文 / 条文理解有误。
配「法律适用冲突分析」——**特别注意新旧法适用**：行为发生在法律修订前的，一审若适用了现行法，这是很实在的上诉理由。

**③ 违反法定程序**
管辖错误、未通知参加诉讼、剥夺辩论权、审判组织组成不合法、应当回避未回避。
程序违法可能导致发回重审，**成本低于实体对抗**。

## 适用场景 / 不适用场景

| 情形 | 处置 |
|---|---|
| 起草上诉状、再审申请书 | 本 skill |
| 判断上诉有无胜算 | 「争议焦点与胜败评估」+「类案检索」 |
| 一审阶段文书 | 「起诉状与仲裁申请」「答辩状与反诉」 |

## 输入要素清单

**必需**
- 一审判决书全文、**判决书送达日期**、不服的具体部分

**强烈建议**
- 一审的举证与庭审情况
- 新证据（如有）——但注意二审对新证据的限制

## 依赖

- 期限：「法律计算器」period 子命令
- 上游：「法律适用冲突分析」「类案检索」「争议焦点与胜败评估」
- 出门前：「法条引用核验」「案例援引审查」「论证依据审查」

## 工作流程

### 第一步：算期限（**先于一切**）

```bash
legal_calc.py period --start <送达日> --length 15 --holidays holidays.json
```

### 第二步：判断上诉价值

不是不服就上诉。评估：
- 上诉理由是否落在三类之内且有具体支撑
- 二审改判的现实可能（用「类案检索」看同类问题的改判情况）
- 成本：二审受理费按**上诉请求金额**另算、时间、执行延后

### 第三步：确定上诉请求

**上诉请求决定二审审理范围。** 部分上诉的，未上诉部分一审判决生效。

写法与起诉状同：具体、明确、可执行。

### 第四步：按三类组织理由

每类下逐项写，每项指向具体的判决页码/段落与证据。

### 第五步：再审须对应法定事由

申请再审的，**必须逐条对应法定再审事由**，写清本案落入哪一项、依据是什么。笼统表述会被直接驳回。

## 输出模板

```markdown
# 民事上诉状

上诉人：<信息>
被上诉人：<信息>

上诉人因与被上诉人<案由>一案，不服 XX 人民法院（20XX）X 民初 X 号民事判决，现提起上诉。

## 上诉请求
一、请求撤销（20XX）X民初X号民事判决第X项，改判……；
二、请求判令被上诉人承担一审、二审全部诉讼费用。

## 事实与理由

### 一、一审判决认定事实错误
（一）关于<事实点>
一审判决第X页认定……。但根据证据X（一审证据第X号）显示……，
该认定与证据明显不符。

### 二、一审判决适用法律错误
（一）本案行为发生于 YYYY 年，应适用[《XX法》](链接)（20XX 修正）第X条，
一审判决适用现行法第X条属适用法律错误。

### 三、一审判决违反法定程序
……

综上，一审判决<认定事实错误/适用法律错误/程序违法>，请求二审法院依法<改判/发回重审>。

此致
XX 市中级人民法院

上诉人：
YYYY 年 M 月 D 日
```

## 强制校验项

- [ ] **上诉期已算准并核对法定节假日**
- [ ] 上诉请求具体明确，已明确是全部上诉还是部分上诉
- [ ] 理由按三类分别组织，未混杂
- [ ] 每项事实认定错误都**指向具体证据与判决页码**
- [ ] 适用法律错误已核对**新旧法适用**问题
- [ ] 再审申请已**逐条对应法定再审事由**，未用笼统表述
- [ ] 二审受理费按上诉请求金额另算（「法律计算器」）
- [ ] 所有法条与案例已核验

## 边界与降级

**不承诺改判。** 二审改判率整体不高，本 skill 不预测结果。

**上诉不停止执行的除外情形要提示。** 部分判项可能先予执行，应提示客户。

**新证据在二审有限制。** 一审能提供而未提供的，二审可能不予采纳。有新证据的须说明为何一审未能提供。

**再审门槛远高于上诉。** 若上诉期尚未届满，**优先走上诉**，不要因为觉得再审也行而放弃上诉期。

## 示例

**示例一 · 期限优先**
输入：`一审判决下来了，我们不服，帮我写上诉状。`
→ **先问送达日期**并算上诉期。判决作出日与送达日不同，上诉期从送达次日起算。

**示例二 · 新旧法适用**
输入：`2019 年签的合同，一审判决引的是民法典。`
→ 这是很实在的适用法律错误上诉理由。用「法律适用冲突分析」确认行为时法与衔接规定，作为独立上诉理由展开。
$md$, '[{"path": "SKILL.md", "size": 6690}, {"path": "references/output-formats.md", "size": 9672}, {"path": "evals/evals.json", "size": 1020}, {"path": "LICENSE", "size": 1080}, {"path": "来源说明.txt", "size": 417}]'::jsonb, 'downloads/external/lit-draft-appeal.zip', 10608, 'published', 'seed', now()
from public.hub_skills where slug = 'lit-draft-appeal'
on conflict (skill_id, version) do nothing;

insert into public.hub_skills(slug, display_name, summary, category, source, author, license, source_url, detail_url, visibility, status, latest_version)
values ('lit-draft-argument', '代理词与辩护词', '围绕争议焦点论证，预先回应对方观点。', '诉讼', '开源', 'John He', 'MIT', 'https://github.com/Decikingship/legal-agent-skills', null, 'public', 'published', '1.0.0')
on conflict (slug) do nothing;
insert into public.hub_versions(skill_id, version, changelog, skill_md, files, static_url, size_bytes, status, reviewed_email, reviewed_at)
select id, '1.0.0', '首次收录', $md$---
name: 代理词与辩护词
description: 起草代理词或辩护词——围绕争议焦点组织论证、证据与事实的对应、法律依据与类案支撑、对方观点的预先回应。务必在用户提到"写代理词""辩护词""代理意见""庭后意见""法庭辩论""代理词怎么写""结案陈词"时使用本 skill；用户庭审前后需要提交书面意见时同样使用。
---

# 代理词与辩护词

> 技术标识：`lit-draft-argument`

**代理词不是把起诉状再说一遍。** 它的作用是：庭审已经把争点打出来了，代理词要在争点上给法官一个可以直接采纳的论证。

法官写判决时会参考代理词的结构与说理——**写得让他好用，被采纳的概率就高**。

## 与起诉状的区别

| | 起诉状 | 代理词 |
|---|---|---|
| 时点 | 庭前 | 庭审后（或辩论阶段） |
| 组织 | 按事实时间顺序 | **按争议焦点** |
| 目标 | 说清主张 | 说服采纳 |
| 对方观点 | 不涉及 | **必须回应** |

## 适用场景 / 不适用场景

| 情形 | 处置 |
|---|---|
| 庭审后提交代理词/辩护词 | 本 skill |
| 起诉、答辩阶段 | 「起诉状与仲裁申请」「答辩状与反诉」 |
| 上诉、再审 | 「上诉与再审申请」 |
| 庭审前的发问与应对准备 | 「庭审提纲」 |

## 输入要素清单

**必需**
- 争议焦点（法庭归纳的，或「争议焦点与胜败评估」的产出）
- 庭审情况：对方主张、质证结果、法官关注点

**强烈建议**
- 类案支撑（「类案检索」产出）
- 法官在庭上明确追问过的问题——**那是判决书要写的东西**

## 依赖

- 上游：「争议焦点与胜败评估」「类案检索」「裁判规则提炼」「证据清单与举证责任」
- 出门前：「法条引用核验」「案例援引审查」「论证依据审查」

## 工作流程

### 第一步：以法庭归纳的争议焦点为纲

**不要用自己的分类。** 法庭归纳了争点的，就按法庭的表述组织——判决书会按这个结构写，代理词对齐了才好用。

### 第二步：每个争点按四步论证

1. **结论前置**：本争点我方观点是什么
2. **法律依据**：条文 + 司法解释
3. **事实与证据**：哪些已查明的事实支撑该结论
4. **类案佐证**：同类问题法院如何处理

第 4 步是差异化所在——用「类案检索」的产出，但注意**位阶与终局性**，一审被改判的案例不能引。

### 第三步：正面回应对方观点

**不能回避。** 对方在庭上提的核心观点，代理词必须回应，否则法官会认为我方无法反驳。

回应方式：指出其法律依据不成立 / 事实前提不存在 / 举证不足 / 案例可区分。

不利判例的区分论证用「不利判例应对」的产出。

### 第四步：回应法官关注点

庭上法官反复追问的问题，**一定要在代理词里给出清晰答案**——那是他心里的疑问，也是判决书要写的部分。

### 第五步：出门前三道校验

- 「法条引用核验」——条文真实、现行有效、内容相符
- 「案例援引审查」——案号真实、终局性、观点归属
- 「论证依据审查」——结论不超出依据射程

## 输出模板

```markdown
# 代理词

尊敬的审判长、审判员：

<律所>依法接受<当事人>的委托，指派本律师担任其<诉讼地位>的代理人。经过庭审调查，现发表如下代理意见：

## 一、关于<法庭归纳的争议焦点一>

**代理人认为：<结论>。**

（一）法律依据
依据[《XX法》](链接)第X条【现行有效】规定，……

（二）事实与证据
本案已查明的事实表明……（证据X、Y）

（三）类案佐证
参见[（20XX）X民终X号](链接)，法院认为……。该案与本案在<争议焦点、关键事实>上一致。

（四）对被告方观点的回应
被告主张……。该主张不能成立，理由是……

## 二、关于<争议焦点二>
……

## 三、综合意见
综上，代理人认为……，请求法庭依法支持<当事人>的<诉讼请求 / 答辩意见>。

代理人：××律师事务所 ××律师
YYYY 年 M 月 D 日
```

## 强制校验项

- [ ] 按**法庭归纳的争议焦点**组织，未自创分类
- [ ] 每个争点结论前置
- [ ] 所有法条已核验现行有效并带出处
- [ ] 所有案例已核验终局性，**未引用被改判的一审裁判**
- [ ] 案例观点取自「本院认为」，**未用原告诉称冒充法院观点**
- [ ] 已正面回应对方核心观点，未回避
- [ ] 已回应法官庭上追问的问题
- [ ] 结论未超出依据射程（「论证依据审查」）
- [ ] 未使用「必然」「一定」等绝对化表述

## 边界与降级

**不承诺结果。** 代理词是主张，不是预测。

**类案是佐证不是决定。** 中国不是判例法国家，类案供参考。表述用"可资参照"，不用"应当依照"。

**不攻击对方当事人或代理人。** 就事论事，人身攻击性表述会损害己方形象。

**回应不了的观点如实处理。** 对方某个观点确实有力时，与其强行辩解，不如从其他角度论证或调整主张——**硬撑会被法官看穿**。

## 示例

**示例一 · 按法庭的争点组织**
输入：`法庭归纳了两个争议焦点，但我觉得还有第三个问题很重要。`
→ 按法庭归纳的两个为主体章节；第三个问题若确有必要，作为独立一节但不打乱主体结构，并说明其与法庭争点的关联。

**示例二 · 边界**
输入：`把对方代理人明显在撒谎这点写进去。`
→ 不写人身评价。改为客观指出：对方陈述与其提交的证据X记载的时间不一致，与证人证言相矛盾——**用事实说话比用形容词有力**。
$md$, '[{"path": "SKILL.md", "size": 6018}, {"path": "references/output-formats.md", "size": 9672}, {"path": "evals/evals.json", "size": 1053}, {"path": "LICENSE", "size": 1080}, {"path": "来源说明.txt", "size": 417}]'::jsonb, 'downloads/external/lit-draft-argument.zip', 10466, 'published', 'seed', now()
from public.hub_skills where slug = 'lit-draft-argument'
on conflict (skill_id, version) do nothing;

insert into public.hub_skills(slug, display_name, summary, category, source, author, license, source_url, detail_url, visibility, status, latest_version)
values ('lit-cross-examination', '质证意见', '逐份从真实性、合法性、关联性发表意见。', '诉讼', '开源', 'John He', 'MIT', 'https://github.com/Decikingship/legal-agent-skills', null, 'public', 'published', '1.0.0')
on conflict (slug) do nothing;
insert into public.hub_versions(skill_id, version, changelog, skill_md, files, static_url, size_bytes, status, reviewed_email, reviewed_at)
select id, '1.0.0', '首次收录', $md$---
name: 质证意见
description: 对对方证据发表质证意见——逐份从真实性、合法性、关联性三性展开，指出形式瑕疵与证明力缺陷，并给出可直接宣读的质证表述。务必在用户提到"质证意见""对方的证据怎么质证""三性""证据有什么问题""怎么反驳对方证据""要不要认可这份证据""证据交换"时使用本 skill；用户收到对方证据清单准备开庭时同样使用。
---

# 质证意见

> 技术标识：`lit-cross-examination`

**质证不是全盘否认。** 对明显真实的证据死不认账，会损害己方在法庭上的可信度，法官对后面真正有问题的质证也会打折扣。

有效的质证是**有选择地打**：对关键证据集中攻击，对无关紧要的坦然认可。

## 三性的正确用法

| 性 | 打什么 | 常见理由 |
|---|---|---|
| **真实性** | 证据本身是不是真的 | 复印件无原件核对、电子数据未公证、签章存疑、证人与当事人有利害关系 |
| **合法性** | 取得方式与形式是否合法 | 侵害他人合法权益取得、违反禁止性规定、域外证据未办认证、外文无译本、超举证期限 |
| **关联性** | 与本案待证事实有没有关系 | 与争议焦点无关、不能证明其主张的事实、时间范围不符 |

**最有杀伤力的往往是关联性。** 认可真实性但指出"该证据证明的是 A，而对方要证明的是 B"，比空泛否认真实性有力得多。

## 适用场景 / 不适用场景

| 情形 | 处置 |
|---|---|
| 对对方证据发表质证意见 | 本 skill |
| 编制我方证据清单 | 「证据清单与举证责任」 |
| 庭审发问设计 | 「庭审提纲」 |

## 输入要素清单

**必需**
- 对方证据清单（名称、证明对象）
- 我方立场与争议焦点

**强烈建议**
- 该证据是否见过原件
- 我方掌握的反证

## 依赖

- 上游：「证据清单与举证责任」（形式要件风险规则可复用）、「案件事实时间轴」（找时间冲突）
- 配合：「类案检索」（同类证据在裁判中如何被处理）

## 工作流程

### 第一步：分类——哪些该打，哪些该放

按证据对争议焦点的影响分三档：
1. **关键证据**（直接支撑对方核心主张）→ 集中火力，三性逐一审查
2. **辅助证据** → 挑明显瑕疵，不纠缠
3. **无关紧要** → 认可，换取可信度

### 第二步：逐份走三性

**真实性**：有无原件？电子数据有无公证？签章是否核对？证人有无利害关系？
**合法性**：取得方式是否合法？形式要件是否齐备？是否超举证期限？
**关联性**：证明对象与争议焦点是否相关？能否推出对方主张的结论？

### 第三步：找时间冲突

对方证据之间、对方证据与我方证据之间的时间矛盾，是质证的富矿。用「案件事实时间轴」交叉核对。

### 第四步：区分"不认可"与"有异议"

- **不认可**：明确否认，须有理由
- **有异议**：认可形式，但对证明力或证明对象有不同意见
- **认可**：坦然承认

**滥用"不认可"是最常见的错误。** 每一次无理由的不认可，都在消耗法官对你的信任。

### 第五步：写成可直接宣读的表述

质证意见要在庭上口头发表，**必须是能直接念出来的完整句子**，不是要点罗列。

## 输出模板

```markdown
## 质证意见

### 证据一：<对方证据名称>
**对方证明对象**：……

**质证意见**：
> 对该证据的真实性<认可 / 不认可，理由是……>；合法性<……>；关联性<……>。
> 该证据<不能 / 仅能部分>证明对方主张的<事实>，理由是……

**核心攻击点**：<真实性 / 合法性 / 关联性>
**理由**：……
**我方反证**：<如有>

### 证据二：……

### 综合质证意见
> 综上，对方提交的证据无法证明<其主张的核心事实>，理由是：……

### 内部备注（不宣读）
| 证据 | 处理策略 | 理由 |
|---|---|---|
| 证据一 | 集中攻击关联性 | 关键证据，真实性难否认但证明对象错位 |
| 证据三 | 认可 | 无关紧要，认可换取可信度 |
```

## 强制校验项

- [ ] 已按重要性分档，**未对所有证据一律不认可**
- [ ] 每一处"不认可"都有具体理由
- [ ] 已检查关联性——不只盯真实性
- [ ] 已交叉核对时间冲突
- [ ] 质证表述可直接宣读，非要点罗列
- [ ] 内部备注说明了取舍策略
- [ ] 未对证明力大小下结论式判断（那是法官的事，我们提出的是意见）

## 边界与降级

**不建议无理由的全盘否认。** 除损害可信度外，还可能导致法院认为己方缺乏诚信，在自由裁量时不利。

**没见过原件的，如实说明。** 表述为"因未核对原件，暂对真实性不予认可，保留核对原件后发表意见的权利"，而不是断言其为假。

**质证意见是意见，不是认定。** 表述用"我方认为"，不用"该证据不具有证明力"这种判断句。

## 示例

**示例一 · 关联性打法**
对方提交一份微信聊天记录证明"我方承认欠款"。
→ 真实性可以认可（有原始载体），但**关联性有异议**：该聊天记录讨论的是另一笔业务，时间在本案合同签订之前，不能证明对本案债务的承认。

**示例二 · 有选择地打**
对方提交 12 份证据，其中 8 份是无争议的往来函件。
→ 对这 8 份认可，集中攻击 4 份关键证据。**认可换取可信度**，让法官相信我方对关键证据的质疑是认真的。
$md$, '[{"path": "SKILL.md", "size": 5809}, {"path": "references/output-formats.md", "size": 9672}, {"path": "evals/evals.json", "size": 1039}, {"path": "LICENSE", "size": 1080}, {"path": "来源说明.txt", "size": 417}]'::jsonb, 'downloads/external/lit-cross-examination.zip', 10282, 'published', 'seed', now()
from public.hub_skills where slug = 'lit-cross-examination'
on conflict (skill_id, version) do nothing;

insert into public.hub_skills(slug, display_name, summary, category, source, author, license, source_url, detail_url, visibility, status, latest_version)
values ('util-anonymize', '文件脱敏', '身份证、手机号等强制脱敏，当事人名称统一替换。', '工具', '开源', 'John He', 'MIT', 'https://github.com/Decikingship/legal-agent-skills', null, 'public', 'published', '1.0.0')
on conflict (slug) do nothing;
insert into public.hub_versions(skill_id, version, changelog, skill_md, files, static_url, size_bytes, status, reviewed_email, reviewed_at)
select id, '1.0.0', '首次收录', $md$---
name: 文件脱敏
description: 对法律文件做脱敏处理——身份证手机银行卡等强制脱敏、当事人名称的一致性替换、案号与公司名的待确认清单。务必在用户提到"脱敏""去标识""隐去当事人信息""要对外分享这个案例""做培训材料""投标要提供案例""匿名化""隐私处理"时使用本 skill；用户要把真实案件材料用于外部场合时同样使用。
---

# 文件脱敏

> 技术标识：`util-anonymize`

**这是交付类工具里唯一出错会直接产生法律责任的一个。** 脱漏一处身份证号或当事人信息，就可能构成泄露隐私或违反保密义务。

## 四条原则

**① 宁可多脱不可漏脱。** 误脱一个无关信息只是可读性下降，漏脱一个身份证号是事故。

**② 一致性替换。** 同一实体全文用同一代号。「张三」一处变「甲」另一处变「某某」，文书就读不通了。

**③ 保留结构信息。** 金额、日期、法律关系默认保留——**脱了案例就失去参考价值**。

**④ 人工复核是必需环节，不是可选项。** 正则覆盖不了语境中的可识别线索。

## 强制脱敏 vs 待确认

**强制脱敏（`--auto` 自动替换）**：身份证号、手机号、银行卡号、统一社会信用代码、车牌号、电子邮箱、固定电话、详细地址。

**待确认（脚本只列出，不自动改）**：
- **当事人姓名与公司名** —— 自动替换易误伤法条与机构名（「最高人民法院」不能被当成机构名脱掉），须用 `--entity` 逐一指定
- 案号 —— 可反查到当事人，对外分享通常应脱
- 法院名称 —— 通常可保留，但会缩小可识别范围
- 金额 —— 默认保留，特殊案件中可能指向特定主体

## 适用场景 / 不适用场景

| 情形 | 处置 |
|---|---|
| 案例对外分享、培训材料、投标范例 | 本 skill |
| 内部使用的文书 | 通常不需要 |
| 数据合规评估 | 「数据合规评估」 |

## 输入要素清单

**必需**：待脱敏文本或文件
**强烈建议**：当事人清单（用 `--entity "原文:代号"` 指定）、脱敏用途（决定尺度）

## 依赖

- 脚本：`scripts/anonymize.py`
- 配合：「数据合规评估」（涉及个人信息处理的合规义务）

## 工作流程

### 第一步：确认用途与尺度

| 用途 | 尺度 |
|---|---|
| 公开发表、培训 | 最严——当事人、公司、案号、法院全脱 |
| 投标、内部分享 | 中——当事人与公司脱，案号视情况 |
| 引用已公开的裁判文书 | 最松——案号可保留（本就公开） |

### 第二步：列当事人清单

通读一遍，把所有当事人、关联方、经办人名称列出，指定代号。

**代号要有法律意义**：用「原告」「被告公司」「甲方」，不用「A」「B」——读者要能看懂关系。

### 第三步：跑脱敏

```bash
python3 scripts/anonymize.py --file doc.txt --auto \
  --entity "张三:原告" "上海某某科技有限公司:被告公司" "李四:被告法定代表人"
```

**始终加 `--auto`**，否则身份证、手机号不处理。

### 第四步：过待确认清单

逐项判断是否需要脱。

### 第五步：**通读全文再发布**（不可跳过）

脚本处理的是模式化信息。语境中的可识别线索只能靠人读出来：
- 「本市唯一一家 XX 资质企业」
- 「2023 年那起引发广泛关注的 XX 事件」
- 特定的行业地位、独特的交易结构、罕见的标的物

**这类线索脚本永远查不出来。**

## 输出模板

```markdown
## 脱敏说明

**用途**：对外培训材料｜**尺度**：严

### 替换对照（内部留存，不随文件外发）
| 原文 | 代号 |
|---|---|
| 张三 | 原告 |

### 强制脱敏统计
| 类型 | 处数 |
|---|---|

### 已确认保留
| 类型 | 保留原因 |
|---|---|
| 金额 | 案例参考价值所在 |

### 人工复核记录
- [ ] 已通读全文
- [ ] 已排查语境中的可识别线索
- [ ] 替换一致性已核对
```

## 强制校验项

- [ ] 已启用 `--auto`
- [ ] 当事人已用 `--entity` 逐一指定，**未依赖自动识别**
- [ ] 代号有法律意义，读者能看懂关系
- [ ] 待确认清单已逐项判断
- [ ] **已通读全文排查语境线索**
- [ ] 替换对照表内部留存，**不随文件外发**
- [ ] 金额、日期等结构信息按用途决定保留或脱敏

## 边界与降级

**脚本不保证完备。** 人名、别称、绰号、特定事件描述都可能反向识别到当事人。**脱敏的最后一道关永远是人。**

**替换对照表要留存但不外发。** 律所内部需要能追溯到原案，但对照表外泄等于没脱敏。

**已公开的裁判文书另论。** 引用公开文书时案号可保留，但当事人信息在裁判文书网上本就已做处理，不必二次脱敏。

## 示例

**示例一 · 一致性**
输入：`帮我把这个案子脱敏，要做培训材料。`
→ 先列当事人清单指定代号（原告/被告公司/被告法定代表人），跑 `--auto`，再过待确认清单，最后**通读全文**。

**示例二 · 边界**
输入：`脚本跑完了，可以发了吧？`
→ **不能**。脚本处理模式化信息，「本市唯一一家 XX 资质企业」这类语境线索查不出来，必须通读。
$md$, '[{"path": "SKILL.md", "size": 5538}, {"path": "references/output-formats.md", "size": 9672}, {"path": "scripts/anonymize.py", "size": 9049}, {"path": "evals/evals.json", "size": 1249}, {"path": "LICENSE", "size": 1080}, {"path": "来源说明.txt", "size": 417}]'::jsonb, 'downloads/external/util-anonymize.zip', 14483, 'published', 'seed', now()
from public.hub_skills where slug = 'util-anonymize'
on conflict (skill_id, version) do nothing;

insert into public.hub_skills(slug, display_name, summary, category, source, author, license, source_url, detail_url, visibility, status, latest_version)
values ('util-contract-diff', '合同版本比对', '逐处标出改动，判断对我方是变好还是变坏。', '工具', '开源', 'John He', 'MIT', 'https://github.com/Decikingship/legal-agent-skills', null, 'public', 'published', '1.0.0')
on conflict (slug) do nothing;
insert into public.hub_versions(skill_id, version, changelog, skill_md, files, static_url, size_bytes, status, reviewed_email, reviewed_at)
select id, '1.0.0', '首次收录', $md$---
name: 合同版本比对
description: 比对合同两个版本的差异，并按立场判断每处改动对我方是变好还是变坏，区分实质变更与文字调整，单独标出新增与删除的条款。务必在用户提到"对方回稿了""帮我看看改了什么""版本比对""这次改动有什么影响""对方动了哪些地方""跟上一版有什么不同""他们把哪条删了"时使用本 skill；用户上传两个版本的合同并要求对比时同样使用。用户只有一个版本要审查，用 nonlit-review-contract。
---

# 合同版本比对

> 技术标识：`util-contract-diff`

**不是普通 diff。** 普通 diff 告诉你"哪几个字变了"，律师要的是：**这次改动对我方是变好还是变坏？**

所以本 skill 在文本比对之外，对改动前后各跑一遍风险信号扫描，按立场比较增减——「异议期从 30 日改回 3 日」「悄悄删掉责任上限的例外情形」这类回稿伎俩会被直接标出来。

## 适用场景 / 不适用场景

| 情形 | 处置 |
|---|---|
| 对方回稿，要看改了什么、影响如何 | 本 skill |
| 只有一个版本要审 | 「合同审查」 |
| 要给改法 | 「条款范本与修改建议」 |

## 输入要素清单

**必需**
- 两个版本的合同文本
- **立场** —— 同一处改动对甲乙双方意义相反

## 依赖

- 脚本：`scripts/contract_diff.py`（复用「合同审查」的条款切分与风险规则，避免两处维护出现口径不一致）
- 配合：「条款范本与修改建议」（针对变差的条款给改回来的文本）

## 工作流程

### 第一步：跑比对

```bash
python3 scripts/contract_diff.py --old 我方发出稿.txt --new 对方回稿.txt --stance 乙方
```

脚本完成：条款级配对（标题变了也能按相似度配上）→ 字符级差异 → 实质变更/文字调整分类 → **改动前后风险信号对比** → 新增与删除条款单列。

### 第二步：先看新增与删除

**这两类最容易被忽略。** 逐字比对时注意力都在改动的字上，对方悄悄删掉一条对其不利的条款，很难被注意到。脚本单独列出，**先看这两块**。

### 第三步：看实质修改的影响判定

| 判定 | 含义 |
|---|---|
| 🔴 对我方变差 | 新增了不利信号或原有信号升级 |
| 🟢 对我方变好 | 移除了不利信号或降级 |
| ⚠️ 有得有失 | 须逐项权衡，通常是对方的交换条件 |
| ⚪ 风险信号无变化 | **不等于无影响**，见下 |

### 第四步：读那些"信号无变化"的改动

**这是最容易失守的地方。** 金额、期限、标的范围、付款比例的调整不产生风险信号，但可能正是本次谈判最关键的让步。「合同总价从 500 万改为 480 万」——零信号，但这是 20 万。「交付期从 30 日改为 45 日」——零信号，但可能影响下游履约。

**这类改动必须靠人读，脚本看不出来。**

### 第五步：针对变差的条款给改回来的方案

转 `「条款范本与修改建议」`，取对应立场的替代文本。

## 输出模板

```markdown
# 合同版本比对报告

---
**立场**：乙方 | **旧版**：我方发出稿 | **新版**：对方回稿 20XX-XX-XX
---

## 一、汇总
实质修改 X 处（对我方变差 X、变好 X、有得有失 X）、新增条款 X、删除条款 X、文字性调整 X

## 二、⚠️ 新增与删除的条款（优先看）

### ➕ 新增：第七条 保密
> 乙方对本合同信息负永久保密义务……

**风险信号**：无限期保密/竞业（🟡 中，不利于我方）
**评价**：<该条为何被加入、是否可接受>

### ➖ 删除：第X条 <条款名>
**原条款**：> ……
**原风险信号**：<对我方是保护还是负担>
**评价**：<删掉对我方意味着什么>

## 三、对我方变差的修改

### 第三条 质量与验收 🔴
**删除**：「三十日内提出质量异议」
**新增**：「三日内提出质量异议」
**影响**：新增「异议/索赔期过短」信号（🔴 高，不利于我方）
**建议**：<改回来的文本，或可接受的折中>

## 四、对我方变好的修改
<简要列出，确认无隐藏代价>

## 五、有得有失的修改
<逐项权衡：对方给了什么、要了什么>

## 六、信号无变化但需人工确认的改动
| 条款 | 改动 | 需确认 |
|---|---|---|
| 第二条 | 总价 500 万 → 480 万 | 商业条款变化，须业务方确认 |

## 七、下一步
<哪些必须改回、哪些可接受、哪些需要业务方决策>
```

## 强制校验项

- [ ] **立场已指定**，未使用默认
- [ ] 已优先检查新增与删除的条款
- [ ] 已人工通读「信号无变化」的改动，未依赖脚本判定
- [ ] 金额、期限、比例类改动已单独列出并标注需业务方确认
- [ ] 对我方变差的每处都给了改回方案或折中方案
- [ ] 对我方变好的改动已确认无隐藏代价（如以别处让步为交换）
- [ ] 商业条款变化未替客户做决定

## 边界与降级

**换立场必须重跑。** 影响判定是反的，不能改几个字复用。

**风险信号无变化 ≠ 改动无影响。** 这是本 skill 最需要提醒的一点——脚本能判的是有文本特征的风险，判不了商业条款的价值变化。

**条款配对可能出错。** 对方大幅重排结构时，相似度配对可能失准。配对结果异常（如相似度很低却被配成一对）时，改为人工核对。

**不替客户做商业决定。** 「总价降了 20 万」是事实陈述，「这个价格能不能接受」是商业判断。

## 示例

**示例一 · 典型场景**
输入：`对方回稿了，我们是乙方，看看改了什么。`
→ 实测：四条实质修改均对乙方变好（异议期 3→30 日、违约金 30%→日万分之五封顶、单方解除改为列明情形、管辖改为履行地），但**新增第七条永久保密义务**（🟡 对乙方不利）——这就是对方让步的交换条件。

**示例二 · 边界**
输入：`信号都说变好了，那我直接签？`
→ 不能。提醒：① 新增的保密条款是对方的交换条件；② 金额、期限类改动不产生信号，须逐条核对；③ 建议对变化最大的几条再跑一次完整审查。
$md$, '[{"path": "SKILL.md", "size": 6491}, {"path": "references/output-formats.md", "size": 9672}, {"path": "references/review_contract.py", "size": 19564}, {"path": "scripts/contract_diff.py", "size": 9366}, {"path": "evals/evals.json", "size": 1198}, {"path": "LICENSE", "size": 1080}, {"path": "来源说明.txt", "size": 417}]'::jsonb, 'downloads/external/util-contract-diff.zip', 22809, 'published', 'seed', now()
from public.hub_skills where slug = 'util-contract-diff'
on conflict (skill_id, version) do nothing;

insert into public.hub_skills(slug, display_name, summary, category, source, author, license, source_url, detail_url, visibility, status, latest_version)
values ('util-case-file-index', '卷宗解析与编目', '按文件名分类编目，查重复件和缺失材料。', '工具', '开源', 'John He', 'MIT', 'https://github.com/Decikingship/legal-agent-skills', null, 'public', 'published', '1.0.0')
on conflict (slug) do nothing;
insert into public.hub_versions(skill_id, version, changelog, skill_md, files, static_url, size_bytes, status, reviewed_email, reviewed_at)
select id, '1.0.0', '首次收录', $md$---
name: 卷宗解析与编目
description: 扫描卷宗目录并编目——按文件名分类推定证据种类、检测重复件与体积异常、按案由检查关键材料缺失、生成证据目录。务必在用户提到"卷宗""材料太多了""整理一下文件""证据目录""编目""这堆扫描件""接手案件的材料""归档"时使用本 skill；用户接手案件拿到一堆文件需要理清时同样使用。
---

# 卷宗解析与编目

> 技术标识：`util-case-file-index`

律师接手案件时拿到的往往是一堆命名混乱的扫描件。

**编目的价值不在整理整齐，在于发现问题**——重复件、缺失件、空白页、无法判断类型的文件，这些才是要处理的。

## 四类自动检查

| 检查 | 为什么重要 |
|---|---|
| **重复件** | 同一份材料重复提交，会被对方质疑证据组织混乱 |
| **关键材料缺失** | 按案由推定应有的材料，缺了要尽早补 |
| **体积异常** | 几 KB 的扫描件多半是空白页或扫描失败 |
| **类型待确认** | 文件名看不出内容的（`IMG_20240301.jpg`），必须打开看 |

## 适用场景 / 不适用场景

| 情形 | 处置 |
|---|---|
| 接手案件后的材料梳理 | 本 skill |
| 编制正式证据目录 | 本 skill + 「证据清单与举证责任」 |
| 举证责任分配 | 「证据清单与举证责任」 |
| 事实梳理 | 「案件事实时间轴」 |

## 输入要素清单

**必需**：卷宗目录路径
**建议**：案由（用于缺失检查，支持劳动争议/买卖合同/借款合同/建设工程/股权转让）

## 依赖

- 脚本：`scripts/case_file_index.py`
- 下游：「证据清单与举证责任」（编目结果作为证据清单的基础）、「案件事实时间轴」

## 工作流程

### 第一步：跑编目

```bash
python3 scripts/case_file_index.py --dir ./卷宗 --case-type 劳动争议 --output-catalog
```

### 第二步：先处理四类问题，再看清单

**重复件**：确认是同一份还是不同版本（扫描件页码不同可能是不同批次）。同一份的合并；不同版本的保留并说明差异。

**缺失材料**：脚本按关键词匹配，可能有误报（文件名叫「工资流水」而清单写「工资发放记录」）。逐项确认后，真缺的列入取证计划。

**体积异常**：打开看，空白页删除，扫描失败的重扫。

**类型待确认**：必须打开，不能靠猜。

### 第三步：核对证据种类推定

⚠️ 脚本按**文件名**推定种类，须打开核对。

**「考勤记录微信截图」是电子数据不是书证**——形式要件要求完全不同（须证明来源真实、内容完整、未经篡改，建议公证并保留原始载体）。判错会漏掉整块准备工作。

### 第四步：OCR

扫描件须 OCR 后方可全文检索与引用。

⚠️ **OCR 结果必须校对**。法律文书中的数字与人名识别错误后果严重——金额少一位、人名错一字，庭上就是事故。

### 第五步：转证据清单

编目结果接「证据清单与举证责任」，补充证明对象、举证责任方、页码。

## 输出模板

```markdown
## 卷宗编目

**目录**：./卷宗｜**文件总数**：X｜**案由**：劳动争议

### 一、⚠️ 待处理问题
| 类型 | 数量 | 明细 | 处置 |
|---|---|---|---|
| 疑似重复 | 1 组 | 劳动合同扫描件 / _副本 | 核对后合并 |
| 关键材料缺失 | 2 类 | 规章制度、仲裁裁决书 | 列入取证计划 |
| 体积异常 | 1 | 空白页.jpg | 打开确认后删除 |
| 类型待确认 | 2 | IMG_20240301.jpg | 打开归类 |

### 二、分类统计
| 分类 | 数量 |
|---|---|

### 三、证据目录（草稿）
| 序号 | 证据名称 | 证据种类 | 证明对象 | 页码 | 原件在手 |
|---|---|---|---|---|---|
| 1 | 劳动合同 | 书证 | <待补> | <待补> | <待补> |

### 四、后续动作
- [ ] OCR：X 个扫描件
- [ ] 补充材料：……
- [ ] 转「证据清单与举证责任」补充证明对象
```

## 强制校验项

- [ ] 四类问题已逐项处置，**未只看清单不看问题**
- [ ] 证据种类推定已打开文件核对
- [ ] 电子数据与书证已正确区分
- [ ] 扫描件已安排 OCR，**OCR 结果已校对**
- [ ] 缺失材料清单已人工确认（关键词匹配可能误报）
- [ ] 证据目录的证明对象、页码已补全后再提交

## 边界与降级

**推定不等于确认。** 脚本只看文件名，一切种类推定都须打开核对。

**缺失检查有边界。** 只覆盖五类常见案由的通用材料，特殊案件的必备材料须自行补充。

**不读文件内容。** 本 skill 做的是编目，不做内容分析——内容分析靠人读或交给相应的分析 skill。

## 示例

**示例一 · 发现问题**
输入：`客户给了一堆材料，帮我理一下。`
→ 实测检出：2 份内容相同的扫描件（重复）、1 个 5KB 文件（疑似空白页）、2 个文件名无法判断类型、缺规章制度与仲裁裁决书两类关键材料。**这四项比"共 8 个文件"有用得多。**

**示例二 · 种类判错的后果**
输入：`考勤记录的微信截图算书证吧？`
→ **不算，是电子数据**。形式要件完全不同——须证明来源真实、内容完整、未经篡改，建议公证并保留原始载体。判成书证会漏掉这整块准备。
$md$, '[{"path": "SKILL.md", "size": 5556}, {"path": "references/output-formats.md", "size": 9672}, {"path": "scripts/case_file_index.py", "size": 9228}, {"path": "evals/evals.json", "size": 947}, {"path": "LICENSE", "size": 1080}, {"path": "来源说明.txt", "size": 417}]'::jsonb, 'downloads/external/util-case-file-index.zip', 14511, 'published', 'seed', now()
from public.hub_skills where slug = 'util-case-file-index'
on conflict (skill_id, version) do nothing;

insert into public.hub_skills(slug, display_name, summary, category, source, author, license, source_url, detail_url, visibility, status, latest_version)
values ('oa-chengbenpiao', '华炬 OA 成本票技能', '让 AI 把成本票批量录入 OA「我的票池」，自动识别、校验、出对账单。涉及内部系统，仅对所内同事开放。', '办公', '所内', '吴玉寒', null, null, 'skills/oa-chengbenpiao.html', 'internal', 'published', null)
on conflict (slug) do nothing;
