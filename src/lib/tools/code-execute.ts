import type { Tool } from '@/types/tool'

function makeJsTool(name: string): Tool {
  return {
    definition: {
      name,
      description: '在 Node.js 环境中执行 JavaScript 代码。可以 require npm 包（如 pptxgenjs、exceljs 等）、读写文件、使用完整的 Node.js API。注意：每次调用都在独立进程中运行，变量不会跨调用保留。需要多步操作时，请将所有代码放在同一次调用中。',
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
      throw new Error(`${name} must run server-side`)
    },
  }
}

export function createCodeExecuteTool(): Tool {
  return makeJsTool('code_execute')
}

export function createJsExecuteTool(): Tool {
  return makeJsTool('js_execute')
}
