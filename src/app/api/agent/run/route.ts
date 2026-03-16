import { NextRequest } from 'next/server'
import { runAgent, buildSystemPromptWithSkills } from '@/lib/agent-runner'
import { createTools } from '@/lib/tools'
import { createSkills } from '@/lib/skills'
import { readSkillRegistry } from '@/lib/registry-manager'
import type { ToolName } from '@/lib/tools'
import type { SkillName } from '@/lib/skills'
import type { AgentConfig, StreamEvent } from '@/types/agent'

function toSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

async function getModelApiKey(provider: string): Promise<string> {
  // Settings page saves keys to settings.json; env vars are the fallback
  const { readSettings } = await import('@/lib/settings-storage')
  const settings = await readSettings()
  switch (provider) {
    case 'anthropic': return settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || ''
    case 'deepseek':  return settings.deepseekApiKey  || process.env.DEEPSEEK_API_KEY  || ''
    case 'openai':    return settings.openaiApiKey    || process.env.OPENAI_API_KEY    || ''
    default:          return ''
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    config: Omit<AgentConfig, 'tools'>
    goal: string
    enabledTools: ToolName[]
    enabledSkills: SkillName[]
    inputImages?: Array<{ base64: string; mimeType: string; name: string }>
  }

  const apiKey = await getModelApiKey(body.config.model.provider)

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: `Missing API key for provider: ${body.config.model.provider}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 从文件系统读取 skill 注册表，构建包含启用 skills 的 system prompt
  const { skills } = await readSkillRegistry().catch(() => ({ skills: [] }))
  const systemPrompt = await buildSystemPromptWithSkills(body.config.systemPrompt, skills)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(toSSE(event)))
      }

      const tools = await createTools(
        body.enabledTools,
        { tavily: process.env.NEXT_PUBLIC_TAVILY_KEY ?? '' }
      )

      const skillTools = createSkills(
        body.enabledSkills,
        { ...body.config.model, apiKey },
        (skillName, step) => send({
          type: 'step',
          data: { ...step, content: `[${skillName}] ${step.content}` },
        })
      )

      const config: AgentConfig = {
        ...body.config,
        systemPrompt,
        model: { ...body.config.model, apiKey },
        tools: [...tools, ...skillTools],
      }

      try {
        const result = await runAgent({
          config,
          goal: body.goal,
          inputImages: body.inputImages,
          onStep:  (step)  => send({ type: 'step',  data: step }),
          onToken: (token) => send({ type: 'token', data: token }),
        })
        send({ type: 'done', data: result.finalOutput })
      } catch (err) {
        send({
          type: 'error',
          data: err instanceof Error ? err.message : 'Unknown error',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
