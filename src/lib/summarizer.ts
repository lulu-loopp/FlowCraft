import type { ModelConfig } from '@/types/model'

export async function summarizeMessages(
  messages: { role: string; content: string }[],
  modelConfig: ModelConfig
): Promise<string> {
  const formatted = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  const prompt = `将以下对话压缩成简洁摘要，保留关键信息和结论：\n\n${formatted}`

  if (modelConfig.provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: modelConfig.apiKey })
    const response = await client.messages.create({
      model: modelConfig.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content.find((b) => b.type === 'text')
    return block?.type === 'text' ? block.text : ''
  }

  // openai / deepseek
  const OpenAI = (await import('openai')).default
  const baseURLMap: Partial<Record<string, string>> = {
    deepseek: 'https://api.deepseek.com',
  }
  const client = new OpenAI({
    apiKey: modelConfig.apiKey,
    baseURL: baseURLMap[modelConfig.provider],
  })
  const response = await client.chat.completions.create({
    model: modelConfig.model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1024,
  })
  return response.choices[0]?.message.content ?? ''
}
