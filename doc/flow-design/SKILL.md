---
name: flow-design
description: 工作流设计专家知识库，帮助 AI 生成高质量的 FlowCraft 工作流。当需要设计 AI Agent 工作流、生成 flow.json、规划多 Agent 协作结构、配置节点参数时，必须使用此 skill。包含完整的 flow 结构规则、节点类型说明、连线规范、布局规则、设计模式和常见错误避免指南。
---

# Flow Design Skill

你是 FlowCraft 的工作流设计专家。本 skill 为你提供生成高质量 flow.json 所需的完整知识。

---

## 一、Flow 的完整结构（必须遵守）

每一个 Flow 必须包含以下内容，缺一不可。

### 1. flow 顶层字段

AI 只需要输出以下三个字段，其他字段由代码自动生成：

```json
{
  "name": "流程的名称（中文，描述这个 flow 做什么）",
  "nodes": [...],
  "edges": [...]
}
```

name 命名规范：
- 好：竞品分析工作流、内容创作流程、代码质量审查
- 差：我的工作流、flow1、新建流程

### 2. 必须有 Input 节点（流程起点）

每个 flow 必须有且只有一个 Input 节点：

```json
{
  "id": "input-1",
  "type": "io",
  "position": { "x": 100, "y": 300 },
  "data": {
    "label": "输入",
    "inputText": "描述这个 flow 的用途或默认输入内容"
  }
}
```

### 3. 必须有 Output 节点（流程终点）

每个 flow 必须有至少一个 Output 节点：

```json
{
  "id": "output-1",
  "type": "output",
  "position": { "x": 1300, "y": 300 },
  "data": { "label": "输出结果" }
}
```

### 4. 必须有 edges（连线）

所有节点必须通过 edges 连接，没有连线的节点不会被执行。

普通 edge：
```json
{ "id": "e-source-target", "source": "源节点id", "target": "目标节点id" }
```

Condition 节点的 edge 必须指定 sourceHandle：
```json
{ "id": "e-cond-true", "source": "condition-1", "target": "agent-A", "sourceHandle": "condition-true" },
{ "id": "e-cond-false", "source": "condition-1", "target": "agent-B", "sourceHandle": "condition-false" }
```

**连线完整性检查（生成后自查）：**
- 每个节点（除 input 外）至少有一条 edge 连入
- 每个节点（除 output 外）至少有一条 edge 连出
- condition 节点的 true 和 false 两条出线都必须连出去

---

## 二、节点类型详解

### input — 输入节点
- 流程起点，必须有且只有一个
- 只有右侧 source handle，不能有节点连入它
- type: "io"

### output — 输出节点
- 流程终点，至少一个
- 只有左侧 target handle，不能从它连出到其他节点
- type: "output"

### agent — AI 执行节点
- 核心执行单元，完成具体任务
- 左侧 target handle + 右侧 source handle
- type: "agent"
- 必填：label、systemPrompt、provider、model
- 可选：enabledTools、maxIterations、completionCriteria

### condition — 条件判断节点
- 根据条件决定走哪条路
- 左侧 target handle（接收输入）
- 右上 source handle：sourceHandle = "condition-true"
- 右下 source handle：sourceHandle = "condition-false"
- 两条出线都必须连出去
- type: "condition"

### merge — 合并节点
- 等待所有上游完成后合并输出
- 多个左侧 target handle + 一个右侧 source handle
- 多路并行汇聚时必须用 merge，不能让多路直连一个 agent
- type: "merge"

### human — 人类介入节点
- 流程暂停，等待人类操作
- 左侧 target handle + 右侧 source handle
- type: "human"

---

## 三、布局规则

节点位置从左到右排列，起点 x=100，每列间距 300px：

```
单节点居中：y=300
同列2个节点：y=220 和 y=380
同列3个节点：y=140、y=300、y=460
同列4个节点：y=60、y=220、y=380、y=540
```

**典型布局示例：**
```
Input(100,300)
  → 研究员A(400,220)  ─→ Merge(700,300) → 分析师(1000,300) → Output(1300,300)
  → 研究员B(400,380)  ─→
```

---

## 四、完整 Flow 示例（务必参考此格式）

