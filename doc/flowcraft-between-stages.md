# FlowCraft 阶段间任务文档
> 记录各阶段之间的独立小任务
> 这些任务不属于某个主阶段，但在两个阶段之间完成

---

## 第二阶段 → 第三阶段

> 完成时机：第二阶段 code review 通过后，第三阶段开始前

---

### 任务一：图片生成 Tool

**背景：**
让 agent 能够生成图片，丰富输出内容。
研究报告里能插图，PPT 里能有配图，用户感知明显。

**实现范围：**

新增 image-generate tool，和现有 web_search / calculator 同级：

```typescript
// src/lib/tools/image-generate.ts

interface ImageGenerateParams {
  prompt: string
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  style?: 'natural' | 'vivid'
  model?: 'nano-banana' | 'nano-banana-2' | 'nano-banana-pro' |
          'imagen-3' | 'dall-e-3' | 'stable-diffusion'
}

interface ImageGenerateResult {
  url: string
  prompt: string
  model: string
}
```

支持的模型：

```
Google Nano Banana 系列（Gemini API key）：
  nano-banana       → gemini-2.5-flash-image
                      速度和质量的平衡
  nano-banana-2     → gemini-3.1-flash-image-preview
                      高效版，适合高频使用
  nano-banana-pro   → gemini-3-pro-image-preview
                      专业版，支持复杂指令和高保真文字渲染
                      支持 thinking 模式和最多 14 张参考图

Google Imagen 3（Gemini API key）：
  imagen-3          → imagen-3.0-generate-002
                      $0.03/张，高质量写实风格
                      所有图片自动添加 SynthID 数字水印

DALL-E 3（OpenAI API key）：
  dall-e-3          → 质量高，支持自然语言 prompt

Stable Diffusion / Flux（Replicate API key）：
  stable-diffusion  → 开源模型，价格更低
```

**节点输出区域支持图片渲染：**

agent 输出里包含图片 URL 时自动渲染：
```
┌─────────────────────────────────┐
│ 研究员              [完成]      │
├─────────────────────────────────┤
│ ## 竞品分析报告                 │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [生成的图片缩略图]           │ │
│ │ 市场份额对比图               │ │
│ │              [下载] [查看]  │ │
│ └─────────────────────────────┘ │
│                                 │
│ Dify 占据了...                  │
└─────────────────────────────────┘
```

图片渲染规则：
- Markdown 里的 `![alt](url)` 自动渲染成图片
- 图片 URL 以 `.png/.jpg/.webp` 结尾时自动渲染
- 缩略图最大高度 200px，点击查看原图
- 有下载按钮

**Settings 页面新增：**
```
图片生成
─────────────────────────
Google API Key（Nano Banana / Imagen）
  [未设置]  [添加]
  支持：Nano Banana / Nano Banana 2 / Nano Banana Pro / Imagen 3

OpenAI API Key（DALL-E 3）
  [已设置]  [修改]

Replicate API Key（Stable Diffusion / Flux）
  [未设置]  [添加]

默认图片生成模型：
  ● Nano Banana 2（推荐，速度快，需要 Google API key）
  ○ Nano Banana Pro（质量最高，需要 Google API key）
  ○ Imagen 3（写实风格，$0.03/张）
  ○ DALL-E 3（需要 OpenAI API key）
  ○ Stable Diffusion（需要 Replicate API key）
```

**新增文件：**
```
src/
├── lib/tools/
│   └── image-generate.ts
└── components/canvas/nodes/
    └── image-output.tsx    # 图片渲染组件
```

**新增 API Route：**
```
POST /api/tools/image-generate
body: { prompt, size, style, model }
返回: { url, prompt, model }
```

---

### 任务二：YAML 导出 / 导入

**背景：**
让用户能备份、分享、版本控制 flow。
YAML 比 JSON 更人类可读，适合手动编辑和 Git 管理。

**导出（Flow → YAML）：**

