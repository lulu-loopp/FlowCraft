# FlowCraft 第二阶段补充需求
> 在 flowcraft-requirements.md 基础上的新增内容
> 阅读本文档前请先阅读 flowcraft-requirements.md

---

## 图标规范

本文档所有图标均使用 lucide-react SVG 图标库，不使用 emoji。
常用图标对应关系：

```
研究员         → <Search />
工程师         → <Code2 />
写作助手       → <PenLine />
分析师         → <BarChart2 />
质检员         → <ClipboardCheck />
总结助手       → <FileText />
个人 Agent    → <Bot />
Agent 组合    → <Package />
聊天           → <MessageCircle />
编辑           → <Settings2 />
拖入           → <GripVertical />
帮助           → <HelpCircle />
保存           → <BookmarkPlus />
封装           → <Package />
记忆           → <Brain />
成熟度         → <TrendingUp />
查看内部       → <Eye />
引用标识       → <Layers />
Claude Code   → 官方 SVG Logo（#D97757）
Codex         → 官方 SVG Logo（#000000）
```

---

## 一、预设节点

### 概念

左侧面板除了基础节点类型，还提供预设变体——带有精心设计的默认 system prompt 的节点，用户拖进来稍作修改就能用。

### 存放位置

```
src/lib/presets/
├── nodes.ts      # 预设节点定义
├── flows.ts      # 示例 flow 定义
└── help.ts       # 帮助文字和动画配置
```

### 预设节点列表

```typescript
// src/lib/presets/nodes.ts
import {
  Search, Code2, PenLine, BarChart2,
  ClipboardCheck, FileText
} from 'lucide-react'

export const PRESET_NODES = [
  {
    id: 'preset-researcher',
    type: 'agent',
    label: '研究员',
    icon: Search,
    description: '擅长搜索和整理信息',
    data: {
      systemPrompt: `你是一个专业的研究员。
工作方式：
1. 收到任务后先制定研究计划
2. 使用 web_search 从多个角度搜索信息，不依赖单一来源
3. 区分事实和观点，标注信息来源
4. 输出结构化报告：摘要 → 关键发现 → 详细分析 → 参考来源
每次搜索后评估信息质量，必要时深入搜索。`,
      enabledTools: ['web_search'],
      maxIterations: 10,
    }
  },
  {
    id: 'preset-engineer',
    type: 'agent',
    label: '工程师',
    icon: Code2,
    description: '擅长写代码和解决技术问题',
    data: {
      systemPrompt: `你是一个专业的软件工程师。
工作方式：
1. 理解需求后先制定技术方案
2. 一次只实现一个功能，保持代码简洁
3. 写完代码后用 code_execute 验证能运行
4. 输出完整可运行的代码，附上使用说明
遇到错误时分析原因，修复后重新验证。`,
      enabledTools: ['code_execute', 'python_execute'],
      maxIterations: 15,
      provider: 'deepseek',
      model: 'deepseek-chat',
    }
  },
  {
    id: 'preset-writer',
    type: 'agent',
    label: '写作助手',
    icon: PenLine,
    description: '擅长内容创作和文字润色',
    data: {
      systemPrompt: `你是一个专业的内容创作者。
工作方式：
1. 理解目标读者和写作目的
2. 先列出文章结构和要点
3. 用清晰、有吸引力的语言写作
4. 输出格式良好的 Markdown 文章
写作时注重：逻辑清晰、例子具体、语言流畅。`,
      enabledTools: [],
      maxIterations: 8,
    }
  },
  {
    id: 'preset-analyst',
    type: 'agent',
    label: '分析师',
    icon: BarChart2,
    description: '擅长数据分析和洞察提取',
    data: {
      systemPrompt: `你是一个专业的数据分析师。
工作方式：
1. 理解分析目标和数据来源
2. 从多个维度分析数据
3. 识别关键趋势、异常和机会
4. 输出清晰的分析报告，包含结论和建议
分析时保持客观，区分相关性和因果性。`,
      enabledTools: ['python_execute', 'calculator'],
      maxIterations: 10,
    }
  },
  {
    id: 'preset-reviewer',
    type: 'agent',
    label: '质检员',
    icon: ClipboardCheck,
    description: '擅长审核和验证输出质量',
    data: {
      systemPrompt: `你是一个严格的质量审核员。
工作方式：
1. 仔细阅读需要审核的内容
2. 对照原始需求逐条检查
3. 找出问题、遗漏和改进空间
4. 输出详细的审核报告：通过的部分、问题清单、改进建议
保持客观，既要指出问题，也要认可做得好的地方。`,
      enabledTools: [],
      maxIterations: 5,
    }
  },
  {
    id: 'preset-summarizer',
    type: 'agent',
    label: '总结助手',
    icon: FileText,
    description: '擅长压缩和提炼关键信息',
    data: {
      systemPrompt: `你是一个专业的信息提炼专家。
工作方式：
1. 快速理解输入内容的核心
2. 识别最重要的 3-5 个关键点
3. 用简洁清晰的语言重新表达
4. 输出：一句话总结 → 关键要点列表 → 行动建议
提炼时保留最有价值的信息，删去冗余内容。`,
      enabledTools: [],
      maxIterations: 5,
    }
  },
]
```

