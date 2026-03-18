import fs from 'fs/promises'
import path from 'path'
import type {
  SkillRegistry, AgentRegistry, SkillEntry, AgentEntry,
  IndividualRegistry, PackRegistry, IndividualEntry, PackEntry
} from '@/types/registry'

const SKILLS_DIR = path.join(process.cwd(), 'skills')
const AGENTS_DIR = path.join(process.cwd(), 'agents')
const INDIVIDUALS_DIR = path.join(AGENTS_DIR, 'individuals')
const PACKS_DIR = path.join(AGENTS_DIR, 'packs')
const SKILLS_INDEX = path.join(SKILLS_DIR, 'index.json')
const AGENTS_INDEX = path.join(AGENTS_DIR, 'index.json')
const INDIVIDUALS_INDEX = path.join(INDIVIDUALS_DIR, 'index.json')
const PACKS_INDEX = path.join(PACKS_DIR, 'index.json')

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

// Individuals
export async function readIndividualRegistry(): Promise<IndividualRegistry> {
  await ensureDir(INDIVIDUALS_DIR, INDIVIDUALS_INDEX, { individuals: [] })
  const content = await fs.readFile(INDIVIDUALS_INDEX, 'utf-8')
  return JSON.parse(content)
}

export async function writeIndividualRegistry(registry: IndividualRegistry): Promise<void> {
  await fs.writeFile(INDIVIDUALS_INDEX, JSON.stringify(registry, null, 2))
}

export async function addIndividualEntry(entry: IndividualEntry): Promise<void> {
  const registry = await readIndividualRegistry()
  registry.individuals = [...registry.individuals.filter(i => i.name !== entry.name), entry]
  await writeIndividualRegistry(registry)
}

export async function removeIndividualEntry(name: string): Promise<void> {
  const registry = await readIndividualRegistry()
  registry.individuals = registry.individuals.filter(i => i.name !== name)
  await writeIndividualRegistry(registry)
}

export async function updateIndividualEntry(
  name: string,
  updates: Partial<IndividualEntry>
): Promise<void> {
  const registry = await readIndividualRegistry()
  registry.individuals = registry.individuals.map(i =>
    i.name === name ? { ...i, ...updates } : i
  )
  await writeIndividualRegistry(registry)
}

// Packs
export async function readPackRegistry(): Promise<PackRegistry> {
  await ensureDir(PACKS_DIR, PACKS_INDEX, { packs: [] })
  const content = await fs.readFile(PACKS_INDEX, 'utf-8')
  return JSON.parse(content)
}

export async function writePackRegistry(registry: PackRegistry): Promise<void> {
  await fs.writeFile(PACKS_INDEX, JSON.stringify(registry, null, 2))
}

export async function addPackEntry(entry: PackEntry): Promise<void> {
  const registry = await readPackRegistry()
  registry.packs = [...registry.packs.filter(p => p.name !== entry.name), entry]
  await writePackRegistry(registry)
}

export async function removePackEntry(name: string): Promise<void> {
  const registry = await readPackRegistry()
  registry.packs = registry.packs.filter(p => p.name !== name)
  await writePackRegistry(registry)
}

export async function updatePackEntry(
  name: string,
  updates: Partial<PackEntry>
): Promise<void> {
  const registry = await readPackRegistry()
  registry.packs = registry.packs.map(p =>
    p.name === name ? { ...p, ...updates } : p
  )
  await writePackRegistry(registry)
}
