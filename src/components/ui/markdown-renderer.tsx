'use client'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

const remarkPlugins = [remarkGfm, remarkMath] as const
const rehypePlugins = [rehypeKatex] as const

interface MarkdownRendererProps {
  children: string
  className?: string
}

export function MarkdownRenderer({ children, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[...remarkPlugins]}
        rehypePlugins={[...rehypePlugins]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