### 左侧面板 UI 更新

```
节点库
─────────────────────────────
基础节点（可拖拽）
  Agent  Tool  Skill  Human
  Input  Output  Condition  Merge  Initializer

预设节点（可拖拽，带默认配置）
  [Search]          研究员
  [Code2]           工程师
  [PenLine]         写作助手
  [BarChart2]       分析师
  [ClipboardCheck]  质检员
  [FileText]        总结助手

已保存 Agent（见第八节）
```

---

## 二、示例 Flow

### 示例 Flow 列表

**示例一：市场调研报告**
```
图标：<BarChart2 /> 蓝色
展示：顺序执行、研究员 + 写作助手组合

节点：
  Input → 研究员 → 分析师 → 写作助手 → Output
```

**示例二：代码审查流程**
```
图标：<Code2 /> 绿色
展示：顺序执行 + Human 节点介入

节点：
  Input → 工程师 → 质检员 → Human → Output
```

**示例三：并行研究**
```
图标：<GitBranch /> 橙色
展示：并行执行 + Merge 节点

节点：
  Input → 研究员A ↘
        → 研究员B ↗ 总结助手 → Output
```

### 首页 UI

```
从示例开始
─────────────────────────────────────────────
┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐
│ [BarChart2]      │ │ [Code2]          │ │ [GitBranch]  │
│ 市场调研报告     │ │ 代码审查流程     │ │ 并行研究     │
│ 4个节点          │ │ 4个节点          │ │ 5个节点      │
│ [载入]           │ │ [载入]           │ │ [载入]       │
└──────────────────┘ └──────────────────┘ └──────────────┘
```

载入逻辑：
- 画布为空 → 直接载入
- 画布有内容 → 弹窗确认"会覆盖当前内容，确认继续？"

---

## 三、节点帮助系统

### 概念

每个节点右上角有一个 HelpCircle 图标按钮，点击弹出帮助面板。

### 按钮位置

```tsx
import { HelpCircle } from 'lucide-react'

<button
  onClick={e => { e.stopPropagation(); setShowHelp(true) }}
  className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200
             text-slate-400 hover:text-slate-600 transition-colors
             flex items-center justify-center flex-shrink-0"
>
  <HelpCircle className="w-3 h-3" />
</button>
```

### 帮助弹窗结构

```
┌──────────────────────────────────────────────┐
│ [Search] 研究员 Agent                   [X]  │
├──────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐    │
│  │  CSS 动画演示                         │    │
│  │  [Input] → [研究员] → [Output]       │    │
│  │  呼吸光效 · Think → Act → Observe    │    │
│  └──────────────────────────────────────┘    │
│                                              │
│ 这个节点做什么？                              │
│ 研究员擅长搜集和整理信息...                   │
│                                              │
│ 适合用在哪里？                               │
│ · 市场调研和竞品分析                         │
│ · 背景知识收集                               │
│ · 数据收集整理                               │
│                                              │
│ 推荐搭配                                     │
│ [BarChart2] 分析师  [PenLine] 写作助手       │
│                                              │
│ [载入示例 Flow]                              │
└──────────────────────────────────────────────┘
```

### 动画演示规格

纯 CSS 动画，三阶段循环：

```
阶段一（1.5s）：idle - 普通白色卡片
阶段二（3s）：running - 呼吸光效，依次出现 Think/Act/Observe，连线粒子流动
阶段三（1.5s）：success - 绿色对勾，输出摘要出现，粒子流向下游
循环播放
```

### 帮助内容数据结构

```typescript
// src/lib/presets/help.ts
interface HelpContent {
  title: string
  icon: LucideIcon
  description: string
  useCases: string[]
  recommendedPairs: string[]
  demoFlowId: string | null
}

export const HELP_CONTENT: Record<string, HelpContent> = {
  agent:             { icon: Bot,           ... },
  tool:              { icon: Wrench,        ... },
  skill:             { icon: Lightbulb,     ... },
  human:             { icon: User,          ... },
  condition:         { icon: GitBranch,     ... },
  initializer:       { icon: Bot,           ... },
  'preset-researcher': { icon: Search,      ... },
  'preset-engineer':   { icon: Code2,       ... },
  'preset-writer':     { icon: PenLine,     ... },
  'preset-analyst':    { icon: BarChart2,   ... },
  'preset-reviewer':   { icon: ClipboardCheck, ... },
  'preset-summarizer': { icon: FileText,    ... },
}
```

### 新增文件

```
src/
├── lib/presets/help.ts
└── components/canvas/nodes/
    ├── node-demo-animation.tsx   # 帮助弹窗动画
    └── node-help-modal.tsx       # 帮助弹窗
```

---

## 四、AI Coding Agent 节点

### 概念

通过子进程调用本地的 `claude` CLI 或 `codex` CLI，让 Claude Code / Codex 在 canvas 里运行，实时把输出流传回节点显示。

