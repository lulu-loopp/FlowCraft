// skill 注册表条目
export interface SkillEntry {
  name: string
  description: string
  source: string        // 原始 GitHub 链接或 'manual'
  installedAt: number
  enabled: boolean
  path: string          // 相对路径，如 'skills/skill-creator'
}

// agent 注册表条目
export interface AgentEntry {
  name: string
  description: string
  source: string
  installedAt: number
  enabled: boolean
  path: string          // 相对路径，如 'agents/frontend-developer'
}

// skills/index.json 结构
export interface SkillRegistry {
  skills: SkillEntry[]
}

// agents/index.json 结构
export interface AgentRegistry {
  agents: AgentEntry[]
}

// scan 结果类型
export interface ScannedItem {
  name: string
  description: string
  filePath: string    // 在仓库里的相对路径，如 'agents/actix-expert.md'
  selected: boolean   // 前端用，默认 true
}

export interface ScanResult {
  type: 'single' | 'collection'
  source: string
  items: ScannedItem[]
}
