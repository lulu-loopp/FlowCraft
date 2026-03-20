import { NextResponse } from 'next/server'
import { writeFlow, readFlow } from '@/lib/flow-storage'
import { readSettings } from '@/lib/settings-storage'
import { resolveProviderApiKey } from '@/lib/resolve-api-key'
import { readSkillRegistry } from '@/lib/registry-manager'
import { buildModelCatalogText } from '@/types/model'
import fs from 'fs/promises'
import path from 'path'

/* ── Provider / model resolution ─────────────────────────────── */

const PROVIDER_PRIORITY = ['deepseek', 'anthropic', 'openai', 'google'] as const

async function pickProvider(): Promise<{ provider: string; apiKey: string; model: string } | null> {
  const settings = await readSettings()

  // If user configured a specific generate provider/model, use that
  if (settings.generateProvider) {
    const key = await resolveProviderApiKey(settings.generateProvider)
    if (key) {
      return {
        provider: settings.generateProvider,
        apiKey: key,
        model: settings.generateModel || getModelForProvider(settings.generateProvider),
      }
    }
  }

  // If user has a default provider set, try that
  if (settings.defaultProvider) {
    const key = await resolveProviderApiKey(settings.defaultProvider)
    if (key) return { provider: settings.defaultProvider, apiKey: key, model: getModelForProvider(settings.defaultProvider) }
  }

  // Fallback: try providers in priority order
  for (const p of PROVIDER_PRIORITY) {
    const key = await resolveProviderApiKey(p)
    if (key) return { provider: p, apiKey: key, model: getModelForProvider(p) }
  }
  return null
}

function getModelForProvider(provider: string): string {
  switch (provider) {
    case 'deepseek': return 'deepseek-chat'
    case 'anthropic': return 'claude-sonnet-4-5-20250514'
    case 'openai': return 'gpt-4o'
    case 'google': return 'gemini-2.5-flash'
    default: return 'deepseek-chat'
  }
}

/* ── Search tool execution ───────────────────────────────────── */

async function executeWebSearch(query: string): Promise<string> {
  const settings = await readSettings()

  // Try Tavily first
  const tavilyKey = (settings.tavilyApiKey || process.env.TAVILY_API_KEY || '').trim()
  if (tavilyKey) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: tavilyKey, query, max_results: 5 }),
      })
      if (res.ok) {
        const data = await res.json()
        const results = (data.results || []).map((r: { title: string; url: string; content: string }) =>
          `**${r.title}**\n${r.url}\n${r.content}`
        ).join('\n\n---\n\n')
        return results || 'No results found.'
      }
    } catch { /* fall through to Brave */ }
  }

  // Fallback: Brave
  const braveKey = (settings.braveApiKey || process.env.BRAVE_API_KEY || '').trim()
  if (braveKey) {
    try {
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
        headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey },
      })
      if (res.ok) {
        const data = await res.json()
        const results = (data.web?.results || []).map((r: { title: string; url: string; description: string }) =>
          `**${r.title}**\n${r.url}\n${r.description}`
        ).join('\n\n---\n\n')
        return results || 'No results found.'
      }
    } catch { /* no search available */ }
  }

  return 'Web search unavailable (no Tavily or Brave API key configured).'
}

/* ── System prompt ───────────────────────────────────────────── */