```json
{
  "name": "竞品分析工作流",
  "nodes": [
    {
      "id": "input-1",
      "type": "io",
      "position": { "x": 100, "y": 300 },
      "data": { "label": "分析目标", "inputText": "请输入要分析的产品名称和竞品列表" }
    },
    {
      "id": "agent-ra",
      "type": "agent",
      "position": { "x": 400, "y": 220 },
      "data": {
        "label": "功能研究员",
        "systemPrompt": "你是专业的产品功能分析师，拥有8年SaaS产品研究经验。\n\n核心职责：\n1. 深入调研产品的核心功能模块\n2. 收集真实用户评价\n3. 整理功能对比数据\n\n工作方式：\n- 优先搜索官方文档和用户评论\n- 区分官方宣传和真实体验\n- 记录关键信息来源\n\n输出：结构化Markdown，每个功能模块独立成节，1000-2000字",
        "enabledTools": ["web_search"],
        "maxIterations": 12,
        "provider": "deepseek",
        "model": "deepseek-chat",
        "completionCriteria": ["覆盖所有核心功能模块", "有用户评价数据支撑"]
      }
    },
    {
      "id": "agent-rb",
      "type": "agent",
      "position": { "x": 400, "y": 380 },
      "data": {
        "label": "定价研究员",
        "systemPrompt": "你是专业的定价策略分析师，专注于SaaS产品商业模式研究。\n\n核心职责：\n1. 调研竞品的完整定价体系\n2. 分析各价格档位的功能差异\n3. 研究定价策略背后的商业逻辑\n\n工作方式：\n- 访问官方定价页面获取准确数据\n- 搜索用户对定价的评价\n- 注意免费/试用政策\n\n输出：定价方案对比表 + 分析说明，800-1500字",
        "enabledTools": ["web_search", "url_fetch"],
        "maxIterations": 10,
        "provider": "deepseek",
        "model": "deepseek-chat",
        "completionCriteria": ["包含所有价格档位", "有免费和付费功能对比"]
      }
    },
    {
      "id": "merge-1",
      "type": "merge",
      "position": { "x": 700, "y": 300 },
      "data": { "label": "汇总研究结果" }
    },
    {
      "id": "agent-analyst",
      "type": "agent",
      "position": { "x": 1000, "y": 300 },
      "data": {
        "label": "竞品分析师",
        "systemPrompt": "你是资深竞品战略分析师，擅长从多维度数据中提炼战略洞察。\n\n核心职责：\n1. 综合功能和定价研究，撰写深度竞品分析报告\n2. 进行SWOT分析\n3. 提出针对性的竞争建议\n\n工作方式：\n- 先整理所有输入数据，建立分析框架\n- 量化关键指标，用数据支撑判断\n- 结论要有可操作的建议\n\n输出：完整竞品分析报告，包含执行摘要、详细分析、SWOT、竞争建议，2000-4000字",
        "enabledTools": [],
        "maxIterations": 10,
        "provider": "anthropic",
        "model": "claude-sonnet-4-5",
        "completionCriteria": ["包含SWOT分析", "有明确的竞争建议", "报告结构完整"]
      }
    },
    {
      "id": "output-1",
      "type": "output",
      "position": { "x": 1300, "y": 300 },
      "data": { "label": "竞品分析报告" }
    }
  ],
  "edges": [
    { "id": "e-input-ra", "source": "input-1", "target": "agent-ra" },
    { "id": "e-input-rb", "source": "input-1", "target": "agent-rb" },
    { "id": "e-ra-merge", "source": "agent-ra", "target": "merge-1" },
    { "id": "e-rb-merge", "source": "agent-rb", "target": "merge-1" },
    { "id": "e-merge-analyst", "source": "merge-1", "target": "agent-analyst" },
    { "id": "e-analyst-output", "source": "agent-analyst", "target": "output-1" }
  ]
}
```

---

## 五、设计模式和节点模板

**详细设计模式**（并行/串行/质量门控/条件分支）→ 见 references/patterns.md
**节点配置模板**（研究员/分析师/写作助手/质检员等）→ 见 references/templates.md
**常见错误**（忘加 merge/连线/input/output 等）→ 见 references/antipatterns.md

---

## 六、核心设计原则

### 职责单一
每个 Agent 只做一件事，label 三个字能说清楚。

### 并行优先
能并行的绝不串行。并行后必须用 Merge 汇总。

### 连线完整
所有节点必须连线，孤立节点不执行。

### 成本意识
- 复杂分析/核心决策 → claude-sonnet-4-5 或 gpt-4o
- 一般执行 → deepseek-chat
- 简单处理 → deepseek-chat
