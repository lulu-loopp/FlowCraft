import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { readSkillRegistry, updateSkillEntry } from '@/lib/registry-manager'
import { resolveProviderApiKey } from '@/lib/resolve-api-key'
import { readSettings } from '@/lib/settings-storage'
import type { SkillProfile, SkillTag } from '@/types/registry'

const SKILLS_DIR = path.join(process.cwd(), 'skills')

const ANALYZE_PROMPT = `你是一个 Skill 分析专家。分析以下 Skill 的内容，输出一个 JSON 对象描述它的能力画像。

## 输出格式（严格 JSON，不要 markdown 代码块）

{
  "tags": ["..."],
  "outputFileTypes": [".pptx"],
  "requiredTools": ["python_execute"],
  "dependencies": ["pip:python-pptx", "npm:pptxgenjs"],
  "recommendedModels": ["tool_calling"],
  "summary": "一句话总结"
}

## 字段说明

**tags**（必填，至少一个）：
- "file_output" — 会生成/编辑文件（PPT、Word、图片等）
- "knowledge" — 提供知识、规范、设计指南，不直接产出文件
- "code_gen" — 生成代码（HTML、Python 脚本等）
- "delegation" — 委托其他工具/CLI 执行任务
- "visual" — 涉及可视化内容（图表、艺术、UI）

**outputFileTypes**（可选）：该 skill 可能产出的文件扩展名列表，如 [".pptx", ".pdf"]。仅 file_output 类型需要填。

**requiredTools**（可选）：运行该 skill 需要的工具。从以下列表选择：
web_search, calculator, url_fetch, js_execute, python_execute, image_generate

**dependencies**（可选）：需要的外部依赖。格式为 "pip:包名" 或 "npm:包名" 或 "system:命令名"。
从 skill 内容中提取，如 pip install 指令、npm install 指令、系统命令等。

**recommendedModels**（可选）：推荐的模型能力。从以下选择：
- "tool_calling" — 需要调用工具
- "multimodal" — 需要处理/识别图片
- "long_context" — 需要处理长文本
- "reasoning" — 需要复杂推理

**summary**（必填）：用一句简洁的话总结该 skill 的核心能力和用途。

## 分析要点

1. 仔细阅读 skill 内容，包括 frontmatter、说明、示例代码
2. 如果内容中提到 pip install、npm install 等命令，提取为 dependencies
3. 如果内容中提到需要执行 Python 代码，requiredTools 应包含 python_execute；如果是 JavaScript/Node.js 代码（如 pptxgenjs、exceljs），应包含 js_execute
4. 如果内容只是提供指南/规范/最佳实践，tags 应为 ["knowledge"]，不需要 requiredTools
5. 一个 skill 可以有多个 tag

直接输出 JSON，不要任何其他文字。`

/** Pick the cheapest available provider for analysis */
async function pickAnalysisProvider(): Promise<{ provider: string; apiKey: string; model: string } | null> {
  const settings = await readSettings()
  const priorities: Array<{ provider: string; model: string }> = [
    { provider: 'deepseek', model: 'deepseek-chat' },
    { provider: 'google', model: 'gemini-2.0-flash' },
    { provider: 'openai', model: 'gpt-4o-mini' },
    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  ]

  // Try user's default provider first
  if (settings.defaultProvider) {
    const key = await resolveProviderApiKey(settings.defaultProvider)
    if (key) {
      const fallbackModel = priorities.find(p => p.provider === settings.defaultProvider)?.model || 'deepseek-chat'
      return { provider: settings.defaultProvider, apiKey: key, model: fallbackModel }
    }
  }

  for (const { provider, model } of priorities) {
    const key = await resolveProviderApiKey(provider)
    if (key) return { provider, apiKey: key, model }
  }
  return null
}