优势：
- 使用 Claude Code 订阅而非 API key，省费用
- 有完整的文件读写、终端、搜索能力
- 用户能看到每一步执行过程和文件变更

### CLI 选择

```
● Claude Code（本地 claude CLI）
○ Codex（本地 codex CLI）
```

### 节点视觉设计

**严格遵循官方配色，不自行设计颜色：**

```typescript
// tokens.ts 新增
aiCodingAgent: {
  claudeCode: {
    headerBg: '#D97757',   // Claude Code 官方橙色
    bg: 'bg-orange-50',
    border: 'border-[#D97757]',
    text: 'text-orange-900',
    hex: '#D97757',
  },
  codex: {
    headerBg: '#000000',   // OpenAI 黑色
    bg: 'bg-gray-50',
    border: 'border-black',
    text: 'text-gray-900',
    hex: '#000000',
  }
}
```

节点 Header 使用对应官方 SVG Logo（非 lucide-react，需要单独引入）。

### 节点状态显示

```
未安装：
┌─────────────────────────────────┐
│ [官方Logo] AI Coding  [未安装]  │
├─────────────────────────────────┤
│ [AlertTriangle] 未检测到         │
│ Claude Code                     │
│ [查看安装教程]                   │
└─────────────────────────────────┘

运行中：
┌─────────────────────────────────┐
│ [官方Logo] AI Coding  [运行中]  │
├─────────────────────────────────┤
│ 工作目录：~/my-project/         │
│ ┌─────────────────────────────┐ │
│ │ [Terminal] 实时输出          │ │
│ │ Reading src/app.tsx...      │ │
│ └─────────────────────────────┘ │
│ 文件变更：                       │
│ [FilePen]  src/app.tsx          │
│ [FilePlus] src/Button.tsx       │
│ ████████░░ 运行 3分12秒          │
└─────────────────────────────────┘

完成后：
┌─────────────────────────────────┐
│ [官方Logo] AI Coding     [完成] │
├─────────────────────────────────┤
│ 文件变更（3个）：                 │
│ [FilePen]  src/app.tsx  [查看]  │
│ [FilePlus] src/Button.tsx       │
│ [FileX]    src/old-utils.ts     │
│ [查看完整输出]                    │
└─────────────────────────────────┘
```

文件变更图标：FilePen（修改）/ FilePlus（新建）/ FileX（删除）。

### 安装引导弹窗

```
┌──────────────────────────────────────────────┐
│ 安装 Claude Code                        [X]  │
├──────────────────────────────────────────────┤
│ 步骤一：确认 Node.js 版本                    │
│   [检测] [CheckCircle] v20.11.0 已安装       │
│                                              │
│ 步骤二：安装 Claude Code                     │
│   npm install -g @anthropic-ai/claude-code   │
│                              [Copy]          │
│                                              │
│ 步骤三：登录账号                             │
│   claude login                   [Copy]      │
│   需要 Claude Pro 或 Max 订阅                │
│                                              │
│ 步骤四：验证安装                             │
│   [检测是否安装成功]                          │
│   [CheckCircle] Claude Code v1.x.x 已就绪   │
└──────────────────────────────────────────────┘
```

### Skills 管理面板

```
Claude Code Skills
─────────────────────────────────────
[CheckCircle] skill-creator  [全局]  [Trash2]
[CheckCircle] docx           [全局]  [Trash2]
[CheckCircle] my-skill       [项目]  [Trash2]

[Plus 从 GitHub 安装]  [ExternalLink skillsmp.com]
```

### MCP 管理面板

```
MCP 服务器
─────────────────────────────────────
[Wifi]    filesystem  运行中  [ToggleRight] [Settings2]
[Wifi]    github      运行中  [ToggleRight] [Settings2]
[WifiOff] postgres    未连接  [ToggleLeft]  [Settings2] [Trash2]

[Plus 添加 MCP 服务器]
```

### API Routes

```
GET    /api/tools/claude-code/check              检测 CLI 安装
POST   /api/tools/claude-code/run                执行（SSE）
GET    /api/tools/claude-code/skills             列出 skills
POST   /api/tools/claude-code/skills/install     安装 skill
DELETE /api/tools/claude-code/skills/:name       卸载 skill
GET    /api/tools/claude-code/mcps               列出 MCP
POST   /api/tools/claude-code/mcps               添加 MCP
PUT    /api/tools/claude-code/mcps/:name         启用/禁用/更新
DELETE /api/tools/claude-code/mcps/:name         删除 MCP
GET    /api/tools/claude-code/diff               获取文件变更
```

### 新增文件

```
src/
├── components/
│   ├── canvas/nodes/
│   │   └── ai-coding-agent-node.tsx
│   └── layout/
│       └── ai-coding-agent-config.tsx   # Skills + MCP 管理面板
└── app/api/tools/claude-code/
    ├── route.ts
    ├── skills/route.ts
    ├── mcps/route.ts
    └── diff/route.ts
```

---

## 五、封装节点的可观察性

### 概念

封装节点不是黑盒，用户可以悬停预览内部结构，双击进入查看和编辑内部 flow。
类比 Figma 组件系统：可以使用组件，也可以双击进入编辑内部。

