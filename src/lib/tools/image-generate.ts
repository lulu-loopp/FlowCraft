/**
 * 图片生成 tool — 支持 Google (Nano Banana / Imagen 3)、OpenAI (DALL-E 3)、Replicate (SD / Flux)
 */

import fs from 'fs/promises'
import path from 'path'
import type { Tool } from '@/types/tool'
import { IMAGE_MODEL_PROVIDER, type ImageProvider } from './definitions'

export type ImageModel =
  | 'nano-banana'
  | 'nano-banana-2'
  | 'nano-banana-pro'
  | 'imagen-3'
  | 'dall-e-3'
  | 'stable-diffusion'
  | 'flux'

export interface ImageGenerateResult {
  url: string
  prompt: string
  model: string
}

export { IMAGE_MODEL_PROVIDER, type ImageProvider }

/** 模型 → 实际 API 模型 ID */
export const IMAGE_MODEL_ID: Record<ImageModel, string> = {
  'nano-banana':     'gemini-2.5-flash-image',
  'nano-banana-2':   'gemini-3.1-flash-image-preview',
  'nano-banana-pro': 'gemini-3-pro-image-preview',
  'imagen-3':        'imagen-3.0-generate-002',
  'dall-e-3':        'dall-e-3',
  'stable-diffusion': 'stability-ai/sdxl',
  'flux':            'black-forest-labs/flux-schnell',
}

/** 需要哪个 API key */
export const IMAGE_MODEL_KEY_FIELD: Record<ImageProvider, string> = {
  google:    'google',
  openai:    'openai',
  replicate: 'replicate',
}

// ─── Provider 调用实现 ───────────────────────────────

async function generateWithNanaBanana(
  apiKey: string,
  model: ImageModel,
  prompt: string,
): Promise<ImageGenerateResult> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const modelId = IMAGE_MODEL_ID[model]
  const genModel = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      // @ts-expect-error — responseModalities is valid for image models
      responseModalities: ['TEXT', 'IMAGE'],
    },
  })

  const result = await genModel.generateContent(prompt)
  const response = result.response
  const parts = response.candidates?.[0]?.content?.parts ?? []

  for (const part of parts) {
    if (part.inlineData) {
      const { mimeType, data } = part.inlineData as { mimeType: string; data: string }
      const url = `data:${mimeType};base64,${data}`
      return { url, prompt, model }
    }
  }

  throw new Error('No image generated in response')
}

async function generateWithImagen3(
  apiKey: string,
  prompt: string,
): Promise<ImageGenerateResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1 },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Imagen 3 API error: ${res.status} ${err}`)
  }
  const data = await res.json()
  const b64 = data.predictions?.[0]?.bytesBase64Encoded
  if (!b64) throw new Error('No image in Imagen 3 response')
  return {
    url: `data:image/png;base64,${b64}`,
    prompt,
    model: 'imagen-3',
  }
}

async function generateWithDallE3(
  apiKey: string,
  prompt: string,
  size: string,
): Promise<ImageGenerateResult> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const validSize = (['1024x1024', '1792x1024', '1024x1792'] as const).includes(
    size as '1024x1024' | '1792x1024' | '1024x1792'
  ) ? size as '1024x1024' | '1792x1024' | '1024x1792' : '1024x1024'

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: validSize,
  })
  const imageUrl = response.data?.[0]?.url
  if (!imageUrl) throw new Error('No image in DALL-E 3 response')
  return { url: imageUrl, prompt, model: 'dall-e-3' }
}

async function generateWithReplicate(
  apiKey: string,
  model: ImageModel,
  prompt: string,
): Promise<ImageGenerateResult> {
  const modelVersion = IMAGE_MODEL_ID[model]

  // Start prediction
  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelVersion,
      input: { prompt },
    }),
  })
  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Replicate API error: ${createRes.status} ${err}`)
  }
  let prediction = await createRes.json()

  // Poll for completion (max 120s)
  const deadline = Date.now() + 120_000
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
    if (Date.now() > deadline) throw new Error('Replicate prediction timed out')
    await new Promise(r => setTimeout(r, 2000))
    const pollRes = await fetch(prediction.urls.get, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    prediction = await pollRes.json()
  }

  if (prediction.status === 'failed') {
    throw new Error(`Replicate prediction failed: ${prediction.error}`)
  }

  const output = prediction.output
  const imageUrl = Array.isArray(output) ? output[0] : output
  if (!imageUrl) throw new Error('No image in Replicate response')
  return { url: imageUrl, prompt, model }
}

