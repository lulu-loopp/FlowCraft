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
- 组件文件 ≤ 150 行，逻辑文件 ≤ 200 行，超出必须拆分
- 一个组件只做一件事
- 所有颜色/间距/字体从 src/styles/tokens.ts 取，不硬编码
- 通用组件放 src/components/ui/，不包含业务逻辑
- 自定义 hooks 放 src/hooks/
- 中英文文字全部走 next-intl，不硬编码字符串
- 用 useFlowStore.getState() 获取执行中的最新状态，避免 closure 陷阱
```

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

### 颜色体系

> 颜色定义见 `src/styles/tokens.ts`，以下为当前实现值。

| 节点类型 | Token key | 颜色 | Hex | Tailwind |
|---------|-----------|------|-----|----------|
| Agent | `agent` | 靛蓝 | `#6366f1` | `indigo-500` |
| Tool | `tool` | 翠绿 | `#10b981` | `emerald-500` |
| Skill | `skill` | 琥珀 | `#f59e0b` | `amber-500` |
| Human | `human` | 玫瑰 | `#f43f5e` | `rose-500` |
| Input (io) | `io` | 天蓝 | `#0ea5e9` | `sky-500` |
| Output | `output` | 石板 | `#64748b` | `slate-500` |
| Condition | `control` | 石板 | `#64748b` | `slate-500` |
| Initializer | `system` | 紫罗兰 | `#8b5cf6` | `violet-500` |

> UI 强调色（按钮、焦点环、运行指示器）使用 teal-600 `#0d9488`，与节点颜色系统独立。

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
Provider（select）：anthropic / openai / deepseek
Model（select）：根据 provider 动态加载
─────────────────────
Tools（checkbox 列表，从已安装工具动态读取）：
  □ web_search
  □ calculator
  □ url_fetch
  □ code_execute
  □ python_execute
  □ brave_search
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

所有配置修改实时同步到 flowStore 对应节点的 data 字段。

---

## Flow 执行引擎规格

### 执行流程

```
用户点击 Run Flow
  → 弹出对话框（如果 Input 节点没有文字）
  → 找到 Input 节点，读取 inputText + inputFiles
  → 拓扑排序所有节点
  → 按顺序执行（支持并行：上游全部完成才执行下游）
  → 每个节点完成后输出传给下游
  → 所有节点完成 → 标记 done
```

### 节点执行逻辑

```typescript
// Agent 节点 → 调用 /api/agent/run（SSE 流式）
// Tool 节点  → 直接调用对应工具（暂时透传输入）
// Human 节点 → 暂停，显示等待用户输入 UI
// Condition  → 自然语言模式：LLM 判断；表达式模式：eval
// Merge      → 收集所有上游输出，合并后传给 LLM 整合
// Input      → 读取 data.inputText + inputFiles
// Output     → 接收上游输出，存入 data.currentOutput
// Initializer→ 建立 workspace，写 features.json 和 progress.md
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
    │   └── {nodeId}.md      # 私人记忆（节点级别）
    └── runs/
        └── {runId}/         # 每次运行独立目录（git repo）
            └── outputs/
```

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
