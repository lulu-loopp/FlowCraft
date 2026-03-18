import OpenAI from 'openai'
import type { ModelConfig } from '@/types/model'
import type { Tool } from '@/types/tool'
import type { AgentStep } from '@/types/agent'
import { SERVER_TOOLS, executeServerTool, type InputImage } from '@/lib/agent-runner'

interface RunResult {
  steps: AgentStep[]
  stopReason: 'done' | 'max_iterations'
  finalOutput: string
}

function toOpenAITools(tools: Tool[]): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.definition.name,
      description: t.definition.description,
      parameters: t.definition.inputSchema,
    },
  }))
}

function createClient(config: ModelConfig): OpenAI {
  const baseURLMap: Partial<Record<string, string>> = {
    deepseek: 'https://api.deepseek.com',
  }
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: baseURLMap[config.provider],
  })
}

export async function runWithOpenAI(
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
  const client = createClient(config)

  const firstUserMessage: OpenAI.ChatCompletionUserMessageParam =
    inputImages && inputImages.length > 0
      ? {
          role: 'user',
          content: [
            { type: 'text' as const, text: goal },
            ...inputImages.map(img => ({
              type: 'image_url' as const,
              image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
            })),
          ],
        }
      : { role: 'user', content: goal }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...(history ?? []),
    firstUserMessage,
  ]
  const steps: AgentStep[] = []
  let finalOutput = ''

  for (let i = 0; i < (maxIterations || 10); i++) {
    let fullText = ''
    let finishReason = ''

    // tool call 相关
    const toolCallMap: Record<number, {
      id: string
      name: string
      argumentsRaw: string
    }> = {}

    // streaming 模式
    const stream = await client.chat.completions.create({
      model: config.model,
      tools: tools.length > 0 ? toOpenAITools(tools) : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      messages,
      stream: true,
      temperature: config.temperature ?? 0.7,
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      finishReason = chunk.choices[0]?.finish_reason ?? finishReason

      // 文字 token
      if (delta?.content) {
        fullText += delta.content
        onToken?.(delta.content)   // 逐字推出去
      }

      // tool call delta（OpenAI 的 tool call 也是流式的）
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          if (!toolCallMap[idx]) {
            toolCallMap[idx] = { id: '', name: '', argumentsRaw: '' }
          }
          if (tc.id)                   toolCallMap[idx].id = tc.id
          if (tc.function?.name)       toolCallMap[idx].name = tc.function.name
          if (tc.function?.arguments)  toolCallMap[idx].argumentsRaw += tc.function.arguments
        }
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
    if (finishReason === 'stop') {
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
    if (finishReason === 'tool_calls') {
      const toolCalls = Object.values(toolCallMap)
      const toolResults: OpenAI.ChatCompletionToolMessageParam[] = []

      for (const tc of toolCalls) {
        let toolInput: Record<string, unknown> = {}
        try { toolInput = JSON.parse(tc.argumentsRaw) } catch { /* ignore */ }

        // Act 步骤
        const callStep: AgentStep = {
          id: crypto.randomUUID(),
          type: 'tool_call',
          content: JSON.stringify(toolInput, null, 2),
          toolName: tc.name,
          toolInput,
          timestamp: Date.now(),
        }
        steps.push(callStep)
        onStep(callStep)

        const tool = tools.find((t) => t.definition.name === tc.name)
        let toolResult: string
        try {
          if (SERVER_TOOLS.includes(tc.name)) {
            toolResult = await executeServerTool(tc.name, toolInput)
          } else if (tool) {
            toolResult = await tool.execute(toolInput)
          } else {
            toolResult = `Tool "${tc.name}" not found`
          }
        } catch (err) {
          toolResult = `Error: ${err instanceof Error ? err.message : 'unknown error'}`
        }

        // Observe 步骤
        const resultStep: AgentStep = {
          id: crypto.randomUUID(),
          type: 'tool_result',
          content: toolResult,
          toolName: tc.name,
          timestamp: Date.now(),
        }
        steps.push(resultStep)
        onStep(resultStep)

        toolResults.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResult,
        })
      }

      // 追加到 messages
      messages.push({
        role: 'assistant',
        content: fullText || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: tc.argumentsRaw,
          },
        })),
      })
      messages.push(...toolResults)
    }
  }

  return { steps, stopReason: 'max_iterations', finalOutput }
}