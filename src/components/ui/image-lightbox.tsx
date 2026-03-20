'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download } from 'lucide-react'

interface ImageLightboxProps {
  src: string
  alt: string
  onClose: () => void
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount guard for SSR portal
  useEffect(() => { setMounted(true) }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleDownload = useCallback(async () => {
    try {
      if (src.startsWith('data:')) {
        // data URL — create blob from base64
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

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        {/* Controls */}
        <div className="absolute -top-10 right-0 flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />

        {/* Alt text */}
        {alt && (
          <p className="mt-3 text-sm text-white/70 text-center max-w-lg truncate">{alt}</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
