# FlowCraft 项目需求文档
> 给 Claude Code 的完整项目规格说明

---

## 项目简介

**FlowCraft** 是一个可视化 AI agent 编排工具。
目标用户是普通人，核心价值是让 AI 使用有确定性、透明、像 Scratch 一样简单。
用户通过拖拽节点、连线，搭建 AI 工作流，让多个 agent 协作完成复杂任务。

---

## 技术栈

```
框架：     Next.js 14 App Router + TypeScript
状态管理：  Zustand
画布引擎：  React Flow (@xyflow/react)
样式：     Tailwind CSS + @tailwindcss/typography
国际化：   next-intl（中英文切换）
字体：     DM Sans（正文）+ DM Mono（代码/日志）
图标：     lucide-react
Markdown： react-markdown
```

---

## 代码规范（必须遵守）

```
单一职责原则（判断是否需要拆分的唯一标准）：
  能不能用一句话说清这个文件做什么？
  如果需要用"和"连接两个不相关的职责 → 拆分
  跟行数无关

各类文件的参考标准：
  UI 展示组件（Button/Card/ListItem 等）
    参考上界 150 行
    超过大概率混入了业务逻辑，值得检查

  页面/容器组件（page.tsx/flow-editor.tsx）
    200-300 行完全正常，硬压没有意义

  Hook 文件（useXxx.ts）
    以职责单一为标准，不限行数
    警惕"状态 + 副作用 + 格式化"混杂在一起

  核心逻辑文件（执行引擎/存储管理）
    以职责为标准，不限行数
    职责单一可以保留，300+ 行没问题

  纯数据文件（i18n/类型定义/常量）
    不限行数

触发人工评估的信号（不是自动报错）：
  超过 300 行 → 检查职责是否单一
  职责无法用一句话说清
  需要用"和"连接两个不相关职责
  → 内聚性高的标注"无需拆分"即可，不强制拆

其他规范：
  所有颜色/间距/字体从 src/styles/tokens.ts 取，不硬编码
  通用组件放 src/components/ui/，不包含业务逻辑
  自定义 hooks 放 src/hooks/
  中英文文字全部走 i18n，不硬编码字符串
  用 useFlowStore.getState() 获取执行中的最新状态，避免 closure 陷阱
```

> 第二阶段已完成，本文档作为基础架构参考继续有效
> 第三阶段新增需求见 flowcraft-stage3-requirements.md

---

## 项目目录结构

```
src/
├── app/
│   ├── globals.css                    # 全局样式
│   ├── layout.tsx                     # 根布局（字体）
│   ├── page.tsx                       # 首页（flow 列表）
│   ├── canvas/[flowId]/page.tsx       # Canvas 编辑页
│   ├── playground/page.tsx            # Playground 页（已完成）
│   ├── settings/page.tsx              # 全局设置页
│   └── api/                           # 已有的 API routes（不要修改）
│
├── components/
│   ├── ui/                            # 通用组件
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── panel.tsx
│   │   ├── tabs.tsx
│   │   └── copy-toast.tsx
│   │
│   ├── canvas/
│   │   ├── flow-editor.tsx            # React Flow 画布容器
│   │   ├── custom-edge.tsx            # 自定义连线
│   │   └── nodes/
│   │       ├── base-node.tsx          # 节点基类
│   │       ├── agent-node.tsx         # Agent 节点
│   │       ├── input-node.tsx         # 输入节点
│   │       ├── output-node.tsx        # 输出节点
│   │       ├── generic-node.tsx       # 通用节点
│   │       ├── output-modal.tsx       # 输出全屏 Modal
│   │       └── index.tsx              # 节点类型注册
│   │
│   ├── layout/
│   │   ├── top-toolbar.tsx
│   │   ├── left-panel.tsx
│   │   ├── right-panel.tsx
│   │   ├── agent-config-panel.tsx     # Agent 节点配置（从 right-panel 拆出）
│   │   └── bottom-panel.tsx
│   │
│   └── home/
│       ├── flow-card.tsx              # Flow 列表卡片
│       └── new-flow-button.tsx        # 新建 Flow 按钮
│
├── hooks/
│   ├── useFlowExecution.ts            # Flow 执行引擎 hook
│   └── useFlowPersistence.ts          # Flow 持久化 hook
│
├── lib/
│   ├── flow-executor.ts               # 拓扑排序、执行逻辑
│   ├── flow-storage.ts                # Flow 读写文件系统
│   └── workspace-manager.ts          # Workspace 文件管理
│   └── （已有的 models/tools/skills/agent-runner 不要修改）
│
├── store/
│   ├── flowStore.ts                   # Canvas 状态（已有）
│   └── agent-store.ts                 # Playground 状态（不要修改）
│
├── styles/
│   └── tokens.ts                      # 设计 Token
│
├── types/
│   ├── flow.ts                        # Flow 相关类型
│   └── node.ts                        # 节点类型
│
└── messages/
    ├── zh.json                        # 中文
    └── en.json                        # 英文
```

