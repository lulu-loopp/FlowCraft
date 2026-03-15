import fs from 'fs/promises'
import path from 'path'
import type { SkillRegistry, AgentRegistry, SkillEntry, AgentEntry } from '@/types/registry'

const SKILLS_DIR = path.join(process.cwd(), 'skills')
const AGENTS_DIR = path.join(process.cwd(), 'agents')
const SKILLS_INDEX = path.join(SKILLS_DIR, 'index.json')
const AGENTS_INDEX = path.join(AGENTS_DIR, 'index.json')

async function ensureDir(dir: string, indexPath: string, emptyRegistry: object) {
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(indexPath)
  } catch {
    await fs.writeFile(indexPath, JSON.stringify(emptyRegistry, null, 2))
  }
}

// Skills
export async function readSkillRegistry(): Promise<SkillRegistry> {
  await ensureDir(SKILLS_DIR, SKILLS_INDEX, { skills: [] })
  const content = await fs.readFile(SKILLS_INDEX, 'utf-8')
  return JSON.parse(content)
}

export async function writeSkillRegistry(registry: SkillRegistry): Promise<void> {
  await fs.writeFile(SKILLS_INDEX, JSON.stringify(registry, null, 2))
}

export async function addSkillEntry(entry: SkillEntry): Promise<void> {
  const registry = await readSkillRegistry()
  const filtered = registry.skills.filter((s) => s.name !== entry.name)
  registry.skills = [...filtered, entry]
  await writeSkillRegistry(registry)
}

export async function removeSkillEntry(name: string): Promise<void> {
  const registry = await readSkillRegistry()
  registry.skills = registry.skills.filter((s) => s.name !== name)
  await writeSkillRegistry(registry)
}

export async function updateSkillEntry(
  name: string,
  updates: Partial<SkillEntry>
): Promise<void> {
  const registry = await readSkillRegistry()
  registry.skills = registry.skills.map((s) =>
    s.name === name ? { ...s, ...updates } : s
  )
  await writeSkillRegistry(registry)
}

// Agents
export async function readAgentRegistry(): Promise<AgentRegistry> {
  await ensureDir(AGENTS_DIR, AGENTS_INDEX, { agents: [] })
  const content = await fs.readFile(AGENTS_INDEX, 'utf-8')
  return JSON.parse(content)
}

export async function writeAgentRegistry(registry: AgentRegistry): Promise<void> {
  await fs.writeFile(AGENTS_INDEX, JSON.stringify(registry, null, 2))
}

export async function addAgentEntry(entry: AgentEntry): Promise<void> {
  const registry = await readAgentRegistry()
  const filtered = registry.agents.filter((a) => a.name !== entry.name)
  registry.agents = [...filtered, entry]
  await writeAgentRegistry(registry)
}

export async function removeAgentEntry(name: string): Promise<void> {
  const registry = await readAgentRegistry()
  registry.agents = registry.agents.filter((a) => a.name !== name)
  await writeAgentRegistry(registry)
}

export async function updateAgentEntry(
  name: string,
  updates: Partial<AgentEntry>
): Promise<void> {
  const registry = await readAgentRegistry()
  registry.agents = registry.agents.map((a) =>
    a.name === name ? { ...a, ...updates } : a
  )
  await writeAgentRegistry(registry)
}