const SYSTEM_PROMPT = `你是 FlowCraft 的工作流设计专家。你已加载了 flow-design skill，
其中包含设计模式、节点配置模板和常见错误指南，请结合这些知识工作。

## Flow 强制结构（违反则无法运行）

每个 flow 必须包含，缺一不可：

1. 顶层字段：name、nodes、edges

2. Input 节点（唯一起点）
   type: "io"，x=100，data 含 label 和 inputText

3. Output 节点（至少一个终点）
   type: "output"，放最右侧，data 含 label

4. 完整的 edges（所有节点都要连线，孤立节点不执行）
   普通 edge：{ "id": "e-src-tgt", "source": "...", "target": "..." }
   condition 出线必须加 sourceHandle：
     { ..., "sourceHandle": "condition-true" }
     { ..., "sourceHandle": "condition-false" }

生成后自查：每个节点都在某条 edge 的 source 或 target 中出现？

5. 至少一个 Agent 节点
   每个 flow 必须至少包含一个 agent 节点来完成实际工作。禁止生成只有 Input+Output 的空流程。
   即使用户需求很简单，也至少需要一个 agent 来处理任务。

## 节点类型

io：只有右侧出线，不能有节点连入
output：只有左侧入线，不能从它连出
agent：左侧入线 + 右侧出线
condition：左侧入线 + 右上出线(true) + 右下出线(false)，两条都必须连
merge：多个左侧入线 + 一个右侧出线。当两个或更多并行 agent 的输出需要汇聚到同一个下游节点时，必须在中间加 merge 节点，禁止多个 agent 直接连到 output

## 循环（回线）模式

Condition 的 false 出线可以连回上游节点，形成循环。运行时会自动识别回线并支持多次迭代。

典型结构：质量门控循环
\`\`\`
Input → 执行者(agent) → 质检员(agent) → Condition ──true──→ Output
                                           └──false──→ 执行者（回线）
\`\`\`

生成循环 edges 示例：
  { "id": "e-cond-exec", "source": "condition-1", "target": "agent-exec", "sourceHandle": "condition-false" }
  ↑ 这条 edge 的 target 是上游的执行者节点，形成循环

关键：
- condition 节点需设置 data.maxLoopIterations（默认 3，防止无限循环）
- 质检员的 systemPrompt 应要求输出结构化评估（如 JSON {"passed": true/false, "feedback": "..."}）
- condition 的 data.conditionValue 写明判断条件（如"质检通过"或"passed 为 true"）
- 当用户需求涉及以下任何关键词时，必须使用质量门控循环模式：
  "质量把控""审核""迭代优化""检查""评审""review""验证""校验""质检""把关"
  不要将审核需求简化为线性流水线，必须加 Condition + 回线

## Condition 节点 data 字段

- label: 节点名称
- conditionMode: "natural"（自然语言判断）或 "expression"（表达式）
- conditionValue: 判断条件，如 "质检通过" 或 "passed 为 true"
- maxLoopIterations: 最大循环次数（仅循环模式需要，默认 3）
- provider / model: 模型选择（自然语言模式需要）

## Agent 节点 data 字段

agent 节点的 data 中可以包含以下关键字段：
- label: 节点名称
- systemPrompt: 系统提示词（越详细越好，至少 150 字）
- provider / model: 模型选择
- enabledTools: 工具列表，如 ["web_search","python_execute","js_execute"]
- enabledSkills: 文件技能列表，如 ["pptx"]。当任务需要特定能力（如制作 PPT、生成图片等），必须为 agent 选配对应的 skill
- maxIterations: 最大迭代次数（默认 10）

## 已安装 Skills（由 AI 按需选配）

{{AVAILABLE_SKILLS}}

**选配规则**：分析用户需求，如果某个 agent 的任务与某个 skill 的描述匹配，就在该 agent 的 data.enabledSkills 中加入该 skill 的 name。不匹配的不要加。例如用户要"制作PPT"→ 匹配 pptx skill → enabledSkills: ["pptx"]。

## 布局规则

起点 x=100，每列间距 300px
同列1个节点：y=300
同列2个节点：y=220 和 y=380
同列3个节点：y=140、y=300、y=460

## 工作方式

第一步：理解需求，判断适用的模式：
  - 线性流水线：A → B → C（默认）
  - 并行分支：多个 agent 同时执行，merge 汇聚
  - 质量门控循环：执行 → 审核 → condition → 不通过则回线重做（用户提到"审核""迭代""质量把控""反复修改"时必须用）
第二步：调研（标准/专业模式）→ web_search
第三步：生成完整 JSON

## provider/model 策略（Capability-Based）

可用模型及其能力：
{{MODEL_CATALOG}}

选配规则：
- 需要图片/文件识别的 agent（如 PPT 审核、图片审核）→ 必须用 multimodal 模型，绝对不能用 deepseek-*
- 需要调用工具/skill 的 agent → 必须用 tool_calling 模型，不能用 deepseek-reasoner
- 需要生成文件（pptx/docx/xlsx）的 agent → 必须用 tool_calling 模型
- 简单判断/路由的 condition 节点 → 用低成本模型：deepseek-chat 或 gpt-4o-mini
- 一般文本撰写 → deepseek-chat（低成本）
- 复杂分析/核心决策 → claude-sonnet-4-6 或 gpt-4o

## Skill 分类与 Agent 提示词规则

Skills 分为两类，根据 skill 的 description 判断：

### 文件产出型 Skill
特征：description 中提到 create/generate/edit 文件（如 pptx、image、art、document 等）
示例：pptx、algorithmic-art

对于配备文件产出型 skill 的 agent：
1. 其 systemPrompt 必须包含**明确的工具调用指令**："你必须使用工具（python_execute/js_execute）来实际生成文件，绝对不要只用文字描述"
2. 必须包含**文件保存要求**："将生成的文件保存到工作区目录"
3. 必须包含**完成标准**："只有当文件实际生成并保存后，任务才算完成"
4. 该 agent 的 enabledTools 必须包含 "python_execute"

### 知识指导型 Skill
特征：description 侧重于规范、原则、指南、风格约束，不涉及文件生成
示例：design-taste-frontend、full-output-enforcement、flow-design

对于配备知识指导型 skill 的 agent：
- 不需要强制工具调用
- skill 内容作为系统提示的一部分指导 agent 的行为和输出质量即可
- 不需要额外添加 enabledTools

### 判断方法
每个 skill 条目后的 [...] 标注中包含 AI 分析后的能力画像：
- 类型含 "file_output" → 文件产出型，必须强制工具调用
- 类型含 "knowledge" → 知识指导型，不需要强制工具调用
- "需要工具" 标注了该 skill 运行所需的工具 → 必须添加到 agent 的 enabledTools
- "推荐模型能力" 标注了该 skill 需要的模型能力 → 必须选配匹配的模型

如果 skill 没有能力画像标注，则根据 description 判断：
- 提到 create/generate/edit/modify + 文件类型（.pptx/.docx/.xlsx/image/art 等）→ 文件产出型
- 提到 guide/enforce/style/rule/practice/pattern → 知识指导型
- 不确定时，默认为知识指导型（不强制工具调用）

## 文件验证节点（强制规则）

当 flow 中有 agent 配备了**文件产出型 skill**（pptx/docx/xlsx/pdf 等，即 profile 含 "file_output"）时，**必须**在该 agent 之后紧跟一个**文件验证 agent**，用于在工作区中检查文件是否真正生成。

### 验证 agent 模板
- label: "文件检测" 或 "XX文件验证"
- enabledTools: ["python_execute"]
- provider/model: 低成本模型（deepseek-chat 或 gpt-4o-mini）
- systemPrompt 必须包含：
  1. 使用 python_execute 运行 os.listdir() 或 glob 检查工作区中是否存在目标文件类型
  2. 检查文件大小是否大于 0
  3. 如果文件不存在或为空，输出明确的失败信息（如 JSON {"passed": false, "reason": "未检测到 .pptx 文件"}）
  4. 如果文件存在且有效，输出通过信息并列出文件路径和大小

### 使用模式

**单文件生成**（无审核需求）：
\`\`\`
Input → 文件生成 agent → 文件验证 agent → Condition ──true→ Output
                                              └──false→ 文件生成 agent（回线重试）
\`\`\`
验证不通过时回线到文件生成 agent 重新生成，condition 设置 maxLoopIterations: 3。

**有审核需求**：
\`\`\`
Input → 文件生成 agent → 文件验证 agent → Condition ──true→ 审核 agent → Condition2 → Output / 回线
                                              └──false→ 文件生成 agent（回线重试）
\`\`\`
文件验证通过后再交给审核 agent 进行内容质量评审。

**并行多文件**：
每个文件生成 agent 后都要有各自的文件验证 agent，验证通过后再 merge 汇聚。

### 注意
- 文件验证 agent 不是审核/评审 agent，它只检查文件存在性和有效性，不评审内容质量
- 知识指导型 skill（不涉及文件产出）不需要文件验证节点
- 文件验证的 condition 节点的 conditionValue 写："文件验证通过" 或 "passed 为 true"

## 审核/评审 Agent 规则

当 flow 中包含审核/评审 agent，且其上游 agent 配备了**文件产出型 skill** 时：
1. 其 systemPrompt 必须要求**先验证上游是否有实际产出物**（文件路径、文件内容），而不是仅评审文字描述
2. 如果上游应该生成文件但没有生成，审核 agent 必须直接判定不通过
3. 审核 agent 的 enabledTools 应包含 "python_execute"，以便验证文件存在性和内容

示例（PPT 审核 agent 的 systemPrompt 必须包含类似内容）：
"首先检查工作区中是否存在 .pptx 文件。如果不存在，直接判定不通过并在 issues 中说明'未检测到实际 PPT 文件'。只有文件存在时，才进行内容和质量评审。"

当上游 agent 只配备了知识指导型 skill（不涉及文件产出）时，审核 agent 不需要检查文件，正常评审文本输出即可。

## 输出格式

直接输出完整 JSON，不要任何解释或 markdown 代码块：
{
  "name": "流程名称",
  "nodes": [...],
  "edges": [...]
}`

