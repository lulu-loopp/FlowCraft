'use client';
import React from 'react';

export function MergeDemo({ className }: { className?: string }) {
  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className ?? ''}`}>
      <style>{`
        @keyframes merge-a {
          0%, 5% { opacity: 0; transform: translateX(-30px); }
          15%, 100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes merge-b {
          0%, 35% { opacity: 0; transform: translateX(-30px); }
          50%, 100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes merge-check-a {
          0%, 12% { opacity: 0; }
          18%, 100% { opacity: 1; }
        }
        @keyframes merge-check-b {
          0%, 47% { opacity: 0; }
          53%, 100% { opacity: 1; }
        }
        @keyframes merge-node {
          0%, 50% { border-color: rgb(148 163 184 / 0.4); background: rgb(248 250 252); }
          55%, 85% { border-color: rgb(99 102 241 / 0.7); background: rgb(238 242 255); }
          95%, 100% { border-color: rgb(148 163 184 / 0.4); background: rgb(248 250 252); }
        }
        @keyframes merge-out {
          0%, 58% { opacity: 0; transform: translateX(0); }
          65%, 80% { opacity: 1; transform: translateX(0); }
          90%, 100% { opacity: 0; transform: translateX(24px); }
        }
      `}</style>
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5"
            style={{ animation: 'merge-a 7s ease-out infinite' }}>
            <div className="px-2 py-1 rounded bg-indigo-100 border border-indigo-300 flex items-center gap-1">
              <span className="text-[10px] font-bold text-indigo-600">A</span>
              <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="3"
                style={{ animation: 'merge-check-a 7s ease-out infinite' }}>
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-1.5"
            style={{ animation: 'merge-b 7s ease-out infinite' }}>
            <div className="px-2 py-1 rounded bg-violet-100 border border-violet-300 flex items-center gap-1">
              <span className="text-[10px] font-bold text-violet-600">B</span>
              <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="3"
                style={{ animation: 'merge-check-b 7s ease-out infinite' }}>
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
          </div>
        </div>
        <div className="w-14 h-14 rounded-xl border-2 flex items-center justify-center"
          style={{ animation: 'merge-node 7s ease-in-out infinite' }}>
          <svg className="w-6 h-6 text-slate-500" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <path d="M6 4v16M18 12H6M18 12l-4-4M18 12l-4 4" />
          </svg>
        </div>
        <div className="w-3 h-3 rounded-full bg-indigo-400"
          style={{ animation: 'merge-out 7s ease-in-out infinite' }} />
      </div>
    </div>
  );
}
