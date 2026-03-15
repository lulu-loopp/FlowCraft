import type { Tool } from '@/types/tool'

export function createUrlFetchTool(): Tool {
  return {
    definition: {
      name: 'url_fetch',
      description: '直接抓取指定 URL 的网页内容。当用户提供了具体的网址（URL）时，优先使用此工具而非 web_search。适用于读取特定文章、文档、论坛帖子、网页详情。',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '要抓取的网页 URL',
          },
          maxLength: {
            type: 'number',
            description: '返回内容的最大字符数，默认 3000',
          },
        },
        required: ['url'],
      },
    },

    execute: async (input) => {
      try {
        const response = await fetch(input.url as string, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        })
        if (!response.ok) {
          return `Error: HTTP ${response.status}`
        }
        const html = await response.text()
        const maxLength = (input.maxLength as number | undefined) ?? 3000
        const text = html
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, maxLength)
        return text
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : 'unknown error'}`
      }
    },
  }
}