---

## 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | Flow 列表，新建/删除/重命名 |
| `/canvas/[flowId]` | Canvas 编辑 | 主要工作区 |
| `/playground` | Playground | 已完成，不要修改 |
| `/settings` | 设置 | API key、默认模型 |

---

## Canvas 页面布局

```
┌──────────────────────────────────────────────────┐
│  顶部工具栏（52px）                                │
│  FlowCraft | flow名称 | 运行状态 | 保存/导出/运行  │
├────────┬─────────────────────────┬────────────────┤
│        │                         │                │
│  左侧  │     中间 Canvas 画布     │   右侧面板      │
│  面板  │     React Flow           │   tab 1: 节点配置│
│ 220px  │     网格背景             │   tab 2: 文件浏览│
│        │     可拖拽/缩放/连线      │   tab 3: 运行历史│
│  节点库 │                         │   280px        │
│  +     │                         │                │
│  已保存 │                         │                │
├────────┴─────────────────────────┴────────────────┤
│  底部面板（可收起，默认展开 160px）                  │
│  tab 1: 执行日志  |  tab 2: 终端输出               │
└──────────────────────────────────────────────────┘
```

---

## 节点类型规格

### 节点设计哲学（重要）

FlowCraft 的节点类型不是"功能分类"，而是**用户对 flow 的控制声明**。

```
核心问题：既然 Agent 节点配置了 tools 和 skills 就能做大多数事，
          为什么还需要其他节点类型？

答案：其他节点类型存在是为了"约束"，不是"增强"。
      它们让用户把控制权从 AI 手中拿回来。

Agent 节点：让 AI 自主决策（给 AI 最大自由度）
Tool 节点： 约束执行方式（确定性操作，不需要 AI 判断）
Skill 节点：约束知识来源（动态注入特定领域知识）
Condition： 约束流程走向（你来决定走哪条路，不让 AI 决定）
Human 节点：约束执行权限（某些决定必须人来做）
Merge 节点：约束同步点（必须等所有上游完成才继续）
```

**Tool 节点 vs Agent 节点里的 tool：**
```
Agent 用 tool（内置）：
  agent 自己判断要不要调用、什么时候调用、调什么参数
  不确定性高，结果因 agent 的判断而异
  适合：需要 AI 自主判断的场景

Tool 节点（独立）：
  flow 设计者强制执行一次，参数固定
  每次执行结果一致，不受 AI 判断影响
  适合：确定性操作（抓取固定 URL、执行固定脚本、调用固定 API）
```

**Skill 节点 vs Agent 节点里的 skill：**
```
Agent 预配置 skill：
  skill 在整个执行过程中始终注入
  适合：已知这个 agent 需要这个领域知识

Skill 节点（独立）：
  在 flow 执行中动态决定注入哪个 skill
  基于上游节点的输出结果来选择
  适合：不确定会遇到什么类型的问题，需要动态匹配知识
  注意：Skill 节点没有自己的输出，它的作用是"增强"下一个 Agent
```

---

### 颜色体系