### 两个交互层次

**悬停预览（Hover，1秒后触发）**

```
┌─────────────────────────────────┐
│ [Package] 产品研发流程  [进入]  │
├─────────────────────────────────┤
│  [Input] → [研究员] → [写作助手]│
│                   ↓             │
│               [Output]          │
│ 3个节点  最后修改：今天          │
└─────────────────────────────────┘
```

使用 React Flow MiniMap 组件渲染缩略图。

**双击进入**

进入内部 flow，顶部面包屑：

```
FlowCraft  |  主 Flow  >  产品研发流程  |  [ArrowLeft 返回]
```

支持多层嵌套：主 Flow > 产品研发 > 竞品分析子流程

### 共享定义 vs 独立副本

```
共享定义（默认）：
  节点右上角显示 <Layers className="w-3 h-3" />
  修改内部影响所有使用该 Agent 的 Flow
  有版本号（时间戳），不一致时显示 [RefreshCw] 更新提示

独立副本：
  右键 → "脱离共享，创建独立副本"
  无特殊标识
  内联存储在主 flow.json 里
```

### 封装节点视觉

```
┌─────────────────────────────────┐
│ [Package] 产品研发流程  [共享]  │
├─────────────────────────────────┤
│ 包含：研究员 · 分析师 · 写作助手│
│ 3个节点  2条连线                │
└─────────────────────────────────┘
```

Header 颜色取内部节点中占比最多的类型的颜色。

### 封装操作

**封装：**
```
1. 框选或多选节点
2. 浮动工具栏出现 [Package 封装成 Agent]
3. 弹出命名对话框
4. 保存到 agents/packs/{名称}/
```

**解封：**
```
右键 → [Unpackage 解除封装]
内部节点还原，连线保持
```

---

### 封装节点内部包含个人 Agent 的处理

封装节点内部可能包含三种 agent，复杂度不同：

```
类型A：普通 Agent 节点（没有 individualName）
  只存在于这个封装里，没有独立身份
  修改只影响这个封装，无需特殊处理

类型B：个人 Agent 引用（有 individualName，有 Layers 图标）
  老王有自己独立的记忆和人格
  修改时需要明确选择影响范围

类型C：嵌套封装节点
  封装里还有封装
  作为整体执行，层层传递记忆
```

**核心规则：**

```
规则一：个人 Agent 永远保持独立身份
  无论在哪个封装里，老王都是老王
  记忆始终写入 agents/individuals/老王/memory.md
  封装无法"拥有"个人 Agent

规则二：修改封装内部的个人 Agent 必须明确选择

规则三：封装记忆和个人记忆独立存在，按优先级注入

规则四：嵌套封装层层传递记忆，不穿透多层
```

**修改封装内部个人 Agent 时的提示：**

```
用户在封装内部修改了老王的配置
→ 弹出强警告弹窗：

┌──────────────────────────────────────┐
│ [AlertTriangle] 你正在修改个人 Agent │
├──────────────────────────────────────┤
│ 老王 是一个独立的个人 Agent          │
│ 修改他的配置将影响：                 │
│ · 所有 Flow 里使用老王的节点         │
│ · 老王在其他封装里的表现             │
│                                      │
│ 你想要：                             │
│ ● 修改老王本人（影响所有地方）       │
│ ○ 在这个封装里创建老王的独立副本     │
│   （只影响这个封装，不影响老王本人） │
│                                      │
│ [取消]                    [确认]     │
└──────────────────────────────────────┘

选择"创建独立副本"后：
  老王在封装内变为普通 Agent 节点
  失去 Layers 图标（不再是引用）
  配置和老王本人脱钩
  记忆独立存储在封装的 memory 里
```

**画布上修改共享封装节点时的提示：**

```
用户修改了引用模式的封装节点内部 flow
→ 弹出提示：

┌──────────────────────────────────────┐
│ 你正在修改共享定义                   │
├──────────────────────────────────────┤
│ 有 X 个 Flow 使用了「竞品研究组合」  │
│ 修改将影响所有使用它的地方           │
│                                      │
│ ● 修改共享定义（影响所有地方）       │
│ ○ 创建独立副本（只影响当前 Flow）    │
│                                      │
│ [取消]                    [确认]     │
└──────────────────────────────────────┘
```

### 封装节点的记忆系统

**记忆的归属：**

```
封装整体记忆：
  存在 agents/packs/{名称}/memory.md
  记录团队协作层面的经验
  属于封装节点，和内部个人 Agent 无关

内部个人 Agent 的记忆：
  仍然存在 agents/individuals/{name}/memory.md
  属于个人 Agent 本身，跨所有 flow 和封装共享
  封装无法拥有或覆盖这份记忆

内部普通 Agent 的记忆：
  存在 workspace/{flowId}/memory/{nodeId}.md
  只在这个 flow 里有效
```

**记忆注入顺序（内部第一个节点为个人 Agent 时）：**

