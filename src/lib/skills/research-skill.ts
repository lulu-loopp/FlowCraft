import type { ModelConfig } from '@/types/model'
import type { AgentStep } from '@/types/agent'
import { createSkillTool } from './base'

export function createResearchSkill(
  modelConfig: ModelConfig,
  onSubStep?: (agentName: string, step: AgentStep) => void
) {
  return createSkillTool({
    name: 'research_subagent',
    description: '深度调研一个话题。自动进行多次搜索、汇总信息，返回详细的调研报告。适合需要全面了解某个话题时使用。',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: '要调研的话题或问题',
        },
        depth: {
          type: 'string',
          description: '调研深度：quick（快速，2-3次搜索）或 deep（深度，4-6次搜索）',
        },
      },
      required: ['topic'],
    },
    systemPrompt: `你是一个专业的调研助手。
你的任务是对给定话题进行深入调研，返回一份结构清晰的报告。

调研步骤：
1. 先用宽泛的关键词搜索，了解整体情况
2. 根据初步结果，用更具体的关键词深入搜索
3. 如果 depth 是 deep，再搜索 2-3 次获取更多细节
4. 汇总所有信息，写成结构化报告

报告格式：
- 用 Markdown 格式
- 包含：概述、关键发现、详细分析、结论
- 引用具体来源`,
    modelConfig,
    enabledTools: ['web_search'],
    maxIterations: 8,
    onSubStep,
  })
}