| 节点类型 | 颜色 | Hex | 定位 |
|---------|------|-----|------|
| Agent | 蓝紫 | `#6366f1` | 核心节点，AI 自主决策 |
| Tool | 绿色 | `#10b981` | 确定性执行，无需 AI 判断 |
| Skill | 琥珀 | `#f59e0b` | 动态知识注入，增强下游 Agent |
| Human | 玫瑰 | `#f43f5e` | 人工介入，流程控制权归人 |
| Input | 天蓝 | `#0ea5e9` | 流程起点 |
| Output | 石板 | `#64748b` | 流程终点 |
| Condition | 橙色 | `#ea580c` | 分支控制，用户定义走向 |
| Merge | 深蓝 | `#1d4ed8` | 同步点，等所有上游完成 |
| Initializer | 紫罗兰 | `#8b5cf6` | 环境初始化，长期任务起点 |

**左侧面板展示优先级：**
```
主要节点（默认展开，突出显示）：
  Agent / Human / Input / Output / Condition / Merge / Initializer

次要节点（折叠分组，标注"进阶"）：
  Tool / Skill
  说明文字："当你需要确定性操作或动态知识注入时使用"
```

### 节点内部结构

```
┌─────────────────────────────────┐
│ [图标] 节点名称        [状态徽章] │  ← Header（带颜色背景）
├─────────────────────────────────┤
│ [tool标签] [skill标签]           │  ← Tags（配置时显示）
│                                 │
│ 运行时显示：                     │
│  流式文字区域（可滚动，max-h-24） │  ← 思考中
│  Markdown 输出（可滚动，max-h-32）│  ← 完成后
│  [查看全部] 按钮                 │
│                                 │
│ ● ● ● 正在思考...               │  ← 运行时动效
│ ██████░░░░ 进度条               │
└─────────────────────────────────┘
  ○                            ○
 左侧 target handle        右侧 source handle
```

### 节点状态与视觉表现

| 状态 | 视觉效果 |
|------|---------|
| idle | 默认白色卡片，无边框高亮 |
| waiting | opacity-60，灰暗 |
| running | 蓝紫色呼吸光效（breath-glow 动画），节点内显示流式输出 |
| success | 绿色 ✓ 徽章，显示 Markdown 输出摘要 |
| error | 红色边框，红色 ✗ 徽章，显示错误信息 |

连线运行时：小圆点沿路径流动，表示数据传递中。

---

## Input 节点规格

- 有文字输入框（textarea，用户直接在节点上输入目标）
- 有文件上传按钮，支持：
  - 图片：jpg/png/webp/gif → 转 base64，显示缩略图
  - 文本文件：txt/md/csv/json/ts/tsx/js/py 等 → 读取内容
  - 不支持格式给出提示
- 已上传文件以列表显示，可逐个删除
- 只有右侧 source handle，没有左侧 handle
- 数据存在节点 data 里：
  ```typescript
  data.inputText: string
  data.inputFiles: Array<{
    name: string
    type: 'image' | 'text'
    content?: string      // 文本文件内容
    base64?: string       // 图片 base64
    mimeType?: string
    preview?: string      // 图片预览 DataURL
  }>
  ```

---

## Output 节点规格

- 只有左侧 target handle，没有右侧 handle
- 无输出时：显示"等待上游节点输出..."
- 有输出时：
  - 显示结果摘要（前150字）
  - 复制按钮（Copy icon）
  - 展开按钮（Maximize2 icon）
  - 双击节点：弹出 OutputModal
- 作为 flow 的对外接口（封装和 API 发布时使用）

---

## Agent 节点配置项（右侧面板）

选中 Agent 节点后右侧面板显示：

```
节点名称（可编辑 input）
─────────────────────
System Prompt（textarea）
─────────────────────
Provider（select）：anthropic / openai / deepseek / google
Model（select）：根据 provider 动态加载，不支持多模态的模型标注说明
─────────────────────
Tools（checkbox 列表，从已安装工具动态读取）：
  □ web_search
  □ calculator
  □ url_fetch
  □ code_execute
  □ python_execute
  □ brave_search
  □ image_generate    ← 阶段间任务新增
─────────────────────
Skills（checkbox 列表，从 skillRegistry 动态读取）
  如果没有安装 skill，显示提示 + 跳转链接
─────────────────────
Max Iterations（number input，默认 10）
─────────────────────
执行模式（select）：
  一次性（One-Shot）
  增量（Incremental）
─────────────────────
完成条件（可添加/删除列表）：
  [+ 添加验收标准]
  每条：[输入框] [✕删除]
─────────────────────
输出字段定义（可添加/删除）：
  [+ 定义输出字段]
  每行：[字段名] [类型 select] [✕]
  类型：string / number / boolean / object / array
```

