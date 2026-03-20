'use client'
import React, { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Download } from 'lucide-react'
import { ImageLightbox } from './image-lightbox'

const remarkPlugins = [remarkGfm, remarkMath] as const
const rehypePlugins = [rehypeKatex] as const

interface MarkdownRendererProps {
  children: string
  className?: string
}

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [showLightbox, setShowLightbox] = useState(false)

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!src) return
    try {
      if (src.startsWith('data:')) {
        const a = document.createElement('a')
        a.href = src
        a.download = `image-${Date.now()}.png`
        a.click()
      } else {
        const res = await fetch(src)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `image-${Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      window.open(src, '_blank')
    }
  }, [src])

  if (!src) return null

  return (
    <>
      <span className="inline-block my-2 group relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || ''}
          className="block max-h-[200px] w-auto object-contain cursor-pointer"
          onClick={() => setShowLightbox(true)}
        />
        {/* Overlay controls */}
        <span className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-white/80 truncate max-w-[70%]">{alt || ''}</span>
          <button
            onClick={handleDownload}
            className="p-1 rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </span>
      </span>

      {showLightbox && (
        <ImageLightbox
          src={src}
          alt={alt || ''}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </>
  )
}

export function MarkdownRenderer({ children, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[...remarkPlugins]}
        rehypePlugins={[...rehypePlugins]}
        components={{
          img: ({ src, alt }) => <MarkdownImage src={src as string | undefined} alt={alt} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
