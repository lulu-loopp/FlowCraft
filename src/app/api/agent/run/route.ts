import { NextRequest } from 'next/server'
import { runAgent, buildSystemPromptWithSkills } from '@/lib/agent-runner'
import { createTools } from '@/lib/tools'
import { createSkills } from '@/lib/skills'
import { readSkillRegistry } from '@/lib/registry-manager'
import { requireMutationAuth } from '@/lib/api-auth'
import { resolveProviderWithFallback } from '@/lib/resolve-api-key'
import { readToolApiKeys } from '@/lib/tool-api-keys'
import type { ToolName } from '@/lib/tools'
import type { SkillName } from '@/lib/skills'
import type { AgentConfig, StreamEvent } from '@/types/agent'

function toSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(req: NextRequest) {
  const denied = await requireMutationAuth(req)
  if (denied) return denied

  const body = await req.json() as {
    config: Omit<AgentConfig, 'tools'>
    goal: string
    enabledTools: ToolName[]
    enabledSkills: SkillName[]
    // File-system skill names selected for this specific node/session
    enabledFileSkills?: string[]
    inputImages?: Array<{ base64: string; mimeType: string; name: string }>
  }

  const resolved = await resolveProviderWithFallback(
    body.config.model.provider,
    body.config.model.model,
  )

  if (!resolved) {
    return new Response(
      JSON.stringify({ error: `Missing API key for provider: ${body.config.model.provider}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const apiKey = resolved.apiKey
  body.config.model.provider = resolved.provider
  body.config.model.model = resolved.model

  // 从文件系统读取 skill 注册表，构建 system prompt
  // 如果请求指定了 enabledFileSkills，只注入那些 skill；否则使用全局 enabled 标志
  const { skills } = await readSkillRegistry().catch(() => ({ skills: [] }))
  // If the request explicitly provides enabledFileSkills (even []), use only those;
  // only fall back to globally-enabled skills when the field is absent (e.g. Playground calls)
  const fileSkillsToInject = body.enabledFileSkills !== undefined
    ? skills.filter(s => body.enabledFileSkills!.includes(s.name)).map(s => ({ ...s, enabled: true }))
    : skills.filter(s => s.enabled)
  const systemPrompt = await buildSystemPromptWithSkills(body.config.systemPrompt, fileSkillsToInject)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(toSSE(event)))
      }

      // If file skills are enabled, ensure python_execute & js_execute are available
      // (skills typically need to run scripts but users may forget to enable these tools)
      const toolNames = [...body.enabledTools]
      if (fileSkillsToInject.length > 0) {
        if (!toolNames.includes('python_execute')) toolNames.push('python_execute')
        if (!toolNames.includes('js_execute') && !toolNames.includes('code_execute')) toolNames.push('js_execute')
      }

      const tools = await createTools(
        toolNames as ToolName[],
        await readToolApiKeys()
      )

      // Built-in tools: always available to all agents
      const { createReadFileTool } = await import('@/lib/tools/read-file')
      if (!tools.some(t => t.definition.name === 'read_file')) {
        tools.push(createReadFileTool())
      }
      // save_document is available but NOT auto-injected (to avoid conflict with docx skill).
      // Agents that need it should have it in enabledTools explicitly.

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

      // Emit skill-loaded indicators so the node UI shows which skills are active
      if (fileSkillsToInject.length > 0) {
        const names = fileSkillsToInject.map(s => s.name).join(', ')
        // Show which tools were auto-injected
        const autoTools = toolNames.filter(t => !body.enabledTools.includes(t))
        const autoMsg = autoTools.length > 0 ? ` (auto-enabled tools: ${autoTools.join(', ')})` : ''
        send({
          type: 'step',
          data: {
            id: `skill-load-${Date.now()}`,
            type: 'tool_result' as const,
            toolName: 'skill_load',
            content: `Loaded ${fileSkillsToInject.length} skill(s): ${names}${autoMsg}`,
            timestamp: Date.now(),
          },
        })
      }

      // Extract workspace cwd from system prompt so python_execute runs inside workspace
      let workspaceCwd: string | undefined
      const cwdMatch = systemPrompt.match(/## Output Directory\nSave ALL generated files[^\n]*to:\n`([^`]+)`/)
      if (cwdMatch) workspaceCwd = cwdMatch[1]

      try {
        const result = await runAgent({
          config,
          goal: body.goal,
          inputImages: body.inputImages,
          onStep:  (step)  => send({ type: 'step',  data: step }),
          onToken: (token) => send({ type: 'token', data: token }),
          workspaceCwd,
        })
        send({ type: 'usage', data: result.usage })
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
