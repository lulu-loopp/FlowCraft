import { NextResponse } from 'next/server'
import { generateImage, type ImageModel } from '@/lib/tools/image-generate'
import { readToolApiKeys } from '@/lib/tool-api-keys'
import { readSettings } from '@/lib/settings-storage'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { prompt, model, size } = body as {
      prompt?: string
      model?: ImageModel
      size?: string
    }

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    const toolKeys = await readToolApiKeys()
    const settings = await readSettings()
    const selectedModel = model ?? (settings.defaultImageModel as ImageModel) ?? 'nano-banana-2'

    const result = await generateImage({
      prompt,
      model: selectedModel,
      size,
      apiKeys: {
        google: toolKeys.google,
        openai: toolKeys.openai,
        replicate: toolKeys.replicate,
      },
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[image-generate]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
