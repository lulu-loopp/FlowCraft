// Skill 能力画像（AI 分析后填充）
export type SkillTag = 'file_output' | 'knowledge' | 'code_gen' | 'delegation' | 'visual'

export interface SkillProfile {
  tags: SkillTag[]                   // 技能标签
  outputFileTypes?: string[]         // 产出文件类型，如 ['.pptx', '.pdf']
  requiredTools?: string[]           // 需要的工具，如 ['python_execute']
  dependencies?: string[]            // 需要的依赖，如 ['pip:python-pptx', 'npm:pptxgenjs']
  recommendedModels?: string[]       // 推荐模型能力，如 ['tool_calling', 'multimodal']
  summary?: string                   // 一句话总结 skill 的核心能力
  analyzedAt?: number                // 分析时间戳
}

// skill 注册表条目
export interface SkillEntry {
  name: string
  description: string
  source: string        // 原始 GitHub 链接或 'manual' 或 'builtin'
  installedAt: number
  enabled: boolean
  path: string          // 相对路径，如 'skills/skill-creator'
  builtin?: boolean     // 内置 skill，不可删除
  profile?: SkillProfile // AI 分析后的能力画像
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

// 个人 Agent 条目
export interface IndividualEntry {
  name: string
  description: string
  role: string
  runCount: number
  memoryCount: number
  createdAt: number
}

// Agent 组合条目
export interface PackEntry {
  name: string
  description: string
  nodeCount: number
  runCount: number
  createdAt: number
  version?: number
}

// agents/individuals/index.json 结构
export interface IndividualRegistry {
  individuals: IndividualEntry[]
}

// agents/packs/index.json 结构
export interface PackRegistry {
  packs: PackEntry[]
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
