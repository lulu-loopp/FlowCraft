import type { Tool } from '@/types/tool'

export function createCalculatorTool(): Tool {
  return {
    definition: {
      name: 'calculator',
      description: '执行数学计算，支持加减乘除、幂运算、三角函数、对数等。输入数学表达式字符串，返回计算结果。',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '数学表达式，例如 2 + 2、Math.sqrt(16)、Math.sin(Math.PI/2)',
          },
        },
        required: ['expression'],
      },
    },

    execute: async (input) => {
      try {
        const result = new Function('Math', `return ${input.expression as string}`)(Math)
        return String(result)
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : 'unknown error'}`
      }
    },
  }
}