```yaml
# FlowCraft Flow
name: 竞品分析流程
version: "1.0"
created: "2024-01-15"

nodes:
  - id: input-1
    type: input
    position: { x: 80, y: 300 }
    data:
      label: 分析目标
      inputText: 分析 Dify 的竞品

  - id: researcher-1
    type: agent
    position: { x: 320, y: 300 }
    data:
      label: 研究员
      systemPrompt:
        zh: 你是一个专业的研究员...
        en: You are a professional researcher...
      enabledTools:
        - web_search
      maxIterations: 10
      provider: deepseek
      model: deepseek-chat

edges:
  - source: input-1
    target: researcher-1
```

**导入（YAML → Flow）：**

支持两种方式：
- 顶部工具栏 [Upload 导入 YAML] 按钮
- 把 YAML 文件拖到画布上

导入时：
- 所有节点生成新的唯一 id
- 不覆盖现有 flow，新建一个
- 导入成功后跳转到新 flow

**UI 入口：**
```
顶部工具栏：
  [Download 导出 YAML]  → 下载当前 flow 的 YAML 文件
  [Upload 导入 YAML]    → 弹出文件选择器

首页：
  [+ 新建 Flow] 按钮旁边加 [Upload 从 YAML 导入]
```

**新增 API Routes：**
```
GET  /api/flows/:id/export/yaml    导出为 YAML
POST /api/flows/import/yaml        从 YAML 导入，返回新 flowId
```

**新增文件：**
```
src/lib/
├── flow-yaml-exporter.ts    # flow.json → YAML
└── flow-yaml-importer.ts    # YAML → flow.json
```

---

### 任务三：flow.json Schema 文档化

**背景：**
让进阶用户知道如何手写或程序化生成 flow.json，
无需打开画布就能创建 flow。

**内容：**
- flow.json 的完整字段说明
- 每种节点类型的 data 字段规范
- 示例文件
- 放在项目 README 或 docs/ 目录里

**工作量极小，写文档即可，不涉及代码改动。**

---

### 任务四：AI 生成 Flow

**背景：**
用户用自然语言描述需求，AI 自动生成节点和连线。
flow.json 本身就是结构化数据，AI 可以直接生成。

**实现：**

新增 `/api/flow/generate` route：
```typescript
POST /api/flow/generate
body: { description: string }
返回: { nodes: Node[], edges: Edge[] }
```

Prompt 设计：
```
你是一个 FlowCraft 流程设计师。
根据用户需求，生成一个 flow.json。

可用节点类型和说明：
  input：流程起点
  output：流程终点
  agent：有自主思考能力的 AI
  condition：if/else 分支
  merge：合并多个上游输出
  ...（完整节点类型说明）

用户需求：{description}

输出严格的 JSON，不要有任何其他内容：
{
  "nodes": [...],
  "edges": [...]
}
```

**UI 入口：**

首页新增"AI 帮我生成"入口：
```
┌──────────────────────────────────────────┐
│ 描述你想要的工作流程                      │
│ ┌──────────────────────────────────────┐ │
│ │ 例如：做一个竞品分析流程，先并行搜   │ │
│ │ 索多个竞品，然后汇总成报告...        │ │
│ └──────────────────────────────────────┘ │
│                    [Sparkles AI 生成]    │
└──────────────────────────────────────────┘
```

生成后：
- 画布上动态出现节点（带飞入动画）
- 用户可以继续手动调整
- 顶部提示："AI 已生成流程，你可以继续编辑"

**新增文件：**
```
src/
├── app/api/flow/generate/route.ts
└── components/canvas/
    └── ai-generate-panel.tsx
```

---

## 第三阶段 → 第四阶段

> 待规划，等第三阶段完成后补充

---

## 备注

