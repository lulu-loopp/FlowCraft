'use client';
import React from 'react';

export function CodingAgentDemo({ className }: { className?: string }) {
  const lines = [
    { text: '$ analyzing code...', color: 'text-emerald-400', delay: '0s' },
    { text: '> reading src/app.ts', color: 'text-slate-400', delay: '0.8s' },
    { text: '> found 3 issues', color: 'text-amber-400', delay: '1.6s' },
    { text: '$ patching files...', color: 'text-emerald-400', delay: '2.8s' },
    { text: '  M src/app.ts', color: 'text-sky-400', delay: '3.6s' },
    { text: '  M src/utils.ts', color: 'text-sky-400', delay: '4.2s' },
    { text: '  A src/helper.ts', color: 'text-emerald-400', delay: '4.8s' },
  ];

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center ${className ?? ''}`}>
      <style>{`
        @keyframes code-line {
          0%, 3% { opacity: 0; transform: translateY(4px); }
          8%, 78% { opacity: 1; transform: translateY(0); }
          88%, 100% { opacity: 0; }
        }
        @keyframes code-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes code-badge {
          0%, 70% { opacity: 0; transform: scale(0.9); }
          78%, 90% { opacity: 1; transform: scale(1); }
          98%, 100% { opacity: 0; }
        }
      `}</style>
      <div className="w-56 bg-slate-900 rounded-lg p-2.5 font-mono text-[10px] leading-relaxed overflow-hidden">
        <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-700">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[9px] text-slate-500 ml-1">terminal</span>
        </div>
        {lines.map((line, i) => (
          <div key={i} className={`${line.color} whitespace-nowrap`}
            style={{ animation: `code-line 7s ease-out infinite ${line.delay}` }}>
            {line.text}
          </div>
        ))}
        <span className="inline-block w-1.5 h-3 bg-emerald-400 mt-0.5"
          style={{ animation: 'code-cursor 1s step-end infinite' }} />
      </div>
      <div className="absolute bottom-2 right-8 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-900/80 border border-emerald-700"
        style={{ animation: 'code-badge 7s ease-out infinite' }}>
        <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
        <span className="text-[9px] text-emerald-300 font-medium">3 files changed</span>
      </div>
    </div>
  );
}
