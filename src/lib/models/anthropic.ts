import Anthropic from '@anthropic-ai/sdk'
import type { ModelConfig } from '@/types/model'
import type { Tool } from '@/types/tool'
import type { AgentStep, RunResult, TokenUsage } from '@/types/agent'
import { SERVER_TOOLS, executeServerTool, type InputImage } from '@/lib/agent-runner'
import { stripThinkTags } from '@/lib/strip-think-tags'

function toAnthropicTools(tools: Tool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.definition.name,
    description: t.definition.description,
    input_schema: t.definition.inputSchema as Anthropic.Tool['input_schema'],
  }))
}

export async function runWithAnthropic(
  config: ModelConfig,
  systemPrompt: string,
  goal: string,
  tools: Tool[],
  maxIterations: number,
  onStep: (step: AgentStep) => void,
  onToken?: (token: string) => void,
  history?: { role: 'user' | 'assistant', content: string }[],
  inputImages?: InputImage[],
  workspaceCwd?: string
): Promise<RunResult> {
  const client = new Anthropic({ apiKey: config.apiKey })

  let firstUserContent: Anthropic.MessageParam['content']
  if (inputImages && inputImages.length > 0) {
    const content: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [{ type: 'text', text: goal }]
    for (const img of inputImages) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } })
    }
    firstUserContent = content as Anthropic.MessageParam['content']
  } else {
    firstUserContent = goal
  }

  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []),
    { role: 'user', content: firstUserContent },
  ]
  const steps: AgentStep[] = []
  let finalOutput = ''
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }

  for (let i = 0; i < (maxIterations || 10); i++) {
    // Inject iteration awareness
    const total = maxIterations || 10
    const remaining = total - i - 1
    if (i > 0) {
      const iterMsg = remaining <= 1
        ? `[Iteration ${i + 1}/${total} — FINAL iteration. You MUST output your conclusion/summary now. Do NOT call any more tools.]`
        : remaining <= 2
          ? `[Iteration ${i + 1}/${total} — ${remaining} remaining. Start wrapping up. Complete your current task and prepare a summary.]`
          : `[Iteration ${i + 1}/${total} — ${remaining} remaining.]`
      messages.push({ role: 'user' as const, content: iterMsg })
    }

    let fullText = ''
    let toolName = ''
    let toolId = ''
    let toolInputRaw = ''
    let stopReason = ''

    // 用 stream 模式
    const stream = await client.messages.stream({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: toAnthropicTools(tools),
      messages,
      temperature: config.temperature ?? 0.7,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text
          onToken?.(event.delta.text)   // 逐字推出去
        }
        if (event.delta.type === 'input_json_delta') {
          toolInputRaw += event.delta.partial_json
        }
      }
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          toolName = event.content_block.name
          toolId   = event.content_block.id
        }
      }
      if (event.type === 'message_delta') {
        stopReason = event.delta.stop_reason ?? ''
        if (event.usage) {
          usage.outputTokens += event.usage.output_tokens || 0
        }
      }
      if (event.type === 'message_start' && event.message?.usage) {
        usage.inputTokens += event.message.usage.input_tokens || 0
      }
    }

    // Think 步骤
    if (fullText) {
      const step: AgentStep = {
        id: crypto.randomUUID(),
        type: 'thinking',
        content: fullText,
        timestamp: Date.now(),
      }
      steps.push(step)
      onStep(step)
    }

    // Capture text from each iteration so max_iterations still has output
    if (fullText) {
      const { cleaned } = stripThinkTags(fullText)
      finalOutput = cleaned
    }

    // 任务完成
    if (stopReason === 'end_turn') {
      const doneStep: AgentStep = {
        id: crypto.randomUUID(),
        type: 'done',
        content: finalOutput,
        timestamp: Date.now(),
      }
      steps.push(doneStep)
      onStep(doneStep)
      return { steps, stopReason: 'done', finalOutput, usage }
    }

    // 需要调用工具
    if (stopReason === 'tool_use' && toolName) {
      let toolInput: Record<string, unknown> = {}
      try { toolInput = JSON.parse(toolInputRaw) } catch { /* ignore */ }

      const callStep: AgentStep = {
        id: crypto.randomUUID(),
        type: 'tool_call',
        content: JSON.stringify(toolInput, null, 2),
        toolName,
        toolInput,
        timestamp: Date.now(),
      }
      steps.push(callStep)
      onStep(callStep)

      const tool = tools.find((t) => t.definition.name === toolName)
      let toolResult: string
      try {
        if (SERVER_TOOLS.includes(toolName)) {
          toolResult = await executeServerTool(toolName, toolInput, workspaceCwd)
        } else if (tool) {
          toolResult = await tool.execute(toolInput)
        } else {
          toolResult = `Tool "${toolName}" not found`
        }
      } catch (err) {
        toolResult = `Error: ${err instanceof Error ? err.message : 'unknown error'}`
      }

      const resultStep: AgentStep = {
        id: crypto.randomUUID(),
        type: 'tool_result',
        content: toolResult,
        toolName,
        timestamp: Date.now(),
      }
      steps.push(resultStep)
      onStep(resultStep)

      // 重建完整的 assistant message
      const assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = []
      if (fullText) assistantContent.push({ type: 'text', text: fullText })
      assistantContent.push({
        type: 'tool_use',
        id: toolId,
        name: toolName,
        input: toolInput,
      })

      messages.push({ role: 'assistant', content: assistantContent })
      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolId,
          content: toolResult,
        }],
      })
    }
  }

  return { steps, stopReason: 'max_iterations', finalOutput, usage }
}