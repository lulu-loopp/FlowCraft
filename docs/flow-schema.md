# flow.json Schema 文档

FlowCraft 的流程以 JSON 文件存储在 `flows/` 目录下，文件名为 `{flowId}.json`。

---

## 顶层结构

```typescript
{
  id: string          // 流程唯一标识，格式 "flow-{timestamp}" 或自定义
  name: string        // 流程名称
  nodes: Node[]       // 节点数组
  edges: Edge[]       // 连线数组
  createdAt: string   // ISO 8601 创建时间
  updatedAt: string   // ISO 8601 最后更新时间
  lastRunAt?: string  // ISO 8601 最后运行时间（可选）
}
```

---

## 节点通用结构

每个节点遵循 ReactFlow 的 `Node` 接口：

```typescript
{
  id: string                       // 节点唯一 ID，格式 "{type}-{timestamp}"
  type: string                     // 节点类型（见下方各类型说明）
  position: { x: number, y: number }  // 画布坐标
  data: Record<string, unknown>    // 节点配置和运行时数据（按类型不同）
  selected?: boolean               // 是否被选中（运行时）
  measured?: { width: number, height: number }  // 渲染尺寸（运行时）
  dragging?: boolean               // 是否拖拽中（运行时）
}
```

### 运行时字段说明

以下字段存在于 `data` 中，但属于运行时状态，不应手写：

| 字段 | 说明 |
|------|------|
| `status` | 节点执行状态：`idle` / `running` / `success` / `error` / `waiting` |
| `logs` | 执行日志数组 |
| `currentOutput` | 当前输出文本 |
| `currentToken` | 流式输出的当前 token |

---

## 节点类型

### `io` — 输入节点

流程的起点，用户在此输入文本和文件。

```typescript
data: {
  label: string              // 节点标签
  inputText?: string         // 输入文本
  inputFiles?: InputFile[]   // 附件列表
}
```

**InputFile 结构：**

```typescript
{
  name: string               // 文件名
  type: "image" | "text"     // 文件类型
  content?: string           // 文本内容（type=text 时）
  base64?: string            // Base64 编码（type=image 时）
  mimeType?: string          // MIME 类型
  preview?: string           // 预览 URL（运行时）
}
```

### `agent` — AI 代理节点

核心节点类型，执行 AI 推理任务。

```typescript
data: {
  label: string              // 节点标签 / 代理名称
  systemPrompt?: string      // 系统提示词
  provider?: string          // AI 提供商："deepseek" | "openai" | "anthropic" | "google"
  model?: string             // 模型名称，如 "deepseek-chat" | "gpt-4o"
  maxIterations?: number     // 最大工具调用轮次（默认 10）
  temperature?: number       // 温度参数（0-2）
  enabledTools?: string[]    // 启用的工具列表，如 ["web_search", "calculator"]
  enabledSkills?: string[]   // 启用的技能列表

  // 个性化（可选）
  personality?: {
    name: string             // 角色名
    role: string             // 角色描述
    thinkingStyle: string    // 思维风格
    communicationStyle: string  // 沟通风格
    valueOrientation: string // 价值取向
    backstory?: string       // 背景故事
    beliefs?: string         // 信念
  }

  // 引用已保存的个体代理（可选）
  isReference?: boolean      // 是否为引用
  individualName?: string    // 引用的代理名称
}
```

### `output` — 输出节点

流程的终点，展示最终结果。

```typescript
data: {
  label: string              // 节点标签
  documents?: Array<{        // 关联文档
    url: string
    name: string
  }>
  documentUrl?: string       // 单个文档 URL
  documentName?: string      // 单个文档名称
}
```

### `condition` — 条件分支节点

根据条件将流程分为两个分支（true/false）。

```typescript
data: {
  label: string                      // 节点标签
  conditionMode?: "natural" | "expression"  // 条件模式
  conditionValue?: string            // 条件表达式或自然语言描述
  provider?: string                  // AI 提供商（natural 模式需要）
  model?: string                     // 模型名称
  maxLoopIterations?: number         // 循环最大次数（条件回环时）
}
```

**输出 Handle：**
- `true-handle` — 条件为真时的输出
- `false-handle` — 条件为假时的输出

### `packed` — 封装节点

将多个节点打包成一个可复用的子流程。

```typescript
data: {
  label: string              // 节点标签
  packName: string           // 包名称（对应 agents/packs/{name}/）
  isSharedPack?: boolean     // 是否为共享包
  handleConfig: Array<{      // Handle 映射配置
    id: string               // Handle ID，如 "input-0" / "output-0"
    label: string            // 对应内部节点的标签
    type: "input" | "output" // Handle 类型
    internalNodeId: string   // 内部节点 ID
  }>
}
```

### `aiCodingAgent` — AI 编程代理节点

执行代码编写任务的特殊代理。

```typescript
data: {
  label: string              // 节点标签
  cli?: string               // CLI 工具名："claude" | "codex"
  taskDescription?: string   // 任务描述
  workDir?: string           // 工作目录
  maxTimeout?: number        // 最大超时（毫秒）
}
```

### 其他节点类型

| 类型 | 说明 |
|------|------|
| `tool` | 工具节点（通用） |
| `skill` | 技能节点 |
| `human` | 人工介入节点 |
| `initializer` | 系统初始化节点 |

这些类型使用 `GenericNode` 渲染，data 结构与 `agent` 类似。

---

## 边（Edge）结构

