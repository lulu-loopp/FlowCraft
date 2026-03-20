# 综合测试报告：Skill / 预览 / Flow 生成 / 执行器

**测试日期**: 2026-03-19
**测试环境**: Windows 11, Node.js, Dev Server (localhost:3000)

---

## Round 1: Skill 画像验证 ✅ 已完成

所有 skill 画像已验证准确，详见 `skills/index.json`。

| Skill | Tags | RequiredTools | OutputFileTypes | Status |
|-------|------|---------------|-----------------|--------|
| pptx | file_output, knowledge, delegation, visual | python_execute | .pptx | ✅ |
| docx | file_output, knowledge, code_gen | python_execute | .docx | ✅ |
| xlsx | file_output, knowledge | python_execute | .xlsx, .xlsm, .csv, .tsv | ✅ |
| pdf | file_output, knowledge, code_gen, delegation | python_execute, code_execute | .pdf, .txt, .xlsx, .jpg | ✅ |
| design-taste-frontend | knowledge, visual | (none) | (none) | ✅ |
| flow-design | knowledge | (none) | (none) | ✅ |
| full-output-enforcement | knowledge | (none) | (none) | ✅ |
| skill-creator | knowledge, delegation | (none) | (none) | ✅ |

---

## Round 2: 预览功能测试

### 2.1 PDF 预览 ✅
- `GET /api/workspace/{flowId}/preview?path=test.pdf`
- 返回: `{ format: "iframe", url: "/api/workspace/.../file?path=test.pdf" }`
- 符合预期

### 2.2 DOCX 预览 ✅
- `GET /api/workspace/{flowId}/preview?path=test.docx`
- 返回: `{ format: "html", content: "<div class='docx-preview'>..." }` (1442 chars)
- mammoth 转换正常，包含表格和标题样式

### 2.3 XLSX 预览 ✅
- `GET /api/workspace/{flowId}/preview?path=test.xlsx`
- 返回: `{ format: "html", content: "<div class='xlsx-preview'>..." }` (2876 chars)
- SheetJS 转换正常，多 Sheet 支持正确 (Sales Data + Summary)

### 2.4 PPTX 预览 ✅
- `GET /api/workspace/{flowId}/preview?path=test.pptx`
- 返回: `{ format: "markdown", content: "<!-- Slide number: 1 -->\n# Test Presentation..." }`
- markitdown 正常工作

### 2.5 Fallback / 边界测试
| 测试 | 结果 | 详情 |
|------|------|------|
| 不支持的扩展名 (.txt) | ✅ 400 | "Preview not supported for .txt files" |
| 路径穿越 (../../..) | ✅ 400 | "Invalid path" |
| 缺少 path 参数 | ✅ 400 | "path parameter required" |
| 不存在的文件 (.docx) | ✅ 404 | "File not found" (修复后) |
| 不存在的文件 (.xlsx) | ✅ 404 | "File not found" (修复后) |
| 不存在的文件 (.pdf) | ✅ 404 | "File not found" (修复后) |

---

## Round 3: AI 生成 Flow 测试（复杂场景，standard 模式）

移除了 simple 模式后，使用 standard 模式（含 web search）进行 5 个复杂真实工作场景测试。

### T1 竞品分析报告（多阶段调研+文档）✅
- **输入**: "帮我做一个竞品分析：先搜索三家竞争对手的产品信息，然后从多个维度对比分析，最后生成Word竞品分析报告和Excel对比表格"
- **结果**: 10 nodes, 11 edges
  - ✅ 3 个并行竞品研究员 agent，各配 `web_search` + `url_fetch`
  - ✅ Merge 节点汇总研究结果
  - ✅ Word 报告生成器: skills=["docx"], tools=["python_execute"]
  - ✅ Excel 表格生成器: skills=["xlsx"], tools=["python_execute"]
  - ✅ 双 Output（Word + Excel 分别输出）
  - ✅ 所有 agent systemPrompt 长度充足

