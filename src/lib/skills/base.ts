import type { Tool } from '@/types/tool'
import type { ModelConfig } from '@/types/model'

export interface SkillConfig {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
  systemPrompt: string
  modelConfig: ModelConfig
  enabledTools: string[]
  maxIterations: number
  onSubStep?: (agentName: string, step: import('@/types/agent').AgentStep) => void
}

export function createSkillTool(config: SkillConfig): Tool {
  return {
    definition: {
      name: config.name,
      description: config.description,
      inputSchema: config.inputSchema,
    },
    execute: async (input) => {
      const { runAgent }    = await import('@/lib/agent-runner')
      const { createTools } = await import('@/lib/tools')

      const tools = await createTools(
        config.enabledTools as never,
        { tavily: process.env.NEXT_PUBLIC_TAVILY_KEY ?? '' }
      )

      const goal = Object.entries(input)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')

      const result = await runAgent({
        config: {
          id: crypto.randomUUID(),
          name: config.name,
          systemPrompt: config.systemPrompt,
          model: config.modelConfig,
          tools,
          maxIterations: config.maxIterations,
        },
        goal,
        onStep: (step) => config.onSubStep?.(config.name, step),
      })

      return result.finalOutput
    },
  }
}
