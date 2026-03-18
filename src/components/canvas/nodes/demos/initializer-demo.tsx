'use client';
import React from 'react';

export function InitializerDemo({ className }: { className?: string }) {
  const items = [
    { label: 'api_key', delay: '0s' },
    { label: 'config.json', delay: '1.2s' },
    { label: 'prompt.txt', delay: '2.4s' },
    { label: 'tools[ ]', delay: '3.6s' },
  ];

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center gap-1.5 ${className ?? ''}`}>
      <style>{`
        @keyframes init-item {
          0%, 5% { opacity: 0; transform: translateY(8px); }
          15%, 75% { opacity: 1; transform: translateY(0); }
          90%, 100% { opacity: 0; transform: translateY(-4px); }
        }
        @keyframes init-check {
          0%, 12% { opacity: 0; }
          20%, 75% { opacity: 1; }
          90%, 100% { opacity: 0; }
        }
        @keyframes init-header {
          0%, 2% { opacity: 0.4; }
          10%, 80% { opacity: 1; }
          90%, 100% { opacity: 0.4; }
        }
      `}</style>
      <div className="text-xs font-semibold text-violet-600 mb-1"
        style={{ animation: 'init-header 7s ease-in-out infinite' }}>
        Initializing...
      </div>
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-2 w-36"
          style={{ animation: `init-item 7s ease-out infinite ${item.delay}` }}>
          <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
            style={{ animation: `init-check 7s ease-out infinite ${parseFloat(item.delay) + 0.5}s` }}>
            <path d="M5 12l5 5L20 7" />
          </svg>
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              {i < 2
                ? <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 8h8M8 12h6" /></>
                : <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M8 10h8" /></>}
            </svg>
            <span className="text-[10px] font-mono text-slate-500">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
