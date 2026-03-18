'use client';
import React from 'react';

export function ToolDemo({ className }: { className?: string }) {
  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center gap-3 ${className ?? ''}`}>
      <style>{`
        @keyframes tool-fill {
          0%, 5% { width: 0%; }
          40% { width: 100%; }
          45%, 100% { width: 100%; }
        }
        @keyframes tool-check {
          0%, 42% { opacity: 0; transform: scale(0.5); }
          50%, 90% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.5); }
        }
        @keyframes tool-label {
          0%, 5% { opacity: 1; }
          42%, 90% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes tool-gear {
          0% { transform: rotate(0deg); }
          40% { transform: rotate(360deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div className="flex items-center gap-2">
        <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          style={{ animation: 'tool-gear 7s linear infinite' }}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        <span className="text-sm font-semibold text-emerald-700">web_search()</span>
      </div>
      <div className="w-48 h-3 bg-emerald-100 rounded-full overflow-hidden relative">
        <div className="h-full bg-emerald-500 rounded-full"
          style={{ animation: 'tool-fill 7s ease-out infinite' }} />
      </div>
      <div className="relative h-5">
        <span className="text-xs text-slate-400"
          style={{ animation: 'tool-label 7s ease-in-out infinite' }}>Executing...</span>
        <svg className="absolute inset-0 m-auto w-5 h-5 text-emerald-500" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: 'tool-check 7s ease-out infinite' }}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      </div>
    </div>
  );
}
