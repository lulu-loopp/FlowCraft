import type { Tool } from '@/types/tool'

// Tavily 返回结果的类型
interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
}

interface TavilyResponse {
  results: TavilyResult[]
  answer?: string
}

export function createWebSearchTool(apiKey: string): Tool {
  return {
    definition: {
      name: 'web_search',
      description: '搜索互联网获取最新信息。当没有具体 URL、需要查找关键词相关内容时使用。注意：query 只能是普通关键词，不支持 site: 等搜索运算符。',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词，尽量具体',
          },
        },
        required: ['query'],
      },
    },

    execute: async (input) => {
      const query = input.query as string

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: 5,
          include_answer: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`)
      }

      const data: TavilyResponse = await response.json()

      // 把结果格式化成 LLM 容易读的文本
      const formatted = data.results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
        .join('\n\n')

      return data.answer
        ? `Summary: ${data.answer}\n\nSources:\n${formatted}`
        : formatted
    },
  }
}