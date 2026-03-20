'use client';
import React from 'react';

export function DispatcherDemo({ className }: { className?: string }) {
  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className ?? ''}`}>
      <style>{`
        @keyframes disp-in {
          0%, 5% { opacity: 0; transform: translateX(-20px); }
          15%, 100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes disp-node {
          0%, 15% { border-color: rgb(148 163 184 / 0.4); background: rgb(248 250 252); }
          20%, 35% { border-color: rgb(20 184 166 / 0.7); background: rgb(240 253 250); }
          45%, 100% { border-color: rgb(20 184 166 / 0.4); background: rgb(248 250 252); }
        }
        @keyframes disp-out-a {
          0%, 35% { opacity: 0; transform: translateX(0); }
          45%, 85% { opacity: 1; transform: translateX(0); }
          95%, 100% { opacity: 0; }
        }
        @keyframes disp-out-b {
          0%, 40% { opacity: 0; transform: translateX(0); }
          50%, 85% { opacity: 1; transform: translateX(0); }
          95%, 100% { opacity: 0; }
        }
        @keyframes disp-out-c {
          0%, 45% { opacity: 0; transform: translateX(0); }
          55%, 85% { opacity: 1; transform: translateX(0); }
          95%, 100% { opacity: 0; }
        }
      `}</style>
      <div className="flex items-center gap-3">
        {/* Input blob */}
        <div className="px-2.5 py-1.5 rounded bg-slate-100 border border-slate-300"
          style={{ animation: 'disp-in 6s ease-out infinite' }}>
          <span className="text-[10px] font-bold text-slate-600">ALL</span>
        </div>

        {/* Dispatcher node */}
        <div className="w-12 h-12 rounded-xl border-2 flex items-center justify-center"
          style={{ animation: 'disp-node 6s ease-in-out infinite' }}>
          <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </div>

        {/* Split outputs */}
        <div className="flex flex-col gap-1.5">
          <div className="px-2 py-1 rounded bg-indigo-100 border border-indigo-300 flex items-center gap-1"
            style={{ animation: 'disp-out-a 6s ease-out infinite' }}>
            <span className="text-[9px] font-bold text-indigo-600">A</span>
            <span className="text-[8px] text-indigo-400">task-1</span>
          </div>
          <div className="px-2 py-1 rounded bg-emerald-100 border border-emerald-300 flex items-center gap-1"
            style={{ animation: 'disp-out-b 6s ease-out infinite' }}>
            <span className="text-[9px] font-bold text-emerald-600">B</span>
            <span className="text-[8px] text-emerald-400">task-2</span>
          </div>
          <div className="px-2 py-1 rounded bg-amber-100 border border-amber-300 flex items-center gap-1"
            style={{ animation: 'disp-out-c 6s ease-out infinite' }}>
            <span className="text-[9px] font-bold text-amber-600">C</span>
            <span className="text-[8px] text-amber-400">task-3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