```
[个人 Agent 的工作风格]   ← 最高优先级
[个人 Agent 的个人经验]
---
[封装节点的整体记忆]      ← 团队经验
---
[个人 Agent 的 System Prompt]

这样个人 Agent 既保持自己的个性
又了解这个团队的工作方式
```

**嵌套封装的记忆传递：**

```
外层封装整体记忆
  → 注入给内层封装的第一个节点
内层封装整体记忆
  → 注入给内层第一个 agent

两层记忆叠加但不合并，各自独立
外层记忆不穿透到内层的深处
```

### 存储结构

```
agents/
├── individuals/    # 个人 Agent（见第八节）
│   └── index.json
└── packs/          # 封装的 Agent 组合
    ├── index.json
    └── {名称}/
        ├── pack.md      # 组合描述和配置
        ├── flow.json    # 内部节点和连线
        └── memory.md    # 整体记忆（团队层面）
```

### 新增文件

```
src/
├── components/canvas/
│   ├── packed-node.tsx
│   ├── packed-node-preview.tsx
│   ├── pack-dialog.tsx
│   └── breadcrumb-nav.tsx
└── hooks/
    └── usePackedNode.ts
```

---

## 六、Agent 人格系统（基础版）

### 概念

每个 Agent 节点可以拥有独立的人格——名字、性格、背景、价值观。
同样的 tools 和 skills，不同的人格会让 agent 做出真正不同的判断。

人格的三个作用：
```
人设（System Prompt 前置注入）→ 决定思维方式和价值取向
私人记忆（memory/{nodeId}.md）→ 积累经历，随时间成长
交互风格                      → 影响和其他节点、用户沟通的方式
```

### 记忆归属原则

```
有人格配置的节点 → 有记忆（自动更新）
无人格配置的节点 → 无记忆

有记忆：Agent 节点、AI Coding Agent 节点、Initializer 节点
无记忆：Tool / Skill / Human / Input / Output / Condition / Merge
```

Merge 节点如果用户配置了人格，则也有记忆。
其他节点不支持人格配置。

### 配置面板新增"人格"Tab

```
右侧面板 tab：
[基本配置]  [Tools/Skills]  [完成条件]  [记忆]  [人格]
```

人格 Tab 内容：

```
[UserCircle] 身份
─────────────────────
名字：  [________________]
角色：  [________________]

[Sliders] 性格特征
─────────────────────
思维风格：  ○ 保守谨慎   ● 平衡   ○ 大胆激进
沟通风格：  ○ 简洁直接   ● 详细严谨   ○ 苏格拉底式
价值倾向：  ○ 效率优先   ○ 用户优先   ● 质量优先

[BookOpen] 背景故事（选填）
─────────────────────
[textarea]

[Lightbulb] 专业信念（选填）
─────────────────────
[textarea]

[Eye 预览注入的 System Prompt]
```

### 人格注入机制

```typescript
// src/lib/personality-injector.ts
export function buildPersonalityPrompt(
  personality: PersonalityConfig,
  privateMemory: string
): string
```

注入顺序：
```
[人格 Prompt]
---
[用户自定义的 System Prompt]
```

没有人格配置时不注入任何内容，不影响现有行为。

### 私人记忆设计原则（重要）

记忆系统的核心目标是积累**行为准则**，而不是**事件记录**。

```
错误的方向（事件记录）：
  "分析了 Dify 的竞品，发现定价策略是..."
  "写了一份市场报告，包含 SWOT 分析..."
  → 这是日志，不是学习，下次运行读了也不知道该怎么改变行为

正确的方向（行为准则）：
  "用户偏好有数据支撑的结论，避免纯观点"
  "复杂分析任务要先拆子问题再逐个解决"
  "写代码后必须 review，重点检查边界条件"
  → 这是经验，能真正影响下次的工作方式
```

### 两个记忆来源

```
来源一：培训 Chat（最高优先级）
  用户主动告诉 agent 该怎么做
  例如："以后写代码记得加注释"
       "你的语气太正式了，随意一点"
  这类记忆最准确，写入"工作风格"分区

来源二：运行后自动提炼
  从任务结果和用户反馈里提炼行为准则
  质量不如来源一，但自动发生
  写入"从经验中学到的"分区
```

### 私人记忆自动更新

记忆更新不是简单的"成功触发正向，失败触发反思"，
而是基于**运行是否有意义**和**用户是否给了反馈**来决定。

**核心原则：**
```
有意义的运行 = agent 做了实质性的思考和工作
  → 触发记忆更新

无意义的运行 = 还没开始就出错了
  → 不触发，没有可提炼的经验
```

**触发规则（第二阶段）：**

```
触发正向记忆：
  节点状态变为 success
  且用户之后没有通过即时反馈给出负面反馈

触发反思记忆：
  用户点击了节点上的 MessageCircle 即时反馈按钮
  并在对话中表达了不满或改进要求
  （无论节点当时是 success 还是 error 状态）

不触发记忆更新：
  技术性错误（API timeout / 网络错误）
  用户手动停止且没有给即时反馈
  maxIterations 强制停止（没有有意义的输出）
```

**第三阶段新增的触发来源：**

