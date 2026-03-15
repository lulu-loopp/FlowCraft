'use client'
import React from 'react'

export function useCopyToast() {
  const [show, setShow] = React.useState(false)

  const copy = React.useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setShow(true)
    setTimeout(() => setShow(false), 1500)
  }, [])

  const Toast = React.useCallback(() => show ? (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2
                    bg-slate-800 text-white text-xs px-4 py-2
                    rounded-full shadow-xl z-[200]
                    animate-fade-in-up pointer-events-none">
      ✓ 已复制到剪贴板
    </div>
  ) : null, [show])

  return { copy, Toast }
}