### T2 会议纪要→待办分配（审核循环）✅
- **输入**: "会议录音转写文本 → 提取要点 → 生成Word纪要+Excel任务表 → 经理审核通过才定稿，不通过就修改重来"
- **结果**: 5 nodes, 5 edges
  - ✅ 会议纪要生成器: skills=["docx", "xlsx"], tools=["python_execute"]
  - ✅ 经理审核员: tools=["python_execute"]（可检查文件存在性）
  - ✅ Condition 节点: maxLoopIterations=3
  - ✅ 回线 (false-handle → 执行者)，形成完整循环
  - ✅ true-handle → Output

### T3 数据分析 Pipeline（代码+可视化+报告）✅
- **输入**: "用Python清洗CSV数据 → 统计分析和可视化 → PDF报告 + Excel汇总表"
- **结果**: 7 nodes, 7 edges
  - ✅ CSV清洗 agent: tools=["python_execute"]
  - ✅ 数据分析 agent: tools=["python_execute"]
  - ✅ PDF报告生成: skills=["pdf"], tools=["python_execute"]
  - ✅ Excel汇总: skills=["xlsx"], tools=["python_execute"]
  - ✅ Merge 节点汇总并行输出

### T4 产品发布准备（并行多文档+汇总审核）✅
- **输入**: "同时准备PPT介绍、Word功能说明、Excel定价表，汇总审核确保信息一致"
- **结果**: 9 nodes, 11 edges
  - ✅ PPT 生成器: skills=["pptx", "full-output-enforcement"], tools=["python_execute"]
  - ✅ Word 生成器: skills=["docx", "full-output-enforcement"], tools=["python_execute"]
  - ✅ Excel 生成器: skills=["xlsx", "full-output-enforcement"], tools=["python_execute"]
  - ✅ Merge 节点汇总三份文档
  - ✅ 一致性审核 agent + Condition + 回线循环
  - ✅ AI 自动加入了 full-output-enforcement skill（确保完整输出）

### T5 学术论文辅助（搜索+分析+写作+审核）✅
- **输入**: "搜索最新研究文献 → 整理综述 → 撰写论文 → 学术审稿人审核，不合格就修改"
- **结果**: 7 nodes, 7 edges
  - ✅ 文献研究员: tools=["web_search", "url_fetch"]
  - ✅ 综述分析师（无工具，纯文本分析）
  - ✅ 论文写手: skills=["docx"], tools=["python_execute"]
  - ✅ 学术审稿人: tools=["python_execute"]
  - ✅ Condition + 回线循环（审稿不通过回到写手修改）

---

## Round 4: Flow 执行测试（代码审查）

### 4.1 Artifact 检测逻辑 ✅
- `snapshotWorkspaceFiles()` 在 agent 执行前快照文件列表
- `detectNewArtifacts()` 在执行后对比新增文件
- `buildArtifactContext()` 为下游节点构建 `[Upstream Artifacts]` 上下文
- 仅在 agent 有 enabledSkills 或 enabledTools 时触发（性能优化）

### 4.2 Artifact 传递到下游 ✅
- `executeNodeWork()` 收集上游 artifacts: `upstreamArtifactList`
- 通过 `buildArtifactContext()` 注入到 nodeInput
- 下游 agent 接收 `[Upstream Artifacts]` 段落，包含文件路径和大小

### 4.3 循环 Flow 执行 ✅
- `detectCycles()` + `findLoopEdgeIds()` 正确识别回线
- `removeFromCompleted()` 在循环时重置路径上的节点状态
- `maxLoopIterations` 限制生效，超限后 `setNodeWarning()`
- Artifacts 在循环中正确累积（`[...existing, ...result.artifacts]`）

---

## Round 5: 边界情况

### 5.1 无 API Key ✅
- Skill analyze API 正确返回 400: "No API key configured for skill analysis"
- 不存在的 skill 返回 "Skill not found in registry"

