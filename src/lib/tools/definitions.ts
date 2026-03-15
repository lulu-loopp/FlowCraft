/**
 * 工具类型和描述常量。
 * 此文件不可引入任何 Node.js 专用模块，客户端和服务端均可 import。
 */

export type ToolName =
  | 'web_search'
  | 'calculator'
  | 'url_fetch'
  | 'code_execute'
  | 'python_execute'
  | 'brave_search'

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  web_search:     '搜索互联网',
  calculator:     '数学计算',
  url_fetch:      '抓取网页内容（支持 Markdown / 正文提取 / JSON / YouTube 字幕）',
  code_execute:   '执行 JavaScript',
  python_execute: '执行 Python',
  brave_search:   '使用 Brave 搜索引擎（MCP）',
}

// 由 MCP server 提供的工具
export const MCP_TOOLS: ToolName[] = ['url_fetch', 'brave_search']