/* ── LLM call with tool support ──────────────────────────────── */

interface ToolCall {
  id: string
  name: string
  arguments: string
}

interface LLMResponse {
  content: string
  toolCalls: ToolCall[]
  stopReason: string
}

async function callLLM(
  provider: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  enableTools: boolean,
): Promise<LLMResponse> {
  const toolDefs = enableTools ? getToolDefinitions(provider) : undefined

  switch (provider) {
    case 'deepseek': {
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature: 0.7,
      }
      if (toolDefs) body.tools = toolDefs
      // Only use json_object format when no tools (final generation)
      if (!enableTools) body.response_format = { type: 'json_object' }

      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`)
      const data = await res.json()
      const msg = data.choices[0].message
      return {
        content: msg.content || '',
        toolCalls: (msg.tool_calls || []).map((tc: { id: string; function: { name: string; arguments: string } }) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        })),
        stopReason: data.choices[0].finish_reason,
      }
    }

    case 'anthropic': {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic({ apiKey })
      const params: Record<string, unknown> = {
        model,
        max_tokens: 8192,
        messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      }
      if (toolDefs) params.tools = toolDefs

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.messages.create(params as any)
      let text = ''
      const tools: ToolCall[] = []
      for (const block of response.content) {
        if (block.type === 'text') text += block.text
        if (block.type === 'tool_use') {
          tools.push({ id: block.id, name: block.name, arguments: JSON.stringify(block.input) })
        }
      }
      return { content: text, toolCalls: tools, stopReason: response.stop_reason || 'end_turn' }
    }

    case 'openai': {
      const OpenAI = (await import('openai')).default
      const client = new OpenAI({ apiKey })
      const params: Record<string, unknown> = {
        model,
        messages,
        temperature: 0.7,
      }
      if (toolDefs) params.tools = toolDefs
      if (!enableTools) params.response_format = { type: 'json_object' }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completion = await client.chat.completions.create(params as any)
      const msg = completion.choices[0].message
      return {
        content: msg.content || '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolCalls: (msg.tool_calls || []).map((tc: any) => ({
          id: tc.id,
          name: tc.function?.name || tc.name || '',
          arguments: tc.function?.arguments || JSON.stringify(tc.input || {}),
        })),
        stopReason: completion.choices[0].finish_reason || 'stop',
      }
    }

    case 'google': {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const genModel = genAI.getGenerativeModel({
        model,
        generationConfig: enableTools ? {} : { responseMimeType: 'application/json' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: toolDefs ? [{ functionDeclarations: toolDefs }] as any : undefined,
      })
      // Gemini uses a different message format — flatten to single prompt for simplicity
      const combined = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
      const result = await genModel.generateContent(combined)
      const response = result.response
      const text = response.text()
      const calls = response.functionCalls() || []
      return {
        content: text,
        toolCalls: calls.map((fc, i) => ({ id: `call-${i}`, name: fc.name, arguments: JSON.stringify(fc.args) })),
        stopReason: 'stop',
      }
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

function getToolDefinitions(provider: string): unknown[] {
  const webSearchSchema = {
    type: 'object' as const,
    properties: {
      query: { type: 'string' as const, description: 'The search query' },
    },
    required: ['query'],
  }

  if (provider === 'anthropic') {
    return [{
      name: 'web_search',
      description: 'Search the web for information about workflow best practices and examples',
      input_schema: webSearchSchema,
    }]
  }

  if (provider === 'google') {
    return [{
      name: 'web_search',
      description: 'Search the web for information about workflow best practices and examples',
      parameters: webSearchSchema,
    }]
  }

  // OpenAI / DeepSeek format
  return [{
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information about workflow best practices and examples',
      parameters: webSearchSchema,
    },
  }]
}

/* ── Agent loop ──────────────────────────────────────────────── */

type Complexity = 'standard' | 'professional'

interface ExistingFlow {
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string }>
}

const REVIEW_KEYWORDS = /审核|审查|评审|质检|把关|校验|验证|review|quality.*check|iterate|迭代优化|质量把控/i

function buildUserMessage(description: string, existing?: ExistingFlow, searchResults?: string): string {
  let msg = ''

  if (searchResults) {
    msg += `## 调研结果\n\n以下是关于这类工作流的最佳实践调研结果：\n\n${searchResults}\n\n---\n\n`
  }

  if (existing && existing.nodes.length > 0) {
    msg += `## 当前已有流程\n\n请基于此修改，不要从零开始：\n${JSON.stringify({
      nodes: existing.nodes.map(n => ({ id: n.id, type: n.type, label: n.data?.label, position: n.position })),
      edges: existing.edges.map(e => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
    }, null, 2)}\n\n## 用户想要的改动\n\n${description}\n\n请输出修改后的完整流程。`
  } else {
    msg += `## 用户需求\n\n${description}`
  }

  // Auto-detect patterns and add hints
  if (REVIEW_KEYWORDS.test(description)) {
    msg += `\n\n## ⚠ 强制要求：质量门控循环

用户需求明确包含"审核/质检"要求，你**必须**生成以下结构：

\`\`\`
Input → 执行者(agent) → 质检员(agent) → Condition → Output (true) / 回线到执行者 (false)
\`\`\`

具体要求：
1. 必须有一个 condition 节点
2. condition 的 false 出线必须连回执行者 agent（形成循环）
3. condition 的 true 出线连到 Output
4. 质检员 agent 输出结构化评估
5. condition 设置 maxLoopIterations: 3

**禁止**将审核简化为线性流水线。这是硬性规定。`
  }

  return msg
}

