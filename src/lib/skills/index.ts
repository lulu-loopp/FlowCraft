import type { ModelConfig } from '@/types/model'
import type { AgentStep } from '@/types/agent'
import type { Tool } from '@/types/tool'
import type { SkillName } from './definitions'
import { createResearchSkill } from './research-skill'
import { createCodeSkill }     from './code-skill'

export type { SkillName }           from './definitions'
export { SKILL_DESCRIPTIONS }       from './definitions'

export function createSkills(
  enabledSkills: SkillName[],
  modelConfig: ModelConfig,
  onSubStep?: (agentName: string, step: AgentStep) => void
): Tool[] {
  const registry: Record<SkillName, () => Tool> = {
    research_subagent: () => createResearchSkill(modelConfig, onSubStep),
    code_subagent:     () => createCodeSkill(modelConfig, onSubStep),
  }
  return enabledSkills.map((name) => registry[name]())
}
