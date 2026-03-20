import type { Tool } from '@/types/tool'

export function createPythonExecuteTool(): Tool {
  return {
    definition: {
      name: 'python_execute',
      description: '执行 Python 代码，返回 stdout 输出。必须用 print() 输出结果，否则会显示无输出。适合数据分析、科学计算、文件处理等任务。注意：每次调用都在独立进程中运行，变量不会跨调用保留。需要多步操作时，请将所有代码放在同一次调用中。',
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
