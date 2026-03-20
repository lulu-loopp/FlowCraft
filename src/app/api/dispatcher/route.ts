import { NextResponse } from 'next/server'
import { resolveProviderWithFallback } from '@/lib/resolve-api-key'
import { readSettings } from '@/lib/settings-storage'
import { stripThinkTags } from '@/lib/strip-think-tags'
import { requireMutationAuth } from '@/lib/api-auth'

export async function POST(req: Request) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const body = await req.json() as {
    input: string
    targets: { id: string; label: string; promptSummary: string }[]
    provider?: string
    model?: string
  }

  const { input, targets } = body
  if (!targets || targets.length === 0) {
    return NextResponse.json({ error: 'No targets' }, { status: 400 })
  }

  // Pick provider: explicit > conditionProvider > defaultProvider
  const settings = await readSettings()
  const LIGHT_MODELS: Record<string, string> = {
    anthropic: 'claude-haiku-4-5',
    openai: 'gpt-4.1-nano',
    deepseek: 'deepseek-chat',
    google: 'gemini-2.5-flash-lite',
    minimax: 'MiniMax-M2.7-highspeed',
  }
  const provider = body.provider || settings.conditionProvider || settings.defaultProvider || 'deepseek'
  const model = body.model || settings.conditionModel || LIGHT_MODELS[provider] || 'deepseek-chat'

  const resolved = await resolveProviderWithFallback(provider, model)
  if (!resolved) {
    return NextResponse.json({ error: `Missing API key for provider: ${provider}` }, { status: 400 })
  }

  // Build prompt
  const recipientList = targets.map((t, i) =>
    `${i + 1}. "${t.label}"${t.promptSummary ? ` — ${t.promptSummary}` : ''}`
  ).join('\n')

  const truncatedInput = input.length > 8000 ? input.slice(0, 8000) + '\n...(truncated)' : input

  const prompt = `You are a content dispatcher. Your job is to split/route the input content into separate sections, one for each downstream recipient.

Each recipient is a specialized AI agent. Extract and reorganize the input so each recipient gets ONLY the content relevant to their role. Do not add new information — only redistribute what's in the input.

## Recipients
${recipientList}

## Input Content
${truncatedInput}

## Output Format
Return a JSON object where keys are the recipient names (exactly as listed above) and values are the content strings for each recipient.
Return ONLY the JSON object, no markdown code fences, no explanation.`

  try {
    let rawResponse = ''

    if (resolved.provider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic({ apiKey: resolved.apiKey })
      const msg = await client.messages.create({
        model: resolved.model, max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      rawResponse = (msg.content[0] as { text: string }).text || ''
    } else if (resolved.provider === 'google') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(resolved.apiKey)
      const gModel = genAI.getGenerativeModel({ model: resolved.model })
      const result = await gModel.generateContent(prompt)
      rawResponse = result.response.text() || ''
    } else {
      const OpenAI = (await import('openai')).default
      const baseURLMap: Record<string, string> = { deepseek: 'https://api.deepseek.com', minimax: 'https://api.minimaxi.com/v1' }
      const client = new OpenAI({ apiKey: resolved.apiKey, baseURL: baseURLMap[resolved.provider] })
      const resp = await client.chat.completions.create({
        model: resolved.model,
        messages: [{ role: 'user', content: prompt }],
      })
      rawResponse = resp.choices[0].message.content || ''
    }

    const { cleaned } = stripThinkTags(rawResponse)
    const jsonStr = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(jsonStr) as Record<string, string>

    // Map label-keyed results to node-ID-keyed results
    const result: Record<string, string> = {}
    for (const target of targets) {
      const content = parsed[target.label]
        ?? Object.entries(parsed).find(([k]) => target.label.includes(k) || k.includes(target.label))?.[1]
        ?? input
      result[target.id] = content
    }

    return NextResponse.json({ result })
  } catch (err) {
    return NextResponse.json({
      error: `Dispatch failed: ${err instanceof Error ? err.message : 'unknown'}`,
    }, { status: 500 })
  }
}
