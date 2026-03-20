import fs from 'fs/promises'
import path from 'path'
import type { AgentConfig, AgentStep } from '@/types/agent'
import type { SkillEntry } from '@/types/registry'
import { runWithAnthropic } from './models/anthropic'
import { runWithOpenAI } from './models/openai'
import { runWithGoogle } from './models/google'

export type InputImage = { base64: string; mimeType: string; name: string }

export interface RunAgentOptions {
  config: AgentConfig
  goal: string
  onStep: (step: AgentStep) => void
  onToken?: (token: string) => void
  history?: { role: 'user' | 'assistant', content: string }[]
  enabledSkills?: SkillEntry[]
  inputImages?: InputImage[]
  /** If set, python_execute / code_execute will use this as cwd (workspace dir) */
  workspaceCwd?: string
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
      const skillDir = path.join(process.cwd(), skill.path)
      const skillMdPath = path.join(skillDir, 'SKILL.md')
      const content = await fs.readFile(skillMdPath, 'utf-8')
      const instructions = content
        .replace(/^---[\s\S]*?---\n/, '')
        .trim()
      // Tell the agent the absolute path so relative references like "scripts/..." resolve correctly
      const pathHint = `> Skill installed at: \`${skillDir}\`\n> When this skill references relative paths (e.g. \`scripts/...\`), prepend this directory.\n\n`
      skillContents.push(`## Skill: ${skill.name}\n${pathHint}${instructions}`)
    } catch {
      // skill 文件不存在，跳过
    }
  }

  if (skillContents.length === 0) return basePrompt

  const skillPolicy = `\n\n---\n\n# Skill Usage Policy

You have skills loaded below. You MUST follow these rules:

1. **Actually use them.** When a loaded skill is relevant to the task, call the required tools (e.g. \`python_execute\`) to carry out the skill's instructions. Do NOT just describe what you would do — execute it.
2. **Each tool call is stateless.** Every \`python_execute\` / \`code_execute\` call runs in a **fresh process** — variables, imports, and objects from previous calls do NOT exist. You MUST include ALL imports, variable definitions, and logic in a single self-contained code block. Never split a file-generation task across multiple calls expecting shared state.
3. **Self-heal on missing dependencies.** If a tool call fails with \`ModuleNotFoundError\` or similar import errors, immediately run \`pip install <package>\` via \`python_execute\` (e.g. \`import subprocess; subprocess.check_call(["pip", "install", "openpyxl"])\`), then retry the original operation. Do NOT give up or ask the user to install manually.
4. **Report unrecoverable failures.** If a tool call still fails after attempting auto-install, report the exact error message and suggest how to fix it. Never silently skip a failed step.
5. **Don't plan without acting.** If you find yourself writing a plan or outline without any tool calls, stop and start executing instead.
6. **Avoid deep nesting in code.** When generating JavaScript or Python code with complex nested objects (e.g. docx, pptxgenjs), use intermediate variables instead of nesting everything in a single expression. This prevents bracket-matching errors. Example — instead of \`new Paragraph({ children: [new TextRun({ text: "hello", bold: true })] })\`, write \`const run = new TextRun({ text: "hello", bold: true }); const para = new Paragraph({ children: [run] });\``

  return `${basePrompt}${skillPolicy}\n\n${skillContents.join('\n\n---\n\n')}`
}

export const SERVER_TOOLS = ['code_execute', 'js_execute', 'python_execute', 'read_file', 'save_document']

export async function executeServerTool(
  toolName: string,
  input: Record<string, unknown>,
  cwd?: string,
): Promise<string> {
  const { runCodeExecute, runPythonExecute } = await import('./tools/server-executor')
  // Inject workspace cwd so scripts run inside the workspace directory
  const enriched = cwd ? { ...input, _cwd: cwd } : input
  if (toolName === 'code_execute' || toolName === 'js_execute') return runCodeExecute(enriched)
  if (toolName === 'python_execute') return runPythonExecute(enriched)
  if (toolName === 'save_document') {
    const { runSaveDocument } = await import('./tools/save-document')
    return runSaveDocument(enriched)
  }
  if (toolName === 'read_file') {
    const { runReadFile } = await import('./tools/read-file')
    return runReadFile(enriched)
  }
  throw new Error(`Unknown server tool: ${toolName}`)
}

export async function runAgent({ config, goal, onStep, onToken, history, enabledSkills, inputImages, workspaceCwd }: RunAgentOptions) {
  const { model, tools, maxIterations } = config
  const systemPrompt = await buildSystemPrompt(config.systemPrompt, enabledSkills)

  let result
  switch (model.provider) {
    case 'anthropic':
      result = await runWithAnthropic(
        model, systemPrompt, goal, tools, maxIterations, onStep, onToken, history, inputImages, workspaceCwd
      )
      break
    case 'openai':
    case 'deepseek':
    case 'minimax':
      result = await runWithOpenAI(
        model, systemPrompt, goal, tools, maxIterations, onStep, onToken, history, inputImages, workspaceCwd
      )
      break
    case 'google':
      result = await runWithGoogle(
        model, systemPrompt, goal, tools, maxIterations, onStep, onToken, history, inputImages, workspaceCwd
      )
      break
    default:
      throw new Error(`Unknown provider: ${model.provider}`)
  }

  // Append image_generate results to finalOutput so images render in output nodes
  const imageMarkdowns = result.steps
    .filter(s => s.type === 'tool_result' && s.toolName === 'image_generate')
    .map(s => {
      const match = s.content.match(/!\[.*?\]\(.*?\)/)
      return match ? match[0] : null
    })
    .filter(Boolean)

  if (imageMarkdowns.length > 0) {
    result.finalOutput = result.finalOutput + '\n\n' + imageMarkdowns.join('\n\n')
  }

  return result
}
