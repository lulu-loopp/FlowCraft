import { NextResponse } from 'next/server'
import { resolveProviderApiKey } from '@/lib/resolve-api-key'

interface DescribeImageRequest {
  images: { base64: string; mimeType: string; name?: string }[]
}

/** Multimodal providers ordered by cost (cheapest first) */
const MULTIMODAL_PROVIDERS = [
  { provider: 'google', model: 'gemini-2.5-flash-lite' },
  { provider: 'openai', model: 'gpt-4.1-nano' },
  { provider: 'openai', model: 'gpt-4o-mini' },
  { provider: 'anthropic', model: 'claude-haiku-4-5' },
] as const

const DESCRIBE_PROMPT =
  'Describe this image concisely in 2-3 sentences. Focus on the key visual content, text, data, or information shown. Be factual and specific.'

async function describeWithGoogle(
  apiKey: string,
  model: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const m = genAI.getGenerativeModel({ model })
  const result = await m.generateContent([
    DESCRIBE_PROMPT,
    { inlineData: { mimeType, data: base64 } },
  ])
  return result.response.text()
}

async function describeWithOpenAI(
  apiKey: string,
  model: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const resp = await client.chat.completions.create({
    model,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: DESCRIBE_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
  })
  return resp.choices[0]?.message?.content || ''
}

async function describeWithAnthropic(
  apiKey: string,
  model: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const resp = await client.messages.create({
    model,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          },
          { type: 'text', text: DESCRIBE_PROMPT },
        ],
      },
    ],
  })
  const block = resp.content[0]
  return block.type === 'text' ? block.text : ''
}

/**
 * POST /api/describe-image
 * Describes images using the cheapest available multimodal model.
 * Used to provide text descriptions when the target agent model doesn't support multimodal.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DescribeImageRequest
    const { images } = body

    if (!images || images.length === 0) {
      return NextResponse.json({ descriptions: [] })
    }

    // Find the first available multimodal provider
    let chosenProvider: (typeof MULTIMODAL_PROVIDERS)[number] | null = null
    let apiKey = ''
    for (const candidate of MULTIMODAL_PROVIDERS) {
      const key = await resolveProviderApiKey(candidate.provider)
      if (key) {
        chosenProvider = candidate
        apiKey = key
        break
      }
    }

    if (!chosenProvider) {
      return NextResponse.json(
        { error: 'No multimodal provider API key available for image description' },
        { status: 400 },
      )
    }

    // Describe each image
    const descriptions: string[] = []
    for (const img of images) {
      try {
        let desc: string
        switch (chosenProvider.provider) {
          case 'google':
            desc = await describeWithGoogle(apiKey, chosenProvider.model, img.base64, img.mimeType)
            break
          case 'openai':
            desc = await describeWithOpenAI(apiKey, chosenProvider.model, img.base64, img.mimeType)
            break
          case 'anthropic':
            desc = await describeWithAnthropic(apiKey, chosenProvider.model, img.base64, img.mimeType)
            break
          default:
            desc = '(Could not describe image)'
        }
        const label = img.name ? `[Image: ${img.name}]` : '[Image]'
        descriptions.push(`${label} ${desc.trim()}`)
      } catch (err) {
        const label = img.name ? `[Image: ${img.name}]` : '[Image]'
        descriptions.push(`${label} (Failed to describe: ${err instanceof Error ? err.message : 'unknown error'})`)
      }
    }

    return NextResponse.json({ descriptions })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to describe images' },
      { status: 500 },
    )
  }
}