async function callAnalysisLLM(provider: string, apiKey: string, model: string, skillContent: string): Promise<string> {
  const userMessage = `以下是需要分析的 Skill 内容：\n\n${skillContent}`

  switch (provider) {
    case 'deepseek': {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: ANALYZE_PROMPT },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      })
      if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`)
      const data = await res.json()
      return data.choices[0].message.content
    }
    case 'openai': {
      const OpenAI = (await import('openai')).default
      const client = new OpenAI({ apiKey })
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: ANALYZE_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      })
      return completion.choices[0].message.content || ''
    }
    case 'anthropic': {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic({ apiKey })
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: `${ANALYZE_PROMPT}\n\n${userMessage}` }],
      })
      return response.content.map(b => b.type === 'text' ? b.text : '').join('')
    }
    case 'google': {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const genModel = genAI.getGenerativeModel({
        model,
        generationConfig: { responseMimeType: 'application/json' },
      })
      const result = await genModel.generateContent(`${ANALYZE_PROMPT}\n\n${userMessage}`)
      return result.response.text()
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

function validateProfile(raw: Record<string, unknown>): SkillProfile {
  const VALID_TAGS = new Set<SkillTag>(['file_output', 'knowledge', 'code_gen', 'delegation', 'visual'])
  const VALID_CAPS = new Set(['tool_calling', 'multimodal', 'long_context', 'reasoning'])

  const tags = (Array.isArray(raw.tags) ? raw.tags : ['knowledge'])
    .filter((t: string) => VALID_TAGS.has(t as SkillTag)) as SkillTag[]

  const profile: SkillProfile = {
    tags: tags.length > 0 ? tags : ['knowledge'],
    analyzedAt: Date.now(),
  }

  if (Array.isArray(raw.outputFileTypes) && raw.outputFileTypes.length > 0) {
    profile.outputFileTypes = raw.outputFileTypes.filter((t: unknown) => typeof t === 'string')
  }
  if (Array.isArray(raw.requiredTools) && raw.requiredTools.length > 0) {
    profile.requiredTools = raw.requiredTools.filter((t: unknown) => typeof t === 'string')
  }
  if (Array.isArray(raw.dependencies) && raw.dependencies.length > 0) {
    profile.dependencies = raw.dependencies.filter((t: unknown) => typeof t === 'string')
  }
  if (Array.isArray(raw.recommendedModels) && raw.recommendedModels.length > 0) {
    profile.recommendedModels = (raw.recommendedModels as string[]).filter(c => VALID_CAPS.has(c))
  }
  if (typeof raw.summary === 'string' && raw.summary.trim()) {
    profile.summary = raw.summary.trim()
  }

  return profile
}

/** Collect all skill content (SKILL.md + referenced files in same directory) */
async function collectSkillContent(skillName: string, skillPath?: string): Promise<string> {
  // Use registry path (e.g. "skills/taste-skill") if available, otherwise fall back to name
  const skillDir = skillPath
    ? path.join(process.cwd(), skillPath)
    : path.join(SKILLS_DIR, skillName)
  const mainFile = path.join(skillDir, 'SKILL.md')

  let content = ''
  try {
    content = await fs.readFile(mainFile, 'utf-8')
  } catch {
    throw new Error(`SKILL.md not found for ${skillName}`)
  }

  // Also include any referenced .md files in the same directory
  try {
    const entries = await fs.readdir(skillDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'SKILL.md') {
        const sub = await fs.readFile(path.join(skillDir, entry.name), 'utf-8')
        content += `\n\n---\n\n# ${entry.name}\n\n${sub}`
      }
    }
  } catch { /* directory listing failed, just use main file */ }

  // Truncate to avoid blowing up context (max ~12k chars)
  if (content.length > 12000) {
    content = content.slice(0, 12000) + '\n\n... (truncated)'
  }

  return content
}

/**
 * POST /api/skills/analyze
 * Body: { name: string } — analyze a single installed skill
 * Body: { name: string[] } — analyze multiple skills (batch)
 */
export async function POST(req: NextRequest) {
  const body = await req.json() as { name: string | string[] }

  const names = Array.isArray(body.name) ? body.name : [body.name]
  const registry = await readSkillRegistry()
  const results: Record<string, SkillProfile | { error: string }> = {}

  const resolved = await pickAnalysisProvider()
  if (!resolved) {
    return Response.json(
      { error: 'No API key configured for skill analysis' },
      { status: 400 },
    )
  }

  for (const name of names) {
    const entry = registry.skills.find(s => s.name === name)
    if (!entry) {
      results[name] = { error: 'Skill not found in registry' }
      continue
    }

    try {
      const content = await collectSkillContent(name, entry.path)
      const raw = await callAnalysisLLM(resolved.provider, resolved.apiKey, resolved.model, content)
      const cleaned = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      const parsed = JSON.parse(cleaned)
      const profile = validateProfile(parsed)

      // Save profile to registry
      await updateSkillEntry(name, { profile })
      results[name] = profile
    } catch (err) {
      results[name] = { error: err instanceof Error ? err.message : 'Analysis failed' }
    }
  }

  return Response.json({ results })
}