### 支持的 Provider 和 Model

```
anthropic：
  claude-opus-4-5        支持多模态 ✓
  claude-sonnet-4-5      支持多模态 ✓
  claude-haiku-4-5       支持多模态 ✓

openai：
  gpt-4o                 支持多模态 ✓
  gpt-4o-mini            支持多模态 ✓
  o1                     支持多模态 ✓
  o3-mini                不支持多模态（纯文本）

deepseek：
  deepseek-chat          不支持多模态（纯文本）
  deepseek-reasoner      不支持多模态（纯文本）

google：
  gemini-2.5-pro         支持多模态 ✓
  gemini-2.5-flash       支持多模态 ✓
  gemini-2.0-flash       支持多模态 ✓
```

下拉选项中，不支持多模态的模型在名称后标注：
`deepseek-chat（不支持图片输入）`

用户上传了图片文件时，如果选择了不支持多模态的模型，
在配置面板顶部显示警告：
```
[AlertTriangle] 当前模型不支持图片输入
上传的图片将被忽略，建议切换到 Claude 或 Gemini
```

### Google API 接入

新增 `src/lib/models/google.ts`，使用 `@google/generative-ai` SDK：

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

// 支持流式输出
// 支持图片（base64 或 URL）
// 支持 function calling（tools）
// API key 从 GOOGLE_API_KEY 环境变量读取
```

Settings 页面新增：
```
Google API Key  [未设置]  [添加]
支持：Gemini 系列模型 + Nano Banana 图片生成 + Imagen 3
```

---

## Flow 执行引擎规格

### 执行流程

```
用户点击 Run Flow
  → 弹出对话框（如果 Input 节点没有文字）
  → 找到 Input 节点，读取 inputText + inputFiles
  → 检测 flow 是否包含循环（有向有环图）
  → 按顺序执行（支持并行：上游全部完成才执行下游）
  → 每个节点完成后输出传给下游
  → 所有节点完成 → 标记 done
```

### 循环支持

FlowCraft 支持循环 flow（有向有环图）。
循环必须配合 Condition 节点使用，由 Condition 决定继续还是退出。

```
典型循环结构：

  工程师（写代码）
      ↓
  质检员（审核）
      ↓
  Condition（合格了吗？）
      ↙ false          ↘ true
  回到工程师           继续下游
  （修改代码）

执行逻辑：
  检测到环 → 不报错，追踪每个节点的执行次数
  Condition 判断 true  → 退出循环，继续下游
  Condition 判断 false → 继续循环
  循环次数超过上限     → 强制退出，节点标记 warning
  提示用户："循环次数已达上限（X次），已强制退出"
```

循环次数上限：
```
全局默认上限：10 次
用户可在 Condition 节点配置里修改上限
超出上限时不报错，而是 warning 状态
保留已有的输出，不丢弃
```

执行引擎改造要点：
```
不能用拓扑排序（topo sort 不支持有环图）
改为：
  用节点执行次数 Map 追踪每个节点跑了几次
  用队列驱动执行，而不是预先排好顺序
  Condition 节点决定下一个入队的节点
  检测某节点执行次数 > 上限 → 强制标记 warning 退出
```

### 节点执行逻辑

```typescript
// Agent 节点      → 调用 /api/agent/run（SSE 流式）
// Tool 节点       → 直接调用对应工具
// Human 节点      → 暂停，显示等待用户输入 UI
// Condition 节点  → 自然语言模式：LLM 判断
//                   表达式模式：eval
//                   true  → 激活 true 出线，下游入队
//                   false → 激活 false 出线，下游入队
//                   支持循环：false 出线可以连回上游
// Merge 节点      → 等所有上游完成，合并后传给 LLM 整合
// Input 节点      → 读取 data.inputText + inputFiles
// Output 节点     → 接收上游输出，存入 data.currentOutput
// Initializer 节点→ 建立 workspace，写 features.json 和 progress.md
// AI Coding Agent → 调用本地 claude/codex CLI（子进程 + SSE）
// Packed 节点     → 执行内部 sub-flow，注入整体记忆
```

### Condition 节点规格

两种判断模式，右上角切换：

```
自然语言模式（默认）：
  用户填写条件描述
  例如："如果代码通过了所有测试"
  运行时调用 LLM 判断 true/false

