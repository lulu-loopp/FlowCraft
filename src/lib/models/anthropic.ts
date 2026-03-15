import Anthropic from '@anthropic-ai/sdk'
import type { ModelConfig } from '@/types/model'
import type { Tool } from '@/types/tool'
import type { AgentStep } from '@/types/agent'
import { SERVER_TOOLS, executeServerTool, type InputImage } from '@/lib/agent-runner'

interface RunResult {
  steps: AgentStep[]
  stopReason: 'done' | 'max_iterations'
  finalOutput: string
}

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
  inputImages?: InputImage[]
): Promise<RunResult> {
  const client = new Anthropic({ apiKey: config.apiKey })

  let firstUserContent: Anthropic.MessageParam['content']
  if (inputImages && inputImages.length > 0) {
    const content: any[] = [{ type: 'text', text: goal }]
    for (const img of inputImages) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } })
    }
    firstUserContent = content
  } else {
    firstUserContent = goal
  }

  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []),
    { role: 'user', content: firstUserContent },
  ]
  const steps: AgentStep[] = []
  let finalOutput = ''

  for (let i = 0; i < maxIterations; i++) {
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

    // 任务完成
    if (stopReason === 'end_turn') {
      finalOutput = fullText
      const doneStep: AgentStep = {
        id: crypto.randomUUID(),
        type: 'done',
        content: finalOutput,
        timestamp: Date.now(),
      }
      steps.push(doneStep)
      onStep(doneStep)
      return { steps, stopReason: 'done', finalOutput }
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
          toolResult = await executeServerTool(toolName, toolInput)
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

  return { steps, stopReason: 'max_iterations', finalOutput }
}