import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Tool } from '@/types/tool'

interface MCPServerConfig {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
}

// 启动一个 MCP server 并返回它暴露的所有 tools
export async function loadMCPTools(config: MCPServerConfig): Promise<Tool[]> {
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: config.env,
  })

  const client = new Client(
    { name: 'flowcraft', version: '1.0.0' },
    { capabilities: {} }
  )

  await client.connect(transport)

  const { tools: mcpTools } = await client.listTools()

  const tools: Tool[] = mcpTools.map((mcpTool) => ({
    definition: {
      name: mcpTool.name,
      description: mcpTool.description ?? '',
      inputSchema: mcpTool.inputSchema as Tool['definition']['inputSchema'],
    },
    execute: async (input) => {
      const result = await client.callTool({
        name: mcpTool.name,
        arguments: input,
      })

      // MCP 返回的 content 是数组，提取文字内容
      const text = result.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text)
        .join('\n')

      return text || 'No result'
    },
  }))

  return tools
}