```
这些任务的共同特点：
  独立性强，不依赖主阶段的架构改动
  工作量相对小（1-3天）
  价值明确，用户感知明显

实现顺序建议（第二阶段 → 第三阶段之间）：
  任务零：Pack 节点部分成功策略（P1，Phase 3 开始前必须完成）
  任务一：Google API + 多模态标注
  任务二：图片生成 Tool
  任务三：YAML 导出/导入 + Schema 文档
  任务四：AI 生成 Flow（基础版）✓ 已完成
  任务五：AI 生成 Flow 增强版
  任务六：模型列表统一（Settings 和 MODEL_OPTIONS 对齐）

待处理（各任务完成后统一处理）：
  Settings 页面的模型列表和 src/types/model.ts 的 MODEL_OPTIONS 不一致
  需要统一。涉及文件：settings 页面 + src/types/model.ts

Phase 3 待评估想法：
  节点多 handle 类型设计（text handle + file handle）
  Agent 节点有两个出口：一个输出文字，一个输出文件
  下游 Agent 可以选择只接文字 handle 或同时接两个 handle
  当前时机不对（波及执行引擎、边连接校验、Pack 端口映射）
  Phase 3 做多 Agent 协作时一起考虑 text/file/structured-data 多 handle
```

---

## 附：任务零（P1）— Pack 节点部分成功策略

> **优先级：P1，Phase 3 开始前完成。**
> 这是多 Agent 协作的基础能力，不做的话 Phase 3 的 Orchestrator 和多 Agent 并行场景都会受限。

### 背景

当前 Pack（封装节点）的失败处理逻辑为"全有或全无"：Pack 内部任一节点失败 → 整个 Pack 标记为 error → 所有外层下游节点都不执行。

这在 Phase 2 作为安全默认值是合理的，但在 Phase 3 多 Agent 协作场景下体验不佳。

### 问题描述

**Flow 结构示例：**
```
Input → Pack节点"王李和"（内含：老王Agent + 小李Agent，各自有独立的 output node）→ 外层两个 Output node
```

**当前行为：**
- 老王 Agent 因 API key 为空而执行失败（红色 ❌）
- 小李 Agent 执行成功，产出了完整的分析结果（绿色 ✅）
- Pack 节点整体被标记为 error（红色 ❌）
- 外层两个 output node 都不执行，都显示"等待上游节点输出..."
- **小李的成功输出被完全丢弃**

**期望行为（部分成功策略）：**
- 老王失败 → 老王对应的外层 output node 显示 error 状态
- 小李成功 → 小李对应的外层 output node 正常显示结果
- Pack 节点整体状态显示为"部分完成"（partial）而非全部失败
- 用户能清楚看到"老王失败了，但小李的分析可以用"

### 为什么 Phase 3 需要这个

Phase 3 的核心是多 Agent 协作。典型场景：
- 3 个 Agent 并行执行不同的研究方向，其中 1 个因为网络超时失败
- Orchestrator 节点协调多个子 Agent，部分子任务失败不应阻塞整体
- 人工介入节点等待某一路审批，其他路不应被阻塞

### 涉及的技术改动

**1. Pack 节点多输出 handle 映射**
Pack 内部每个 output node 对应外层 Pack 节点的一个独立输出 handle，每个 handle 独立传递状态（completed / error / skipped）。

**2. 执行引擎细粒度状态传播**
文件：`src/hooks/useFlowExecution.ts`、`src/lib/packed-executor.ts`

当前：Pack 执行结束后返回单一状态（success / error）
改为：返回每个输出 handle 的独立状态和数据

**3. 外层下游节点按 handle 判断**
当前：下游节点检查上游是否"completed"（二元判断）
改为：下游节点检查自己连接的具体 handle 的状态，而不是整个上游节点的状态

**4. Pack 节点 UI 新增 partial 状态**
```
全部成功 → completed（绿色 ✅）
全部失败 → error（红色 ❌）
部分成功 → partial（黄色 ⚠️）
```

**5. 服务端执行同步**
文件：`src/app/api/flows/[id]/run/route.ts`
服务端 flow 执行也需要支持部分成功逻辑，与前端行为保持一致。

### 已有基础

