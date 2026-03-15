import type { ToolName } from '@/lib/tools/definitions'

export interface MCPServerConfig {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  provides: ToolName[]
  /** MCP 实际工具名 → 我们内部工具名的映射（当两者不同时使用） */
  toolNameMap?: Record<string, ToolName>
}

export const MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'fetch',
    command: 'npx',
    args: ['-y', 'mcp-fetch-server'],
    provides: ['url_fetch'],
    toolNameMap: { fetch_markdown: 'url_fetch' },
  },
  {
    name: 'brave-search',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: {
      BRAVE_API_KEY: process.env.BRAVE_API_KEY ?? '',
    },
    provides: ['brave_search'],
  },
]

export const MCP_TOOLS: ToolName[] = MCP_SERVERS.flatMap((s) => s.provides)

export function getMCPServerForTool(toolName: ToolName): MCPServerConfig | undefined {
  return MCP_SERVERS.find((s) => s.provides.includes(toolName))
}
