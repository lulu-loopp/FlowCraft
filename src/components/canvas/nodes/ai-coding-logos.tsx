import React from 'react'

export function ClaudeCodeLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16.009 8.754l-3.788 6.544a.722.722 0 01-1.25 0L7.184 8.754a.722.722 0 01.625-1.083h7.575a.722.722 0 01.625 1.083z"
        fill="#D97757"
      />
      <path
        d="M12.596 3.291l5.48 9.488a1.444 1.444 0 01-1.25 2.167H7.174a1.444 1.444 0 01-1.25-2.167l5.48-9.488a.722.722 0 011.192 0z"
        stroke="#D97757"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function CodexLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="16" rx="3" fill="#000" />
      <path
        d="M9 8.5l3 3.5-3 3.5M14 15.5h3"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
