// tool 的静态定义（告诉 LLM 这个工具是什么）
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
    }>
    required: string[]
  }
}

// tool 的执行函数
export type ToolExecutor = (input: Record<string, unknown>) => Promise<string>

// 注册进系统的完整 tool
export interface Tool {
  definition: ToolDefinition
  execute: ToolExecutor
}