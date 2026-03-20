import { NextResponse } from 'next/server'
import { readSettings } from '@/lib/settings-storage'

/** 返回各 API key 是否已设置（不返回 key 值本身） */
export async function GET() {
  try {
    const settings = await readSettings()
    const has = (v: unknown) => typeof v === 'string' && v.trim().length > 0
    return NextResponse.json({
      anthropic: has(settings.anthropicApiKey) || has(process.env.ANTHROPIC_API_KEY),
      google:    has(settings.googleApiKey)    || has(process.env.GOOGLE_API_KEY),
      openai:    has(settings.openaiApiKey)    || has(process.env.OPENAI_API_KEY),
      deepseek:  has(settings.deepseekApiKey)  || has(process.env.DEEPSEEK_API_KEY),
      minimax:   has(settings.minimaxApiKey)   || has(process.env.MINIMAX_API_KEY),
      replicate: has(settings.replicateApiKey) || has(process.env.REPLICATE_API_KEY),
      tavily:    has(settings.tavilyApiKey)    || has(process.env.TAVILY_API_KEY),
      brave:     has(settings.braveApiKey)     || has(process.env.BRAVE_API_KEY),
    })
  } catch {
    return NextResponse.json({ anthropic: false, google: false, openai: false, deepseek: false, minimax: false, replicate: false, tavily: false, brave: false })
  }
}