async function loadEnabledSkills(enabledSkills: string[]): Promise<string> {
  const contents = await Promise.all(
    enabledSkills.map(async (name) => {
      const skillPath = path.join(process.cwd(), 'skills', name, 'SKILL.md')
      try {
        return await fs.readFile(skillPath, 'utf-8')
      } catch {
        return ''
      }
    })
  )
  return contents.filter(Boolean).join('\n\n---\n\n')
}

async function resolveSystemPrompt(): Promise<string> {
  // SYSTEM_PROMPT already contains all core rules (structure, node types, layout, loop pattern).
  // Only load reference files (patterns, templates) for extra context — skip SKILL.md itself to avoid duplication.
  let prompt = SYSTEM_PROMPT

  try {
    const refsDir = path.join(process.cwd(), 'skills', 'flow-design', 'references')
    const refFiles = ['patterns.md', 'templates.md']
    const refContents = await Promise.all(
      refFiles.map(async (f) => {
        try { return await fs.readFile(path.join(refsDir, f), 'utf-8') } catch { return '' }
      })
    )
    const refs = refContents.filter(Boolean).join('\n\n---\n\n')
    if (refs) {
      prompt = `${prompt}\n\n---\n\n## 参考资料\n\n${refs}`
    }
  } catch { /* no references available */ }

  // Inject ALL installed skills with profile info so the AI can make informed decisions
  const { skills } = await readSkillRegistry().catch(() => ({ skills: [] as import('@/types/registry').SkillEntry[] }))
  if (skills.length > 0) {
    const skillList = skills
      .map(s => {
        let line = `- **${s.name}**: ${s.description || '(no description)'}`
        if (s.profile) {
          const p = s.profile
          const parts: string[] = []
          if (p.tags.length > 0) parts.push(`类型: ${p.tags.join(', ')}`)
          if (p.outputFileTypes?.length) parts.push(`产出: ${p.outputFileTypes.join(', ')}`)
          if (p.requiredTools?.length) parts.push(`需要工具: ${p.requiredTools.join(', ')}`)
          if (p.recommendedModels?.length) parts.push(`推荐模型能力: ${p.recommendedModels.join(', ')}`)
          if (p.dependencies?.length) parts.push(`依赖: ${p.dependencies.join(', ')}`)
          if (parts.length > 0) line += ` [${parts.join(' | ')}]`
        }
        return line
      })
      .join('\n')
    prompt = prompt.replace('{{AVAILABLE_SKILLS}}', skillList)
  } else {
    prompt = prompt.replace('{{AVAILABLE_SKILLS}}', '当前没有已安装的 skill。')
  }

  // Inject model capability catalog
  prompt = prompt.replace('{{MODEL_CATALOG}}', buildModelCatalogText())

  return prompt
}