// ─── 统一入口 ────────────────────────────────────────

export interface ImageGenerateInput {
  prompt: string
  model?: ImageModel
  size?: string
  apiKeys: { google: string; openai: string; replicate: string }
}

export async function generateImage(input: ImageGenerateInput): Promise<ImageGenerateResult> {
  const model = input.model ?? 'nano-banana-2'
  const provider = IMAGE_MODEL_PROVIDER[model]
  const keyField = IMAGE_MODEL_KEY_FIELD[provider]
  const apiKey = input.apiKeys[keyField as keyof typeof input.apiKeys]

  if (!apiKey) {
    throw new Error(`Missing API key for ${provider}. Configure it in Settings.`)
  }

  switch (model) {
    case 'nano-banana':
    case 'nano-banana-2':
    case 'nano-banana-pro':
      return generateWithNanaBanana(apiKey, model, input.prompt)
    case 'imagen-3':
      return generateWithImagen3(apiKey, input.prompt)
    case 'dall-e-3':
      return generateWithDallE3(apiKey, input.prompt, input.size ?? '1024x1024')
    case 'stable-diffusion':
    case 'flux':
      return generateWithReplicate(apiKey, model, input.prompt)
    default:
      throw new Error(`Unknown image model: ${model}`)
  }
}

// ─── 图片持久化 ──────────────────────────────────────

const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated')

/** 把 data URL 或远程 URL 保存到 public/generated/，返回可访问的 HTTP 路径 */
async function persistImage(result: ImageGenerateResult): Promise<string> {
  await fs.mkdir(GENERATED_DIR, { recursive: true })
  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  if (result.url.startsWith('data:')) {
    const [header, b64] = result.url.split(',', 2)
    const ext = header.includes('png') ? 'png' : header.includes('webp') ? 'webp' : 'jpg'
    const filePath = path.join(GENERATED_DIR, `${id}.${ext}`)
    await fs.writeFile(filePath, Buffer.from(b64, 'base64'))
    return `/generated/${id}.${ext}`
  }

  // Remote URL (DALL-E 3, Replicate) — download and save
  const res = await fetch(result.url)
  const contentType = res.headers.get('content-type') || 'image/png'
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const filePath = path.join(GENERATED_DIR, `${id}.${ext}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(filePath, buffer)
  return `/generated/${id}.${ext}`
}

// ─── Tool 工厂 ───────────────────────────────────────

export function createImageGenerateTool(
  apiKeys: { google: string; openai: string; replicate: string },
  defaultModel?: ImageModel,
): Tool {
  return {
    definition: {
      name: 'image_generate',
      description:
        '根据文字描述生成图片。返回图片 URL。' +
        '适合生成配图、示意图、概念图等。' +
        '使用时请提供详细的英文描述以获得最佳效果。',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: '图片的详细描述（建议使用英文，效果更好）',
          },
          size: {
            type: 'string',
            enum: ['1024x1024', '1792x1024', '1024x1792'],
            description: '图片尺寸，默认 1024x1024',
          },
        },
        required: ['prompt'],
      },
    },
    execute: async (input) => {
      const result = await generateImage({
        prompt: input.prompt as string,
        model: defaultModel,
        size: input.size as string | undefined,
        apiKeys,
      })
      // Save image to public/generated/ and return short URL (avoids token overflow)
      const imageUrl = await persistImage(result)
      return `![${result.prompt}](${imageUrl})\n\nGenerated with model: ${result.model}`
    },
  }
}
