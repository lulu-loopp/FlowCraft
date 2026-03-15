import type { ModelConfig } from '@/types/model'
import type { AgentStep } from '@/types/agent'
import { createSkillTool } from './base'

export function createCodeSkill(
  modelConfig: ModelConfig,
  onSubStep?: (agentName: string, step: AgentStep) => void
) {
  return createSkillTool({
    name: 'code_subagent',
    description: '编写并运行代码解决问题。自动写代码、执行、如果报错自动修复，直到成功运行。返回最终代码和运行结果。',
    inputSchema: {
      type: 'object',
      properties: {
        requirement: {
          type: 'string',
          description: '要实现的功能需求，描述越详细越好',
        },
        language: {
          type: 'string',
          description: '编程语言：javascript 或 python，默认 python',
        },
      },
      required: ['requirement'],
    },
    systemPrompt: `你是一个专业的程序员。
你的任务是根据需求编写代码并确保它能正确运行。

工作流程：
1. 理解需求，规划实现方案
2. 编写代码
3. 运行代码，检查结果
4. 如果报错，分析原因并修复
5. 重复步骤 3-4 直到代码正确运行
6. 返回最终代码和运行结果

返回格式：
- 用 Markdown 代码块包裹代码
- 说明代码的功能和运行结果
- 如果有多个版本，只返回最终正确的版本`,
    modelConfig,
    enabledTools: ['python_execute', 'code_execute'],
    maxIterations: 8,
    onSubStep,
  })
}