```typescript
{
  id: string                 // 边的唯一 ID，格式 "xy-edge__{sourceId}-{targetId}"
  type: "custom"             // 边类型，固定为 "custom"（使用 CustomEdge 渲染）
  source: string             // 源节点 ID
  target: string             // 目标节点 ID
  sourceHandle?: string      // 源节点的输出 Handle ID（用于 condition/packed）
  targetHandle?: string      // 目标节点的输入 Handle ID
  label?: string             // 边标签（可选）
}
```

**Handle 命名规则：**
- Condition 节点：`true-handle` / `false-handle`
- Packed 节点：`input-0` / `output-0` / `output-1` ...
- 普通节点：无需指定 Handle（默认连接）

---

## 索引文件

`flows/index.json` 维护所有流程的元数据索引：

```typescript
Array<{
  id: string          // 流程 ID
  name: string        // 流程名称
  nodeCount: number   // 节点数量
  createdAt: string   // 创建时间
  updatedAt: string   // 更新时间
  lastRunAt?: string  // 最后运行时间
}>
```

---

## 完整示例

以下示例包含所有主要节点类型：

```json
{
  "id": "flow-example",
  "name": "竞品分析流程",
  "nodes": [
    {
      "id": "io-1",
      "type": "io",
      "position": { "x": 80, "y": 300 },
      "data": {
        "label": "分析目标",
        "inputText": "分析 Dify 的竞品"
      }
    },
    {
      "id": "agent-1",
      "type": "agent",
      "position": { "x": 400, "y": 200 },
      "data": {
        "label": "研究员",
        "systemPrompt": "你是一个专业的竞品研究员，负责搜索和分析目标产品的竞争对手。",
        "provider": "deepseek",
        "model": "deepseek-chat",
        "maxIterations": 10,
        "enabledTools": ["web_search"]
      }
    },
    {
      "id": "agent-2",
      "type": "agent",
      "position": { "x": 400, "y": 500 },
      "data": {
        "label": "技术分析师",
        "systemPrompt": "你是一个技术分析师，负责从技术角度评估产品。",
        "provider": "openai",
        "model": "gpt-4o",
        "enabledTools": ["web_search", "calculator"]
      }
    },
    {
      "id": "condition-1",
      "type": "condition",
      "position": { "x": 750, "y": 300 },
      "data": {
        "label": "质量检查",
        "conditionMode": "natural",
        "conditionValue": "报告内容超过 500 字且包含具体数据",
        "provider": "deepseek",
        "model": "deepseek-chat"
      }
    },
    {
      "id": "agent-3",
      "type": "agent",
      "position": { "x": 1100, "y": 200 },
      "data": {
        "label": "报告撰写",
        "systemPrompt": "根据研究结果撰写一份完整的竞品分析报告。"
      }
    },
    {
      "id": "output-1",
      "type": "output",
      "position": { "x": 1400, "y": 300 },
      "data": {
        "label": "最终报告"
      }
    }
  ],
  "edges": [
    {
      "id": "xy-edge__io-1-agent-1",
      "type": "custom",
      "source": "io-1",
      "target": "agent-1"
    },
    {
      "id": "xy-edge__io-1-agent-2",
      "type": "custom",
      "source": "io-1",
      "target": "agent-2"
    },
    {
      "id": "xy-edge__agent-1-condition-1",
      "type": "custom",
      "source": "agent-1",
      "target": "condition-1"
    },
    {
      "id": "xy-edge__agent-2-condition-1",
      "type": "custom",
      "source": "agent-2",
      "target": "condition-1"
    },
    {
      "id": "xy-edge__condition-1-agent-3",
      "type": "custom",
      "source": "condition-1",
      "target": "agent-3",
      "sourceHandle": "true-handle"
    },
    {
      "id": "xy-edge__condition-1-agent-1",
      "type": "custom",
      "source": "condition-1",
      "target": "agent-1",
      "sourceHandle": "false-handle",
      "label": "重新研究"
    },
    {
      "id": "xy-edge__agent-3-output-1",
      "type": "custom",
      "source": "agent-3",
      "target": "output-1"
    }
  ],
  "createdAt": "2026-03-18T10:00:00.000Z",
  "updatedAt": "2026-03-18T10:00:00.000Z"
}
```

---

## YAML 格式

FlowCraft 支持 YAML 格式的导出/导入。YAML 格式更适合人类阅读和手动编辑。

导出时：
- 运行时数据（status, logs, currentOutput 等）会被自动过滤
- 节点 ID 会简化为可读格式（如 `agent-1`）
- base64 图片数据不会导出，只保留文件名和类型
- packed 节点只保留外层配置（packName + handleConfig）

导入时：
- 所有节点会生成新的唯一 ID
- 创建新的 flow，不覆盖现有流程

**YAML 格式示例：**

```yaml
# FlowCraft Flow
name: 竞品分析流程
version: "1.0"
created: "2026-03-18T10:00:00.000Z"

nodes:
  - id: io-1
    type: io
    position: { x: 80, y: 300 }
    label: 分析目标
    data:
      inputText: 分析 Dify 的竞品

  - id: agent-1
    type: agent
    position: { x: 400, y: 200 }
    label: 研究员
    data:
      systemPrompt: 你是一个专业的竞品研究员...
      enabledTools:
        - web_search
      maxIterations: 10
      provider: deepseek
      model: deepseek-chat

edges:
  - source: io-1
    target: agent-1
```
