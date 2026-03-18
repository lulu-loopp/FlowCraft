'use client';
import React from 'react';

export function OutputDemo({ className }: { className?: string }) {
  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center gap-2 ${className ?? ''}`}>
      <style>{`
        @keyframes out-line1 { 0%, 8% { opacity: 0; width: 0; } 15%, 85% { opacity: 1; width: 90%; } 95%, 100% { opacity: 0; } }
        @keyframes out-line2 { 0%, 18% { opacity: 0; width: 0; } 25%, 85% { opacity: 1; width: 75%; } 95%, 100% { opacity: 0; } }
        @keyframes out-line3 { 0%, 28% { opacity: 0; width: 0; } 35%, 85% { opacity: 1; width: 85%; } 95%, 100% { opacity: 0; } }
        @keyframes out-line4 { 0%, 38% { opacity: 0; width: 0; } 45%, 85% { opacity: 1; width: 60%; } 95%, 100% { opacity: 0; } }
        @keyframes out-copy {
          0%, 52% { opacity: 0; transform: scale(0.8); }
          58%, 80% { opacity: 1; transform: scale(1); }
          90%, 100% { opacity: 0; transform: scale(0.8); }
        }
      `}</style>
      <div className="w-52 bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-1.5">
        <div className="h-1.5 rounded-full bg-slate-300"
          style={{ animation: 'out-line1 7s ease-out infinite' }} />
        <div className="h-1.5 rounded-full bg-slate-200"
          style={{ animation: 'out-line2 7s ease-out infinite' }} />
        <div className="h-1.5 rounded-full bg-slate-300"
          style={{ animation: 'out-line3 7s ease-out infinite' }} />
        <div className="h-1.5 rounded-full bg-slate-200"
          style={{ animation: 'out-line4 7s ease-out infinite' }} />
      </div>
      <div className="flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white"
        style={{ animation: 'out-copy 7s ease-out infinite' }}>
        <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
        </svg>
        <span className="text-[10px] font-medium text-slate-500">Copy</span>
      </div>
    </div>
  );
}
