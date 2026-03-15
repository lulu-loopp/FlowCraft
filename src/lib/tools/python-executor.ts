import type { Tool } from '@/types/tool'

export function createPythonExecuteTool(): Tool {
  return {
    definition: {
      name: 'python_execute',
      description: '执行 Python 代码，返回执行结果。适合数据分析、科学计算、文件处理等任务。支持常用标准库。',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '要执行的 Python 代码，用 print() 输出结果',
          },
          timeout: {
            type: 'number',
            description: '超时时间（毫秒），默认 10000',
          },
        },
        required: ['code'],
      },
    },

    execute: async () => {
      throw new Error('python_execute must run server-side')
    },
  }
}
