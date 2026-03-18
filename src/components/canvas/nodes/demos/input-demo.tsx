'use client';
import React from 'react';

export function InputDemo({ className }: { className?: string }) {
  return (
    <div className={`relative w-full h-full flex items-center justify-center gap-3 ${className ?? ''}`}>
      <style>{`
        @keyframes input-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes input-char1 { 0%, 8% { opacity: 0; } 10%, 100% { opacity: 1; } }
        @keyframes input-char2 { 0%, 14% { opacity: 0; } 16%, 100% { opacity: 1; } }
        @keyframes input-char3 { 0%, 20% { opacity: 0; } 22%, 100% { opacity: 1; } }
        @keyframes input-char4 { 0%, 26% { opacity: 0; } 28%, 100% { opacity: 1; } }
        @keyframes input-char5 { 0%, 32% { opacity: 0; } 34%, 100% { opacity: 1; } }
        @keyframes input-char6 { 0%, 38% { opacity: 0; } 40%, 100% { opacity: 1; } }
        @keyframes input-particle {
          0%, 50% { opacity: 0; transform: translateX(0); }
          55% { opacity: 1; transform: translateX(0); }
          75% { opacity: 1; transform: translateX(40px); }
          85%, 100% { opacity: 0; transform: translateX(40px); }
        }
      `}</style>
      <div className="w-44 h-10 rounded-lg border-2 border-sky-300 bg-sky-50 flex items-center px-3">
        <span className="text-xs font-mono text-sky-700">
          {'Hello!'.split('').map((c, i) => (
            <span key={i} style={{ animation: `input-char${i + 1} 7s steps(1) infinite` }}>{c}</span>
          ))}
        </span>
        <span className="w-0.5 h-4 bg-sky-500 ml-0.5"
          style={{ animation: 'input-cursor 1s step-end infinite' }} />
      </div>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-sky-400"
            style={{ animation: `input-particle 7s ease-in-out infinite ${i * 0.25}s` }} />
        ))}
        <svg className="w-4 h-4 text-sky-300" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </div>
  );
}