```
Orchestrator 判断子任务质量不达标
  → 自动触发对应 agent 的反思记忆

flow 里有质检节点且判断不通过
  → 触发上游 agent 的反思记忆
```

**runCount 计算规则：**
```
触发正向记忆 → runCount +1
触发反思记忆 → runCount +1
不触发记忆   → runCount 不变
```

使用轻量模型（deepseek-chat）提炼，省费用。
提炼异步进行，失败静默处理，不影响主流程。

**正向记忆 prompt：**
```
你刚刚成功完成了一项任务。

基于这次任务和结果，提炼出影响你未来工作方式的行为准则。
只记录能改变你行为的规则，例如：
- 这类任务要先做 X 再做 Y
- 遇到 A 情况要注意 B
- 用户偏好 C 风格的输出

不要记录任务内容本身，只记录工作方式层面的学习。
如果这次没有值得改变行为的收获，输出"无"。
200 字以内。
```

**反思记忆 prompt（用户给了即时反馈时）：**
```
用户刚刚针对你的运行结果给出了反馈。

基于用户的反馈，提炼出影响你未来工作方式的行为准则：
- 这次输出哪里不符合用户期望
- 用户希望你下次怎么做得不同
- 这类任务需要注意什么

只记录用户明确表达的改进要求。
如果没有具体改进要求，输出"无"。
200 字以内。
```

**培训 Chat 的记忆 prompt：**
```
你刚刚和用户进行了一次对话。

提炼用户明确表达的偏好和要求，作为你的工作准则：
- 用户对输出风格有什么要求
- 用户希望你遵守什么工作流程
- 用户的背景和偏好是什么

只记录用户明确说出来的要求，不要推测。
如果用户没有明确表达任何要求，输出"无"。
200 字以内。
```

### 记忆文件格式

```markdown
# Alex 的行为准则

## 工作风格（用户主动告知，最高优先级）
- 写代码后必须做 review，重点看边界条件和错误处理
- 输出结果前先给一句话总结
- 语气要随意自然，不要太正式
- 用户是 B2B SaaS 背景，分析要从企业视角出发

## 从经验中学到的（自动提炼）

### 2024-01-15 [成功]
复杂分析任务先拆子问题再逐个解决，不要试图一次性输出完整答案。

### 2024-01-16 [反思]
这类架构设计任务需要更多迭代，maxIterations 建议设 20 以上。
任务描述模糊时要先向用户确认范围，不要自己假设。
```

超过 50 条"从经验中学到的"时自动压缩（压缩前备份）。
"工作风格"分区不参与压缩，永久保留。
压缩时反思记忆的权重高于成功记忆，优先保留。

### 记忆注入顺序

人格注入时，记忆按以下顺序拼接：

```
[人格描述]
---
[工作风格（用户主动告知）]  ← 最高优先级，放最前面
[从经验中学到的（近期）]    ← 只取最近 10 条，避免太长
---
[用户自定义的 System Prompt]
```

### 节点标识

有人格配置的节点，header 显示名字：

```
┌─────────────────────────────────┐
│ [Bot] Alex · 研究员    [运行中] │
```

悬停名字显示 tooltip：
```
Alex · 资深产品经理
平衡型 · 质量优先
记忆：8 条
```

### 即时反馈按钮

节点运行结束后（success 或 error 状态），
节点右上角出现 [MessageCircle] 即时反馈按钮，
和 HelpCircle、Layers 按钮并排，
默认隐藏，group-hover 时显示。

```
┌─────────────────────────────────┐
│ [Bot] Alex · 研究员  [完成]     │
│                  [?][◎][💬]    │  ← hover 时显示
├─────────────────────────────────┤
│ Output          [查看全部]      │
│ 竞品分析已完成，Dify 的定价...  │
└─────────────────────────────────┘
```

点击 [MessageCircle] 后打开对话窗口，
和培训型 Chat 界面相同，但有额外的上下文：

```
弹窗 Header：
  [Bot] 和 Alex 对话              [X]
  研究员 · 针对刚才的运行结果

上下文提示条（黄色）：
  [AlertCircle] 你正在针对刚才的运行结果给出反馈
  Alex 会把你的反馈记入工作准则

对话区域：
  Alex 的开场白带上运行结果摘要：
  "我刚完成了竞品分析任务，
   输出了关于 Dify/Langflow/n8n 的报告。
   有什么需要改进的地方吗？"
```

对话结束后记忆提炼 prompt 有所不同：

```
用户刚刚针对你的一次运行结果给出了反馈。
提炼用户明确表达的改进要求，作为你的工作准则：
- 这次输出哪里不符合用户期望
- 用户希望你下次怎么做得不同
- 用户对这类任务有什么特殊要求

只记录用户明确说出来的要求。
如果用户没有提出具体改进要求，输出"无"。
200 字以内。
```

提炼结果写入记忆文件的"工作风格"分区（最高优先级）。

**两种对话入口的区别：**
```
节点卡片按钮（即时反馈）：
  带着刚才运行结果的上下文
  适合：针对某次具体输出给反馈
  记忆分类：工作风格（用户主动告知）

左侧面板按钮（主动培训）：
  没有具体运行上下文
  适合：传递通用偏好和背景信息
  记忆分类：工作风格（用户主动告知）
```