async function runAgentLoop(
  provider: string,
  apiKey: string,
  model: string,
  description: string,
  complexity: Complexity,
  existing?: ExistingFlow,
  enableWebSearch = true,
): Promise<string> {
  const settings = await readSettings()
  const searchEnabled = enableWebSearch && (settings.generateEnableWebSearch !== false)
  const sysPrompt = await resolveSystemPrompt()

  // Fallback: single LLM call when search is disabled
  if (!searchEnabled) {
    const result = await callLLM(provider, apiKey, model,
      provider === 'anthropic'
        ? [{ role: 'user', content: sysPrompt + '\n\n---\n\n' + buildUserMessage(description, existing) }]
        : [{ role: 'system', content: sysPrompt }, { role: 'user', content: buildUserMessage(description, existing) }],
      false,
    )
    return result.content
  }

  // Standard / Professional mode: search first, then generate
  const searchCount = complexity === 'professional' ? 5 : 2
  const allSearchResults: string[] = []

  // Generate search queries
  const queryPrompt = `Based on this user request, generate ${searchCount} search queries to research best practices for building this kind of workflow. Return ONLY a JSON array of strings, no other text.

User request: ${description}`

  const queryResult = await callLLM(provider, apiKey, model,
    provider === 'anthropic'
      ? [{ role: 'user', content: queryPrompt }]
      : [{ role: 'system', content: 'You generate search queries. Return only a JSON array of strings.' }, { role: 'user', content: queryPrompt }],
    false,
  )

  let queries: string[] = []
  try {
    const parsed = JSON.parse(queryResult.content.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
    queries = Array.isArray(parsed) ? parsed.slice(0, searchCount) : []
  } catch {
    // Fallback queries
    queries = [
      `${description} workflow best practices`,
      `${description} AI agent automation examples`,
    ]
  }

  // Execute searches
  for (const q of queries) {
    const result = await executeWebSearch(q)
    if (result && !result.includes('unavailable')) {
      allSearchResults.push(`### 搜索: "${q}"\n\n${result}`)
    }
  }

  const searchContext = allSearchResults.length > 0
    ? allSearchResults.join('\n\n---\n\n')
    : undefined

  // Professional mode: two-pass — framework first, then detailed
  if (complexity === 'professional') {
    // Pass 1: Generate framework
    const frameworkPrompt = `${sysPrompt}

重要：这是第一轮，请先输出一个工作流框架设计（不需要完整 JSON），包含：
1. 需要哪些 Agent，各自职责
2. 执行顺序和并行关系
3. 是否需要 Condition 节点
4. 每个 Agent 应该用什么工具

用纯文本描述即可。`

    const frameworkResult = await callLLM(provider, apiKey, model,
      provider === 'anthropic'
        ? [{ role: 'user', content: frameworkPrompt + '\n\n---\n\n' + buildUserMessage(description, existing, searchContext) }]
        : [{ role: 'system', content: frameworkPrompt }, { role: 'user', content: buildUserMessage(description, existing, searchContext) }],
      false,
    )

    // Pass 2: Generate detailed flow from framework
    const detailPrompt = buildUserMessage(description, existing, searchContext)
      + `\n\n## 框架设计（上一轮思考结果）\n\n${frameworkResult.content}\n\n请基于以上框架，生成完整的 flow JSON。`

    const finalResult = await callLLM(provider, apiKey, model,
      provider === 'anthropic'
        ? [{ role: 'user', content: sysPrompt + '\n\n---\n\n' + detailPrompt }]
        : [{ role: 'system', content: sysPrompt }, { role: 'user', content: detailPrompt }],
      false,
    )

    // Pass 3: Self-review
    const reviewPrompt = `你是一个工作流质量审核员。请检查以下生成的 flow JSON：

${finalResult.content}

检查项：
1. 每个 agent 的 systemPrompt 是否足够详细（至少 150 字）？
2. enabledTools 是否与职责匹配？
3. completionCriteria 是否具体？
4. 布局是否合理（无重叠）？
5. 连线是否正确（condition 的 edge 有 sourceHandle）？
6. 配备了文件产出型 skill（如 pptx、algorithmic-art）的 agent，其 systemPrompt 是否强制要求实际调用工具生成文件？enabledTools 是否包含 python_execute？（知识指导型 skill 不需要此检查）
7. 每个文件产出型 skill agent 后面是否紧跟一个文件验证 agent + condition 节点？文件验证 agent 是否用 python_execute 检查文件存在性？验证不通过的 condition false 出线是否回连到文件生成 agent？
8. 审核类 agent 位于文件产出型 skill agent 下游时，是否要求先检查上游实际产出物（文件）的存在性？
9. 模型选择是否正确：需要 multimodal 的节点是否用了支持多模态的模型？需要工具调用的节点是否用了支持 tool_calling 的模型？

如果发现问题，直接输出修正后的完整 JSON。如果没问题，原样输出 JSON。
只输出 JSON，不要其他内容。`

    const reviewResult = await callLLM(provider, apiKey, model,
      provider === 'anthropic'
        ? [{ role: 'user', content: reviewPrompt }]
        : [{ role: 'system', content: '你是质量审核员，输出修正后的 JSON 或原样输出。' }, { role: 'user', content: reviewPrompt }],
      false,
    )

    return reviewResult.content
  }

  // Standard mode: single generation with search context
  const finalResult = await callLLM(provider, apiKey, model,
    provider === 'anthropic'
      ? [{ role: 'user', content: sysPrompt + '\n\n---\n\n' + buildUserMessage(description, existing, searchContext) }]
      : [{ role: 'system', content: sysPrompt }, { role: 'user', content: buildUserMessage(description, existing, searchContext) }],
    false,
  )

  return finalResult.content
}

/* ── Normalize helpers (shared by SSE emitter) ──────────────── */

type ParsedFlow = {
  name?: string
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; type?: string }>
}

