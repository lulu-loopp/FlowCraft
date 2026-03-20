import { GoogleGenerativeAI, type Content, type Part, type FunctionDeclaration, type Tool as GeminiTool } from '@google/generative-ai'
import type { ModelConfig } from '@/types/model'
import type { Tool } from '@/types/tool'
import type { AgentStep, RunResult, TokenUsage } from '@/types/agent'
import { SERVER_TOOLS, executeServerTool, type InputImage } from '@/lib/agent-runner'
import { stripThinkTags } from '@/lib/strip-think-tags'

function toGeminiTools(tools: Tool[]): GeminiTool[] {
  if (tools.length === 0) return []
  const declarations: FunctionDeclaration[] = tools.map((t) => ({
    name: t.definition.name,
    description: t.definition.description,
    parameters: t.definition.inputSchema as FunctionDeclaration['parameters'],
  }))
  return [{ functionDeclarations: declarations }]
}

export async function runWithGoogle(
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
  const genAI = new GoogleGenerativeAI(config.apiKey)
  const model = genAI.getGenerativeModel({
    model: config.model,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: 4096,
    },
    tools: toGeminiTools(tools),
  })

  // Build first user content parts
  const userParts: Part[] = [{ text: goal }]
  if (inputImages && inputImages.length > 0) {
    for (const img of inputImages) {
      userParts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      })
    }
  }

  // Convert history to Gemini format
  const chatHistory: Content[] = (history ?? []).map((h) => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }],
  }))

  const chat = model.startChat({ history: chatHistory })
  const steps: AgentStep[] = []
  let finalOutput = ''
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }

  for (let i = 0; i < (maxIterations || 10); i++) {
    // Inject iteration awareness
    const total = maxIterations || 10
    const remaining = total - i - 1
    let iterPrefix = ''
    if (i > 0) {
      iterPrefix = remaining <= 1
        ? `[Iteration ${i + 1}/${total} — FINAL iteration. You MUST output your conclusion/summary now. Do NOT call any more tools.]\n`
        : remaining <= 2
          ? `[Iteration ${i + 1}/${total} — ${remaining} remaining. Start wrapping up.]\n`
          : `[Iteration ${i + 1}/${total} — ${remaining} remaining.]\n`
    }

    let fullText = ''

    // Stream the response
    const userMsg = i === 0 ? userParts : [{ text: iterPrefix + 'Continue.' }]
    const result = await chat.sendMessageStream(userMsg)

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) {
        fullText += text
        onToken?.(text)
      }
    }

    const response = await result.response
    // Capture usage
    const meta = response.usageMetadata
    if (meta) {
      usage.inputTokens += meta.promptTokenCount || 0
      usage.outputTokens += meta.candidatesTokenCount || 0
    }
    const candidates = response.candidates
    if (!candidates || candidates.length === 0) break

    const parts = candidates[0].content?.parts
    if (!parts || parts.length === 0) break

    // Check for function calls
    const functionCalls = parts.filter((p) => 'functionCall' in p)

    // Think step
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

    if (fullText) {
      const { cleaned } = stripThinkTags(fullText)
      finalOutput = cleaned
    }

    // No tool calls = done
    if (functionCalls.length === 0) {
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

    // Handle tool calls
    const functionResponses: Part[] = []

    for (const part of functionCalls) {
      const fc = (part as { functionCall: { name: string; args: Record<string, unknown> } }).functionCall
      const toolInput = fc.args || {}

      const callStep: AgentStep = {
        id: crypto.randomUUID(),
        type: 'tool_call',
        content: JSON.stringify(toolInput, null, 2),
        toolName: fc.name,
        toolInput,
        timestamp: Date.now(),
      }
      steps.push(callStep)
      onStep(callStep)

      const tool = tools.find((t) => t.definition.name === fc.name)
      let toolResult: string
      try {
        if (SERVER_TOOLS.includes(fc.name)) {
          toolResult = await executeServerTool(fc.name, toolInput, workspaceCwd)
        } else if (tool) {
          toolResult = await tool.execute(toolInput)
        } else {
          toolResult = `Tool "${fc.name}" not found`
        }
      } catch (err) {
        toolResult = `Error: ${err instanceof Error ? err.message : 'unknown error'}`
      }

      const resultStep: AgentStep = {
        id: crypto.randomUUID(),
        type: 'tool_result',
        content: toolResult,
        toolName: fc.name,
        timestamp: Date.now(),
      }
      steps.push(resultStep)
      onStep(resultStep)

      functionResponses.push({
        functionResponse: {
          name: fc.name,
          response: { result: toolResult },
        },
      })
    }

    // Send function responses back — this becomes the next iteration's message
    // We need to send function responses to the chat
    const toolResponseResult = await chat.sendMessageStream(functionResponses)

    let toolResponseText = ''
    for await (const chunk of toolResponseResult.stream) {
      const text = chunk.text()
      if (text) {
        toolResponseText += text
        onToken?.(text)
      }
    }

    const toolResponse = await toolResponseResult.response
    const toolCandidates = toolResponse.candidates
    const hasMoreCalls = toolCandidates?.[0]?.content?.parts?.some((p) => 'functionCall' in p)

    if (toolResponseText) {
      const step: AgentStep = {
        id: crypto.randomUUID(),
        type: 'thinking',
        content: toolResponseText,
        timestamp: Date.now(),
      }
      steps.push(step)
      onStep(step)
    }

    if (!hasMoreCalls) {
      const { cleaned: cleanedToolResponse } = stripThinkTags(toolResponseText)
      const { cleaned: cleanedFullText } = stripThinkTags(fullText)
      finalOutput = cleanedToolResponse || cleanedFullText
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
  }

  return { steps, stopReason: 'max_iterations', finalOutput, usage }
}