两种入口的记忆都写入"工作风格"分区，
这是优先级最高的记忆，永久保留，不参与压缩。

### 记忆 Tab

```
[Brain] 私人记忆                   [Trash2]
─────────────────────────────────────
Alex 共积累了 8 条记忆

最近记忆：
┌─────────────────────────────────┐
│ 2024-01-16                      │
│ 方案B数据支撑充分，值得冒险...  │
└─────────────────────────────────┘

[List 查看全部]  [Edit 手动编辑]
```

### 新增文件

```
src/
├── lib/
│   └── personality-injector.ts
└── components/layout/
    ├── personality-config.tsx
    └── memory-viewer.tsx
```

---

## 七、Chat 模式：对话即培训

### 概念

Chat 模式是塑造 agent 人格的主要方式。每次对话都在教 agent 你的背景、偏好和工作方式。
对话结束后自动沉淀到私人记忆，永久影响以后的行为。

### 两种 Chat 入口

**入口一：任务型 Chat（运行中介入）**

运行中节点右上角出现介入按钮：

```
[MessageCircle 介入]

点击后弹出：
  [Send]        发送消息（不打断，下一轮注入）
  [PauseCircle] 暂停并对话

暂停对话完成后：
  [Play]        继续执行
  [RotateCcw]   重新执行
  [SkipForward] 跳过
```

**入口二：培训型 Chat（主动培养）**

左侧面板 Agent 卡片：

```
┌────────────────────────────────────┐
│ [Bot] Alex · 研究员        [熟悉]  │
│ 记忆 12条 · 运行 47次              │
│ [GripVertical] [MessageCircle] [Settings2] │
└────────────────────────────────────┘
```

点击 [MessageCircle] 打开培训 Chat 界面：

```
┌──────────────────────────────────────────────┐
│ [Bot] 和 Alex 聊天                     [X]   │
│ 研究员 · 记忆 12条 · 运行 47次               │
├──────────────────────────────────────────────┤
│  [Bot]  Alex：你好！有什么可以帮你的吗？     │
│  [User] 你：我们公司是做 B2B SaaS 的...      │
│  [Bot]  Alex：明白了，我会记住这个背景。     │
├──────────────────────────────────────────────┤
│ [Info] 这次对话将自动更新 Alex 的记忆        │
├──────────────────────────────────────────────┤
│ [输入消息...]                      [Send]    │
└──────────────────────────────────────────────┘
```

### 记忆更新提示

对话结束后显示：

```
[Brain] 记忆已更新
─────────────────────────────
新增了解：
[CheckCircle] 用户公司背景（B2B SaaS）
[CheckCircle] 目标受众偏好（业务语言）
[CheckCircle] 输出风格调整

Alex 现在共有 15 条记忆
[List 查看全部记忆]
```

### Agent 成熟度系统

```typescript
type MaturityLevel = 'new' | 'learning' | 'familiar' | 'expert'

// 计算规则
// new：       0-5 次运行
// learning：  6-20 次运行
// familiar：  21-50 次运行
// expert：    50次以上
```

成熟度徽章样式（文字标签，无 emoji）：

```
new      → bg-slate-100 text-slate-500  · "新建"
learning → bg-blue-100  text-blue-600   · "学习中"
familiar → bg-green-100 text-green-700  · "熟悉"
expert   → bg-purple-100 text-purple-700 · "专家"
```

### 培训话题引导

Chat 界面提供引导提示（使用 lucide-react 图标）：

```
[Lightbulb] 推荐告诉 Alex 的内容：

[Building2] 你的背景："我们公司是做...的"
[Heart]     你的偏好："我喜欢...风格"
[Tag]       行业术语："我们行业里 XXX 是指..."
[History]   过去经验："上次你做的...不太对"
[Workflow]  工作方式："我的流程是先...再..."
```

### 新增文件

```
src/
├── components/
│   ├── canvas/nodes/
│   │   └── node-intervene-panel.tsx
│   └── agent/
│       ├── agent-chat-modal.tsx
│       ├── chat-memory-summary.tsx
│       └── agent-maturity-badge.tsx
└── hooks/
    ├── useAgentChat.ts
    └── useMemoryExtraction.ts
```

---

## 八、Agent 保存和管理系统

### 概念

Agent 分为两种，需要明确区分：

```
个人 Agent（Individual Agent）：
  一个有人格的单一 agent
  system prompt + tools + skills + 人格 + 记忆
  类比：独立的员工
  图标：<Bot />

Agent 组合（Packed Agent）：
  一组节点的封装（含内部 flow）
  类比：小团队或工作流程
  图标：<Package />
```

两者不互斥：
- 组合内部可以引用个人 Agent
- 个人 Agent 可以从组合内部提取保存
- 个人 Agent 拖入 canvas 默认是引用模式，可选创建副本

### 保存为个人 Agent

右键 Agent 节点 → [BookmarkPlus 保存为独立 Agent]

弹出对话框：

