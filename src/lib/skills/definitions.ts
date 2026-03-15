/**
 * 客户端和服务端均可 import。
 * 不可引入任何 Node.js 专用模块或 skill 执行逻辑。
 */

export type SkillName = 'research_subagent' | 'code_subagent'

export const SKILL_DESCRIPTIONS: Record<SkillName, string> = {
  research_subagent: '深度调研（subagent）',
  code_subagent:     '写代码并运行（subagent）',
}
