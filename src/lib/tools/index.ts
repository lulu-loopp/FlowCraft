/**
 * 服务端专用 — 包含 MCP / Node.js 依赖，不要在客户端组件里 import。
 * 客户端只需要类型和描述常量时，请从 '@/lib/tools/definitions' 导入。
 */

import type { Tool } from '@/types/tool'
import type { ToolName } from './definitions'
import { MCP_TOOLS }               from './definitions'
import { createWebSearchTool }     from './web-search'
import { createCalculatorTool }    from './calculator'
import { createUrlFetchTool }      from './url-fetch'
import { createCodeExecuteTool }   from './code-execute'
import { createPythonExecuteTool } from './python-executor'
import { loadMCPTools }            from '@/lib/mcp/client'
import { getMCPServerForTool }     from '@/lib/mcp/servers'
import type { ToolApiKeys } from '@/lib/tool-api-keys'

export type { ToolName }                from './definitions'
export { TOOL_DESCRIPTIONS, MCP_TOOLS } from './definitions'

/** 将 mcp-fetch-server 的多个工具合并为一个带 format 参数的复合工具 */
function createCompositeFetchTool(mcpToolMap: Map<string, Tool>): Tool {
  return {
    definition: {
      name: 'url_fetch',
      description:
        '抓取指定 URL 的网页内容。根据场景自动选择 format：' +
        'markdown（默认，完整页面转 Markdown）、' +
        'readable（仅提取正文，适合广告多/布局复杂的页面）、' +
        'json（抓取 JSON 接口）、' +
        'youtube_transcript（获取 YouTube 视频字幕）。',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '要抓取的网页 URL',
          },
          format: {
            type: 'string',
            enum: ['markdown', 'readable', 'json', 'youtube_transcript'],
            description:
              '抓取格式。默认 markdown。' +
              '内容杂乱/有大量导航广告时用 readable；' +
              'REST API 用 json；' +
              'YouTube 视频用 youtube_transcript。',
          },
        },
        required: ['url'],
      },
    },
    execute: async (input) => {
      const format = (input.format as string | undefined) ?? 'markdown'
      const mcpNameMap: Record<string, string> = {
        markdown:           'fetch_markdown',
        readable:           'fetch_readable',
        json:               'fetch_json',
        youtube_transcript: 'fetch_youtube_transcript',
      }
      const mcpToolName = mcpNameMap[format] ?? 'fetch_markdown'
      const tool = mcpToolMap.get(mcpToolName)
      if (!tool) return createUrlFetchTool().execute(input)
      return tool.execute({ url: input.url })
    },
  }
}

export async function createTools(
  enabledTools: ToolName[],
  apiKeys: ToolApiKeys
): Promise<Tool[]> {
  const tools: Tool[] = []

  for (const name of enabledTools) {
    if (name === 'url_fetch') {
      // 复合工具：加载所有 fetch 变体，让 AI 通过 format 参数选择
      const serverConfig = getMCPServerForTool(name, apiKeys)
      if (serverConfig) {
        try {
          const rawTools = await loadMCPTools(serverConfig)
          const toolMap = new Map(rawTools.map((t) => [t.definition.name, t]))
          tools.push(createCompositeFetchTool(toolMap))
        } catch (err) {
          console.error('[MCP] Failed to load fetch tools, using local fallback:', err)
          tools.push(createUrlFetchTool())
        }
      } else {
        tools.push(createUrlFetchTool())
      }
    } else if (MCP_TOOLS.includes(name)) {
      // 其他 MCP 工具（如 brave_search）
      const serverConfig = getMCPServerForTool(name, apiKeys)
      if (serverConfig) {
        try {
          const rawTools = await loadMCPTools(serverConfig)
          const matched = rawTools.find((t) => t.definition.name === name)
          if (matched) tools.push(matched)
          else console.warn(`[MCP] Tool "${name}" not found in server`)
        } catch (err) {
          console.error(`[MCP] Failed to load tool "${name}":`, err)
        }
      }
    } else {
      const registry: Partial<Record<ToolName, () => Tool>> = {
        web_search:     () => createWebSearchTool(apiKeys.tavily ?? ''),
        calculator:     () => createCalculatorTool(),
        code_execute:   () => createCodeExecuteTool(),
        python_execute: () => createPythonExecuteTool(),
      }
      const factory = registry[name]
      if (factory) tools.push(factory())
    }
  }

  return tools
}
