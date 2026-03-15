import { NextRequest } from 'next/server'
import { runAgent, buildSystemPromptWithSkills } from '@/lib/agent-runner'
import { createTools } from '@/lib/tools'
import { createSkills } from '@/lib/skills'
import { readSkillRegistry } from '@/lib/registry-manager'
import type { ToolName } from '@/lib/tools'
import type { SkillName } from '@/lib/skills'
import type { AgentConfig, ChatMessage, StreamEvent } from '@/types/agent'

function toSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

function getModelApiKey(provider: string): string {
  switch (provider) {
    case 'anthropic': return process.env.ANTHROPIC_API_KEY ?? ''
    case 'deepseek':  return process.env.DEEPSEEK_API_KEY ?? ''
    case 'openai':    return process.env.OPENAI_API_KEY ?? ''
    default:          return ''
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    config: Omit<AgentConfig, 'tools'>
    history: ChatMessage[]
    message: string
    enabledTools: ToolName[]
    enabledSkills: SkillName[]
    summary?: string
  }

  const apiKey = getModelApiKey(body.config.model.provider)

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: `Missing API key for provider: ${body.config.model.provider}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 从文件系统读取 skill 注册表，构建包含启用 skills 的 system prompt
  const { skills } = await readSkillRegistry().catch(() => ({ skills: [] }))
  const basePrompt = body.summary
    ? body.config.systemPrompt + '\n\n以下是之前对话的摘要，请基于此继续对话：\n' + body.summary
    : body.config.systemPrompt
  const systemPrompt = await buildSystemPromptWithSkills(basePrompt, skills)

  const history = body.history.map((m) => ({ role: m.role, content: m.content }))

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
          goal:    body.message,
          history,
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