### 5.2 文件不存在 ✅ (已修复)
- 修复前: 返回 500 + 泄漏完整文件系统路径
- 修复后: 返回 404 "File not found"

### 5.3 错误信息安全 ✅ (已修复)
- 错误信息中的文件系统路径被替换为 `<path>`

---

## Round 6: 复杂端到端执行测试 ✅

实际运行 3 个复杂多阶段流程，验证文件生成、Artifact 传递、预览功能。

### T1 数据分析 Pipeline: CSV → Python 分析+图表 → PDF 报告 ✅
- **Stage 1**: 生成 `sales_2026.csv` 模拟销售数据
- **Stage 2**: Python 数据分析 → 生成 3 张图表 (`product_quantity.png`, `region_sales.png`, `sales_analysis_summary.png`)
- **Stage 3**: 使用 reportlab 生成 `analysis-report.pdf` (620KB)，包含图表嵌入
- **Artifact 传递**: ✅ 每阶段正确读取上游文件
- **预览**: ✅ PDF → iframe 格式
- **总文件数**: 5 个

### T2 并行双文档: PPTX + DOCX 同时生成 → 合并审核 ✅
- **Stage 1a**: 生成 `q1-review.pptx` (33KB)
- **Stage 1b**: 生成 `q1-review-report.docx` + `q1-review-report-detailed.docx` (39KB)
- **Stage 2**: 审核 agent 成功读取两份文件，输出详细一致性审核报告（含主题匹配度、内容覆盖度分析）
- **跨格式引用**: ✅ 审核者正确引用了 PPTX 和 DOCX 的内容
- **预览**: ✅ PPTX → markdown, DOCX → html

### T3 跨格式转换: XLSX 数据 → DOCX 报告 + PDF 摘要 ✅
- **Stage 1**: 生成 `employee_survey.xlsx` 员工满意度调查数据
- **Stage 2**: 分析数据生成 `survey-report.docx` + `survey-report-final.docx`
- **Stage 3**: 生成 `survey-summary.pdf` 执行摘要
- **全格式预览**: ✅ XLSX → html, DOCX → html, PDF → iframe
- **总文件数**: 4 个

### 关键发现
- ✅ `workspaceCwd` 修复有效：所有文件正确落在 `workspace/flow-e2e-complex/`
- ✅ 多阶段 Artifact 传递链稳定（3 阶段串行均正常）
- ✅ 并行分支生成后下游可正确读取所有文件
- ✅ 全部 4 种富预览格式（PDF/DOCX/XLSX/PPTX）在实际生成文件上正常工作
- ✅ Agent 自动 `pip install` 缺失依赖（reportlab, matplotlib 等）后重试成功

---

## 修复清单

### 已修复

| ID | 严重度 | 问题 | 修复 |
|----|--------|------|------|
| B1 | P1 | Preview API 对不存在文件返回 500 + 泄漏路径 | 添加 `fs.access()` 前置检查，返回 404；错误信息中路径脱敏 |
| B2 | P1 | Simple 模式下 LLM 无法可靠生成循环结构 | 移除 simple 模式，统一使用 standard/professional |
| B3 | P1 | Flow 生成可能产出无 agent 的空流程 | 添加 post-generation 校验，拒绝无 agent 流程 |
| B4 | P1 | Prompt 对并行→merge / 审核→loop 约束不够强 | 强化 merge 必须性描述；添加 REVIEW_KEYWORDS 自动检测 + 显式循环模式提示 |

---

## 关键文件变更

| 文件 | 变更 |
|------|------|
| `src/app/api/workspace/[flowId]/preview/route.ts` | 添加文件存在性检查 + 错误信息脱敏 |
| `src/app/api/flow/generate/route.ts` | 移除 simple 模式；强化 prompt；审核关键词检测；post-generation 校验 |
| `src/components/home/ai-generate-section.tsx` | 移除 simple 选项 |
| `src/components/canvas/ai-generate-orb.tsx` | 移除 simple 选项 |
