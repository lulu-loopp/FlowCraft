import type { Tool } from '@/types/tool'

export function createCodeExecuteTool(): Tool {
  return {
    definition: {
      name: 'code_execute',
      description: '执行 JavaScript 代码片段，返回执行结果。适合数据处理、算法验证、格式转换等任务。',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '要执行的 JavaScript 代码，使用 console.log 输出结果',
          },
        },
        required: ['code'],
      },
    },

    execute: async () => {
      throw new Error('code_execute must run server-side')
    },
  }
}
