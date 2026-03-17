import type { ToolName } from '@/lib/tools/definitions'
import type { ToolApiKeys } from '@/lib/tool-api-keys'

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
    provides: ['brave_search'],
  },
]

export const MCP_TOOLS: ToolName[] = MCP_SERVERS.flatMap((s) => s.provides)

export function getMCPServerForTool(
  toolName: ToolName,
  apiKeys?: Partial<ToolApiKeys>
): MCPServerConfig | undefined {
  const server = MCP_SERVERS.find((s) => s.provides.includes(toolName))
  if (!server) return undefined

  if (server.name === 'brave-search') {
    return {
      ...server,
      env: {
        BRAVE_API_KEY: apiKeys?.brave ?? process.env.BRAVE_API_KEY ?? '',
      },
    }
  }

  return server
}