```
┌──────────────────────────────────────┐
│ [BookmarkPlus] 保存为独立 Agent      │
├──────────────────────────────────────┤
│ 名字：[________________]             │
│ 描述：[________________]             │
│                                      │
│ 保存内容：                           │
│ [CheckSquare] 人格配置               │
│ [CheckSquare] System Prompt          │
│ [CheckSquare] Tools / Skills         │
│ [CheckSquare] 已有记忆（3条）        │
│                                      │
│ [X 取消]              [Save 保存]    │
└──────────────────────────────────────┘
```

### 存储结构

```
agents/
├── individuals/                  # 个人 Agent
│   ├── index.json                # [{id, name, role, description, maturity}]
│   └── {name}/
│       ├── agent.md              # 人格 + system prompt + tools + skills
│       └── memory.md             # 私人记忆
│
└── packs/                        # Agent 组合
    ├── index.json                # [{id, name, description, nodeCount}]
    └── {name}/
        ├── pack.md               # 组合描述和配置
        ├── flow.json             # 内部节点和连线
        └── memory.md             # 整体记忆
```

### 左侧面板分区

```
节点库
─────────────────────────────────────
基础节点 / 预设节点（见第一节）

─────────────────────────────────────
个人 Agent                [ChevronDown]
─────────────────────────────────────
┌────────────────────────────────────┐
│ [Bot] Alex · 研究员        [熟悉]  │
│ 记忆 15条 · 运行 47次              │
│ [GripVertical] [MessageCircle] [Settings2] │
└────────────────────────────────────┘

─────────────────────────────────────
Agent 组合                [ChevronDown]
─────────────────────────────────────
┌────────────────────────────────────┐
│ [Package] 竞品研究组合             │
│ 研究员 + 分析师 · 运行 12次        │
│ [GripVertical] [Eye] [Settings2]   │
└────────────────────────────────────┘
```

图标说明：
```
GripVertical  → 拖入画布
MessageCircle → 聊天（仅个人 Agent）
Eye           → 查看内部（仅 Agent 组合）
Settings2     → 编辑配置
ChevronDown   → 折叠/展开分区
```

### 引用 vs 副本

```
引用模式（默认）：
  节点右上角显示 <Layers className="w-3 h-3 text-slate-400" />
  修改同步到原始 agent

独立副本：
  右键 → [Copy 创建独立副本]
  无 Layers 标识
```

### API Routes

```
GET    /api/agents/individuals           列出所有个人 Agent
POST   /api/agents/individuals           保存新个人 Agent
GET    /api/agents/individuals/:name     读取
PUT    /api/agents/individuals/:name     更新
DELETE /api/agents/individuals/:name     删除

GET    /api/agents/packs                 列出所有组合
POST   /api/agents/packs                 保存新组合
GET    /api/agents/packs/:name           读取
PUT    /api/agents/packs/:name           更新
DELETE /api/agents/packs/:name           删除
```

### 新增文件

```
src/
├── components/
│   ├── layout/
│   │   ├── left-panel-individuals.tsx
│   │   └── left-panel-packs.tsx
│   └── agent/
│       └── save-agent-dialog.tsx
├── hooks/
│   └── useAgentLibrary.ts
└── app/api/agents/
    ├── individuals/route.ts
    └── packs/route.ts
```

---

## 九、注意事项汇总

```
图标规范：
  所有图标使用 lucide-react，不使用 emoji
  节点内图标：w-4 h-4
  面板内图标：w-5 h-5
  小标识图标：w-3 h-3
  图标颜色跟随节点主题色

预设节点：
  拖入画布后生成新的唯一 id
  system prompt 可在右侧面板修改
  不影响基础节点拖拽功能

帮助弹窗：
  HelpCircle 按钮点击必须 stopPropagation
  弹窗 z-index：z-[150]

AI Coding Agent 节点：
  颜色严格遵循官方配色，不自行设计
  子进程必须有超时保护（默认 10 分钟）
  stderr 也要实时显示
  节点删除时 kill 对应子进程
  未安装 CLI 时只显示引导，不能运行

封装节点：
  缩略预览鼠标移开后延迟 200ms 关闭
  支持多层嵌套面包屑
  共享定义用时间戳作版本号
  独立副本内联在主 flow.json 里

人格系统：
  人格 prompt 放在 system prompt 最前面
  用 "---" 分隔
  没有人格配置时不注入任何内容
  有人格配置的节点才有记忆

记忆系统：
  记忆更新使用 deepseek-chat（省费用）
  更新失败不影响主任务输出
  每条记忆限制 200 字
  超过 50 条自动压缩，压缩前备份
  记忆文件纯本地，不上传

Chat 模式：
  复用 Playground 的 Chat 引擎
  对话历史存在 agents/individuals/{name}/chat-history/
  记忆提炼在对话结束后异步进行
  暂停 agent 时保存 messages[] 状态
  恢复执行时从保存状态继续

Agent 保存和管理：
  individuals/ 和 packs/ 严格分开
  引用模式下显示 Layers 图标
  个人 Agent 记忆跨 flow 共享
  有人格配置的节点才有记忆
```