```
packed-executor.ts 内部已正确处理失败传播
Pack 内部的多 output node 已各自独立运行
执行引擎已有 completedIds / skippedIds / failedIds 集合
Pack 节点数据结构中已有 inlineFlow 字段
```

### 设计约束

```
部分成功策略只适用于 Pack 节点（内部有多条独立执行路径）
普通节点（单个 Agent）失败行为保持不变
Pack 内部只有一条串行路径时，退化为"全有或全无"
向后兼容：已有的 flow 文件不需要迁移
```

---

## 任务五：AI 生成 Flow 增强版

### 核心改进方向

**1. 生成 AI 做成真正的 Agent**
```
现在（基础版）：
  用户输入 → 一次 LLM 调用 → flow.json

增强版：
  用户输入
    → Agent 理解需求（必要时反问澄清）
    → Agent 搜索相关工作流案例（web_search）
    → Agent 研究最佳实践
    → Agent 多轮思考，设计 flow 结构
    → Agent 详细配置每个节点参数
    → 生成高质量 flow.json
    → 用户可以要求修改，Agent 继续迭代
```

**2. 复杂度分级**
```
简单模式（快速，~30秒）：
  直接生成，不搜索
  节点少，配置基础
  适合快速原型

标准模式（1-2分钟）：
  搜索参考案例
  详细配置每个节点的 system prompt
  适合大多数场景

专业模式（3-5分钟）：
  深度调研最佳实践
  多轮优化迭代
  完整配置（人格/工具/技能/验收标准）
  适合生产级别的 flow
```

**3. 节点配置详细化**
```
现在生成的节点只有 label 和基础 systemPrompt
增强版要生成：
  完整的 systemPrompt（有深度，有背景，有约束）
  合适的 tools 配置
  maxIterations 根据任务复杂度推断
  completionCriteria（验收标准）
  合理的 provider/model 选择
```

**4. 迭代修改能力**
```
生成完成后用户可以继续对话：
  "把研究员改成更激进的风格"
  "再加一个质检节点"
  "整个流程太复杂了，简化一下"
Agent 理解修改意图，更新 flow，重新渲染画布
```

### 光球 UI 重做（CSS blur 方案）

不使用 Three.js，改用 CSS blur + mix-blend-mode: screen，
效果更接近 Siri，实现更简单，性能更好。

**核心原理：**
```
五个彩色 div（blob）叠加在一个容器里
容器整体 filter: blur(32px) + mix-blend-mode: screen
blob 各自有不同速度和轨迹的 CSS animation
颜色通过融合产生丰富的流动效果
```

**五个 blob 颜色：**
```
青色   #20d5fb（100px）
品红   #ff2a7a（100px）
紫色   #8b3cff（110px）
深蓝   #0055ff（90px）
绿色   #00ffb3（75px）
```

**三种状态（通过 CSS class 切换）：**
```
state-idle（等待）：
  整体缩放 0.68，缓慢流动
  blob 动画时长 4.5s - 7s
  运动范围 translate ±25%

state-thinking（思考中）：
  整体缩放 0.88，快速翻腾
  blob 动画时长 1.2s - 2.0s
  运动范围 translate ±30%

state-generating（生成中）：
  整体缩放 1.0，极速 + 呼吸震动
  blob 动画时长 0.65s - 1.1s
  加 scale 1.0 → 1.1 呼吸动画，0.55s 循环
  运动范围 translate ±28%（不要太大）
```

**状态和 API 调用同步：**
```
调用开始      → state-thinking
LLM 开始返回  → state-generating
渲染完成      → 光球淡出消失（opacity 0，transition 0.5s）
```

### Settings 配置

Settings 页面新增 AI 生成 Flow 配置区域：
```
AI 生成 Flow
─────────────────────────
生成模型：
  Provider [deepseek ▼]  Model [deepseek-chat ▼]
  （默认 deepseek-chat，省费用）

启用工具：
  ☑ web_search（调研最佳实践）
  ☑ url_fetch（读取参考页面）
```
