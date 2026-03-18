/**
 * Memory distillation: calls a lightweight model to extract behavioral rules.
 * Three prompts: execution success, user feedback, training chat.
 */

const SUCCESS_PROMPT = `基于这次任务，提炼能改变你未来工作方式的行为准则。
只记录工作方式层面的规则，不记录任务内容本身。
如果没有值得改变行为的收获，输出"无"。
200 字以内。`

const FEEDBACK_PROMPT = `用户刚刚针对你的运行结果给出了反馈。
提炼用户明确表达的改进要求：
- 这次输出哪里不符合用户期望
- 用户希望你下次怎么做得不同
只记录用户明确说出来的要求。
如果没有具体改进要求，输出"无"。
200 字以内。`

export const CHAT_DISTILL_PROMPT = `提炼用户明确表达的偏好和工作要求。
只记录用户明确说出来的要求，不要推测。
如果用户没有明确表达要求，输出"无"。
200 字以内。`

export interface DistillResult {
  content: string
  tag: '成功' | '反思' | '对话'
  /** Which section to write to: 'style' for user feedback, 'experience' for auto */
  targetSection: 'style' | 'experience'
}

export async function callLightModel(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  try {
    const settingsRes = await fetch('/api/settings')
    const settings = settingsRes.ok ? await settingsRes.json() : {}
    const provider = settings.memoryModel?.provider || 'deepseek'
    const model = settings.memoryModel?.model || 'deepseek-chat'

    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          id: 'memory-distiller',
          name: 'Memory Distiller',
          systemPrompt,
          model: { provider, model, apiKey: '' },
          maxIterations: 1,
        },
        history: [],
        message: userMessage,
        enabledTools: [],
        enabledSkills: [],
        enabledSkillNames: [],
      }),
    })
    if (!res.ok || !res.body) return ''

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let result = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value, { stream: true }).split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === 'token') result += event.data
        } catch { /* ignore */ }
      }
    }
    return result.trim()
  } catch {
    return ''
  }
}

/** Distill positive memory after successful execution */
export async function distillExecutionMemory(
  output: string,
  systemPrompt: string,
): Promise<DistillResult | null> {
  const context = `System prompt: ${systemPrompt.slice(0, 300)}\n\nOutput: ${output.slice(0, 500)}`
  const content = await callLightModel(SUCCESS_PROMPT, context)
  if (!content || content === '无') return null
  return { content, tag: '成功', targetSection: 'experience' }
}

/** Distill feedback memory from user's instant feedback on a run result */
export async function distillFeedbackMemory(
  chatHistory: { role: string; content: string }[],
  runOutput: string,
): Promise<DistillResult | null> {
  const historyText = chatHistory
    .map(m => `${m.role === 'user' ? '用户' : 'Agent'}: ${m.content}`)
    .join('\n')
  const context = `运行输出：\n${runOutput.slice(0, 500)}\n\n用户反馈对话：\n${historyText}`
  const content = await callLightModel(FEEDBACK_PROMPT, context)
  if (!content || content === '无') return null
  return { content, tag: '反思', targetSection: 'style' }
}

/** Distill training chat memory → 工作风格 section */
export async function distillChatMemory(
  chatHistory: { role: string; content: string }[],
  existingMemory: string,
): Promise<DistillResult | null> {
  const historyText = chatHistory
    .map(m => `${m.role === 'user' ? '用户' : 'Agent'}: ${m.content}`)
    .join('\n')
  const context = existingMemory
    ? `已有记忆：\n${existingMemory.slice(0, 500)}\n\n对话记录：\n${historyText}`
    : `对话记录：\n${historyText}`
  const content = await callLightModel(CHAT_DISTILL_PROMPT, context)
  if (!content || content === '无') return null
  return { content, tag: '对话', targetSection: 'style' }
}