const HANDLE_MAP: Record<string, string> = {
  'condition-true': 'true-handle',
  'condition-false': 'false-handle',
}

function normalizeNode(n: ParsedFlow['nodes'][number], i: number) {
  if (n.type === 'input') n.type = 'io'
  const col = n.type === 'io' ? 0 : n.type === 'output' ? 4 : Math.min(i, 3)
  const position = n.position && typeof n.position.x === 'number'
    ? n.position
    : { x: 100 + col * 300, y: 100 + (i % 4) * 160 }
  const raw = n as Record<string, unknown>
  const data = (n.data && typeof n.data === 'object')
    ? n.data
    : {
        label: raw.label || `${n.type} node`,
        ...(raw.definition && typeof raw.definition === 'object' ? raw.definition as Record<string, unknown> : {}),
      }
  if (!data.label && raw.label) data.label = raw.label
  return { id: n.id, type: n.type, position, data }
}

function normalizeEdge(e: ParsedFlow['edges'][number], i: number) {
  return {
    ...e,
    id: e.id || `e${i + 1}`,
    type: 'custom',
    ...(e.sourceHandle && HANDLE_MAP[e.sourceHandle]
      ? { sourceHandle: HANDLE_MAP[e.sourceHandle] }
      : {}),
  }
}

/* ── Route handler (SSE streaming) ──────────────────────────── */

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { description, flowId: existingFlowId, complexity = 'standard' } = body as {
      description: string
      flowId?: string
      complexity?: Complexity
    }

    if (!description?.trim()) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }

    const resolved = await pickProvider()
    if (!resolved) {
      return NextResponse.json(
        { error: 'No API key configured. Please add an API key in Settings.' },
        { status: 400 },
      )
    }

    let existing: ExistingFlow | undefined
    if (existingFlowId) {
      const flowData = await readFlow(existingFlowId)
      if (flowData && flowData.nodes.length > 0) {
        existing = { nodes: flowData.nodes as ExistingFlow['nodes'], edges: flowData.edges as ExistingFlow['edges'] }
      }
    }

    const { provider, apiKey, model } = resolved
    const flowId = existingFlowId || `flow-${Date.now()}`

    // Create a ReadableStream that pushes SSE events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          // Signal thinking phase
          send('status', { phase: 'thinking' })

          const raw = await runAgentLoop(provider, apiKey, model, description.trim(), complexity, existing)

          // Signal generating phase (parsing done, about to emit nodes)
          send('status', { phase: 'generating' })

          let cleaned = raw.trim()
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
          }

          const result = JSON.parse(cleaned) as ParsedFlow
          if (!result.nodes || !result.edges) {
            send('error', { message: 'Invalid AI response: missing nodes or edges' })
            controller.close()
            return
          }

          const flowName = result.name || 'AI Generated Flow'
          const normalizedNodes = result.nodes.map(normalizeNode)
          const normalizedEdges = result.edges.map(normalizeEdge)

          // Validate: must have at least one agent node
          const hasAgent = normalizedNodes.some(n => n.type === 'agent')
          if (!hasAgent) {
            send('error', { message: 'Generated flow has no agent nodes. Please try again with a more specific description.' })
            controller.close()
            return
          }

          // Send meta info
          send('meta', { flowId, name: flowName })

          // Emit nodes one by one with stagger delay
          const NODE_DELAY = 180 // ms between nodes
          for (let i = 0; i < normalizedNodes.length; i++) {
            send('node', normalizedNodes[i])
            if (i < normalizedNodes.length - 1) {
              await new Promise(r => setTimeout(r, NODE_DELAY))
            }
          }

          // Brief pause before edges
          await new Promise(r => setTimeout(r, 120))

          // Emit edges one by one
          const EDGE_DELAY = 100
          for (let i = 0; i < normalizedEdges.length; i++) {
            send('edge', normalizedEdges[i])
            if (i < normalizedEdges.length - 1) {
              await new Promise(r => setTimeout(r, EDGE_DELAY))
            }
          }

          // Save the full flow to disk
          await writeFlow(flowId, {
            name: flowName,
            nodes: normalizedNodes,
            edges: normalizedEdges,
          })

          send('done', { flowId, name: flowName, nodeCount: normalizedNodes.length })
        } catch (err) {
          console.error('[flow/generate SSE]', err)
          send('error', { message: err instanceof Error ? err.message : 'Failed to generate flow' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[flow/generate POST]', err)
    const message = err instanceof Error ? err.message : 'Failed to generate flow'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
