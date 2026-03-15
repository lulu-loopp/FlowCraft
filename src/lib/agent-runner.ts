import fs from 'fs/promises'
import path from 'path'
import type { AgentConfig, AgentStep } from '@/types/agent'
import type { SkillEntry } from '@/types/registry'
import { runWithAnthropic } from './models/anthropic'
import { runWithOpenAI } from './models/openai'

export type InputImage = { base64: string; mimeType: string; name: string }

export interface RunAgentOptions {
  config: AgentConfig
  goal: string
  onStep: (step: AgentStep) => void
  onToken?: (token: string) => void
  history?: { role: 'user' | 'assistant', content: string }[]
  enabledSkills?: SkillEntry[]
  inputImages?: InputImage[]
}

export async function buildSystemPromptWithSkills(
  basePrompt: string,
  skillRegistry: SkillEntry[]
): Promise<string> {
  return buildSystemPrompt(basePrompt, skillRegistry.filter((s) => s.enabled))
}

async function buildSystemPrompt(
  basePrompt: string,
  enabledSkills?: SkillEntry[]
): Promise<string> {
  if (!enabledSkills || enabledSkills.length === 0) return basePrompt

  const skillContents: string[] = []

  for (const skill of enabledSkills) {
    if (!skill.enabled) continue
    try {
      const skillMdPath = path.join(process.cwd(), skill.path, 'SKILL.md')
      const content = await fs.readFile(skillMdPath, 'utf-8')
      const instructions = content
        .replace(/^---[\s\S]*?---\n/, '')
        .trim()
      skillContents.push(`## Skill: ${skill.name}\n${instructions}`)
    } catch {
      // skill 文件不存在，跳过
    }
  }

  if (skillContents.length === 0) return basePrompt

  return `${basePrompt}\n\n---\n\n# Loaded Skills\n\n${skillContents.join('\n\n---\n\n')}`
}

export const SERVER_TOOLS = ['code_execute', 'python_execute']

export async function executeServerTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  const { runCodeExecute, runPythonExecute } = await import('./tools/server-executor')
  if (toolName === 'code_execute') return runCodeExecute(input)
  if (toolName === 'python_execute') return runPythonExecute(input)
  throw new Error(`Unknown server tool: ${toolName}`)
}

export async function runAgent({ config, goal, onStep, onToken, history, enabledSkills, inputImages }: RunAgentOptions) {
  const { model, tools, maxIterations } = config
  const systemPrompt = await buildSystemPrompt(config.systemPrompt, enabledSkills)

  switch (model.provider) {
    case 'anthropic':
      return runWithAnthropic(
        model, systemPrompt, goal, tools, maxIterations, onStep, onToken, history, inputImages
      )
    case 'openai':
    case 'deepseek':
      return runWithOpenAI(
        model, systemPrompt, goal, tools, maxIterations, onStep, onToken, history, inputImages
      )
    default:
      throw new Error(`Unknown provider: ${model.provider}`)
  }
}