表达式模式：
  用户填写 JS 表达式
  例如：output.score >= 8
  运行时直接 eval，确定性更高
```

两个出线 handle：
```
右上：true 出线（绿色 handle）
右下：false 出线（红色 handle）
```

配置项：
```
判断模式（自然语言 / 表达式）
条件内容（textarea）
最大循环次数（number，默认 10，仅当 false 出线连回上游时有效）
```

运行时视觉：
```
判断中：节点内显示旋转图标 + "判断中..."
判断完成：
  true  → 绿色出线亮起，粒子沿此路径流动
           红色出线变灰虚线
  false → 红色出线亮起，粒子沿此路径流动
           绿色出线变灰虚线
循环警告：节点变为 warning 状态（黄色边框）
          显示"已循环 X 次，达到上限"
```

### 图片/文件传递给模型

```typescript
// Anthropic 格式
messages = [{
  role: 'user',
  content: [
    { type: 'text', text: goal },
    { type: 'image', source: {
        type: 'base64',
        media_type: img.mimeType,
        data: img.base64
    }}
  ]
}]

// OpenAI 格式
messages = [{
  role: 'user',
  content: [
    { type: 'text', text: goal },
    { type: 'image_url', image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`
    }}
  ]
}]
```

---

## Workspace 文件系统规格

基于 Anthropic 长时 agent 研究设计：

```
workspace/
└── {flowId}/
    ├── progress.md          # 每次运行后更新，记录做了什么
    ├── features.json        # 任务清单，每项有 pass/fail
    ├── init.sh              # 环境初始化脚本
    ├── memory/
    │   ├── shared.md        # 公共记忆（flow 级别）
    │   └── {nodeId}.md      # 节点运行记忆（flow 级别，见下方说明）
    └── runs/
        └── {runId}/         # 每次运行独立目录（git repo）
            └── outputs/
```

### 两套记忆系统（重要）

FlowCraft 有两套独立的记忆系统，服务于不同场景：

```
系统一：节点运行记忆（Flow 级别）
  路径：workspace/{flowId}/memory/{nodeId}.md
  内容：这个节点在这个 flow 里的运行经历
        和这个 flow 的项目背景相关的记忆
  作用域：只在这个 flow 里有意义
  适用：普通 Agent 节点（没有 individualName）

系统二：个人 Agent 全局记忆（跨 Flow）
  路径：agents/individuals/{name}/memory.md
  内容：这个 Agent 跨所有 flow 积累的经验
        不依附于任何特定 flow
  作用域：全局，所有 flow 共享
  适用：保存为个人 Agent 的节点（有 individualName）

老王在 Flow A 跑了 3 次，在 Flow B 跑了 2 次
  → 老王的记忆文件是同一份
  → agents/individuals/老王/memory.md
  → 5 次运行的经验全部在这里
  → 换了 flow，经验还在
```

### 人格注入时的记忆读取逻辑

```typescript
// 执行 Agent 节点时，根据是否是个人 Agent 引用来决定读哪份记忆
const privateMemory = node.data.individualName
  ? await readMemory(`agents/individuals/${node.data.individualName}/memory.md`)
  : await readMemory(`workspace/${flowId}/memory/${node.id}.md`)
```

### 并发写入处理

同一个个人 Agent 同时在多个 flow 里运行时，
使用 `fs.appendFile` 原子追加，不做 read → concat → write：

```typescript
// 正确做法：原子追加
await fs.appendFile(memoryPath, `\n## ${timestamp} [${status}]\n${content}\n`)

// 错误做法（有并发覆盖风险，不要用）：
// const existing = await fs.readFile(memoryPath)
// await fs.writeFile(memoryPath, existing + newContent)
```

每条记忆有独立时间戳，并发写入最多导致顺序稍乱，不会丢数据。

### progress.md 格式
```markdown
# 进度记录
## 最近完成
- [时间戳] 节点名：做了什么
## 当前状态
- 节点A：已完成 ✓
- 节点B：进行中 2/5
## 下一步
- 继续节点B的剩余子任务
```

### features.json 格式
```json
{
  "nodeId": "agent-001",
  "features": [
    {
      "id": "f1",
      "description": "完成竞品调研",
      "passes": false
    }
  ]
}
```

### Session 启动序列（每个 Agent 节点开始时自动执行）
1. 读 progress.md
2. 读 features.json
3. 读私人记忆（memory/{nodeId}.md）
4. 读公共记忆（memory/shared.md）
5. 运行 init.sh
6. 选当前最优先的未完成子任务
7. 开始执行

---

## Flow 持久化规格

```
flows/
├── index.json              # flow 列表 [{id, name, createdAt, updatedAt}]
└── {flowId}/
    ├── flow.json           # 节点和连线定义
    └── flow.yaml           # 导出的 YAML（可选）
```

### flow.json 格式
```json
{
  "id": "default-flow",
  "name": "我的第一个 Flow",
  "nodes": [...],   // React Flow nodes 数组
  "edges": [...],   // React Flow edges 数组
  "createdAt": "2024-01-15T00:00:00Z",
  "updatedAt": "2024-01-15T00:00:00Z"
}
```

API routes：
- `GET /api/flows` → 列出所有 flow
- `POST /api/flows` → 新建 flow
- `GET /api/flows/[id]` → 读取 flow
- `PUT /api/flows/[id]` → 保存 flow
- `DELETE /api/flows/[id]` → 删除 flow

---

## 首页规格

Flow 列表页，展示所有已创建的 flow：

```
┌─────────────────────────────────────────────┐
│  FlowCraft                    [+ 新建 Flow]  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ 产品研发流程  │  │ 每日报告生成  │        │
│  │              │  │              │        │
│  │ 5个节点      │  │ 3个节点      │        │
│  │ 上次运行：今天│  │ 上次运行：昨天│        │
│  │ [编辑] [删除] │  │ [编辑] [删除] │        │
│  └──────────────┘  └──────────────┘        │
│                                             │
│  ┌──────────────┐                          │
│  │ + 新建 Flow  │                          │
│  └──────────────┘                          │
└─────────────────────────────────────────────┘
```

Flow 卡片信息：名称、节点数量、最后修改时间、最后运行时间。

---

## OutputModal 规格

双击任意节点（有输出时）弹出：

```
┌──────────────────────────────────────────┐
│ 节点名称          [Output] [复制] [✕关闭] │
├──────────────────────────────────────────┤
│                                          │
│  完整 Markdown 渲染内容                   │
│  （可滚动，max-h 80vh）                   │
│                                          │
└──────────────────────────────────────────┘
```

- 点击空白处关闭
- 复制按钮点击后变成 ✓ 已复制，1.5秒后恢复
- 支持所有 Markdown 语法（标题、列表、代码块、表格）

---

## CopyToast 规格

复制任何内容后，底部出现提示：

```
        ✓ 已复制到剪贴板
```

- 固定在页面底部居中
- 淡入动画
- 1.5秒后自动消失
- z-index: 200（在所有内容之上）

---

## 节点封装规格

选中多个节点后封装成新 Agent：

**触发方式：**
1. Shift + 拖拽框选多个节点
2. Ctrl/Cmd + 点击多选
3. 多选后出现浮动工具栏，点击"封装成 Agent"

**封装逻辑：**
1. 选中的节点组合成一个新的 agent
2. 弹出命名对话框
3. 保存到 `agents/` 目录（agent.md 格式）
4. 在画布上替换为一个新的 Agent 节点
5. 该 agent 可在其他 flow 里拖入复用

---

## 条件节点规格

两种模式（右上角切换）：

**自然语言模式（默认）：**
- 输入框填写条件描述
- 例如："如果报告超过500字"
- 运行时由 LLM 判断 true/false

**表达式模式：**
- 代码编辑框
- 例如：`output.word_count > 500`
- 运行时直接 eval，确定性更高

两个输出 handle：true（绿色）和 false（红色）

---

## 运行历史规格

右侧面板 History tab：

```
┌─────────────────────────────────┐
│ 运行历史                         │
├─────────────────────────────────┤
│ ● 今天 14:23  成功  2分30秒      │
│   [查看详情]                     │
├─────────────────────────────────┤
│ ✗ 今天 11:05  失败  工程师节点   │
│   [查看详情]                     │
├─────────────────────────────────┤
│ ● 昨天 09:15  成功  1分45秒      │
│   [查看详情]                     │
└─────────────────────────────────┘
```

点击"查看详情"展开显示该次运行的完整日志。

---

## YAML 导出规格

Flow 可导出为 YAML 格式（单向，不做双向同步）：

```yaml
name: 产品研发流程
version: 1.0
nodes:
  - id: input-001
    type: input
    label: 输入
  - id: agent-001
    type: agent
    label: 产品经理
    config:
      systemPrompt: 你是一个经验丰富的产品经理...
      model:
        provider: anthropic
        model: claude-sonnet-4-6
      tools: [web_search]
      maxIterations: 10
edges:
  - source: input-001
    target: agent-001
```

---

## API 发布规格

Flow 可发布为 REST API：

```
POST /api/flows/{flowId}/run
Authorization: Bearer {apiKey}

Body: { "input": "用户的目标" }

Response: { "runId": "run-abc123" }

GET /api/flows/runs/{runId}
Response: {
  "status": "running" | "done" | "error",
  "output": "最终结果",
  "logs": [...]
}
```

---

## Settings 页面规格

```
API Keys
─────────────────────────
Anthropic API Key   [输入框] [保存]
OpenAI API Key      [输入框] [保存]
DeepSeek API Key    [输入框] [保存]
Tavily API Key      [输入框] [保存]
Brave API Key       [输入框] [保存]

默认模型
─────────────────────────
Provider  [select]
Model     [select]

工作区路径
─────────────────────────
Workspace 目录  [输入框]  默认：./workspace

语言
─────────────────────────
[中文] [English]
```

---

## 国际化规格

所有显示给用户的文字通过 next-intl 管理：

```json
// messages/zh.json
{
  "canvas": {
    "runFlow": "运行",
    "stopFlow": "停止",
    "save": "保存",
    "export": "导出",
    "publishApi": "发布 API",
    "nodeLibrary": "节点库",
    "savedAgents": "已保存 Agent",
    "configuration": "配置",
    "files": "文件",
    "history": "历史",
    "executionLog": "执行日志",
    "terminal": "终端"
  },
  "nodes": {
    "agent": "Agent",
    "tool": "工具",
    "skill": "技能",
    "human": "人工",
    "input": "输入",
    "output": "输出",
    "condition": "条件",
    "merge": "合并",
    "initializer": "初始化"
  }
}
```

---

## 当前完成状态

### 已完成 ✓
- Playground 页面（agent 引擎、tools、skills、subagents）
- Canvas UI 框架（节点、连线、面板、日志）
- Flow 执行引擎（调用真实 agent API）
- 节点配置面板（system prompt、model、tools、skills）
- 运行时动效（呼吸光效、流式输出）
- Input 节点（文字输入 + 文件上传）
- OutputModal（Markdown 渲染 + 复制）
- CopyToast

### 待完成（按优先级）
1. Flow 持久化（保存到 flows/ 目录）
2. 首页（flow 列表管理）
3. Settings 页面
4. Output 节点完善
5. 节点封装功能
6. 条件节点完整实现
7. Workspace 文件系统
8. 运行历史
9. YAML 导出
10. API 发布
11. 中英文切换（next-intl）
12. 撤销/重做（Ctrl+Z）

---

## 重要设计原则

1. **确定性优先**：用户能看懂在构建什么，能在关键节点干预
2. **开放标准兼容**：Tool → MCP，Skill → SKILL.md，Agent → Agent.md
3. **增量执行**：复杂任务一次做一个子任务，有 progress.md 追踪进度
4. **感官反馈**：AI 工作时用户需要感受到它在工作（动效、日志、光效）
5. **模块化代码**：每个文件只做一件事，UI/逻辑/状态严格分层
