'use client';
import React from 'react';

export function ConditionDemo({ className }: { className?: string }) {
  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className ?? ''}`}>
      <style>{`
        @keyframes cond-in {
          0%, 5% { opacity: 0; left: 5%; }
          12%, 25% { opacity: 1; left: 30%; }
          30%, 100% { opacity: 0; }
        }
        @keyframes cond-diamond {
          0%, 10% { border-color: rgb(148 163 184 / 0.4); }
          18%, 35% { border-color: rgb(99 102 241 / 0.9); }
          45%, 55% { border-color: rgb(148 163 184 / 0.4); }
          60%, 75% { border-color: rgb(249 115 22 / 0.9); }
          85%, 100% { border-color: rgb(148 163 184 / 0.4); }
        }
        @keyframes cond-true {
          0%, 35% { opacity: 0.2; }
          40%, 50% { opacity: 1; }
          55%, 100% { opacity: 0.2; }
        }
        @keyframes cond-false {
          0%, 55% { opacity: 0.2; }
          60%, 75% { opacity: 1; }
          80%, 100% { opacity: 0.2; }
        }
        @keyframes cond-true-particle {
          0%, 38% { opacity: 0; left: 55%; }
          45% { opacity: 1; left: 55%; }
          52% { opacity: 1; left: 85%; }
          55%, 100% { opacity: 0; left: 85%; }
        }
        @keyframes cond-loop-particle {
          0%, 58% { opacity: 0; }
          62% { opacity: 1; left: 55%; top: 75%; }
          70% { opacity: 1; left: 45%; top: 85%; }
          78% { opacity: 1; left: 20%; top: 75%; }
          84% { opacity: 0.6; left: 20%; top: 50%; }
          88%, 100% { opacity: 0; left: 30%; top: 45%; }
        }
        @keyframes cond-loop-label {
          0%, 55% { opacity: 0; }
          60%, 80% { opacity: 1; }
          85%, 100% { opacity: 0; }
        }
      `}</style>

      {/* Input particle */}
      <div className="absolute w-3 h-3 rounded-full bg-slate-400"
        style={{ animation: 'cond-in 10s ease-in-out infinite', top: '45%' }} />

      {/* Diamond */}
      <div className="w-14 h-14 border-2 border-slate-300 bg-slate-50 flex items-center justify-center"
        style={{ transform: 'rotate(45deg)', animation: 'cond-diamond 10s ease-in-out infinite' }}>
        <span className="text-xs font-bold text-slate-600" style={{ transform: 'rotate(-45deg)' }}>IF</span>
      </div>

      {/* True branch */}
      <div className="absolute right-6 top-4 flex flex-col items-start gap-1"
        style={{ animation: 'cond-true 10s ease-in-out infinite' }}>
        <div className="flex items-center gap-1">
          <div className="w-8 h-0.5 bg-emerald-400" />
          <div className="px-2 py-1 rounded bg-emerald-100 border border-emerald-300">
            <span className="text-[10px] font-bold text-emerald-700">TRUE</span>
          </div>
        </div>
      </div>

      {/* False branch */}
      <div className="absolute right-6 bottom-4 flex flex-col items-start gap-1"
        style={{ animation: 'cond-false 10s ease-in-out infinite' }}>
        <div className="flex items-center gap-1">
          <div className="w-8 h-0.5 bg-orange-400" style={{ strokeDasharray: '4 2' }} />
          <div className="px-2 py-1 rounded bg-orange-50 border border-orange-300">
            <span className="text-[10px] font-bold text-orange-600">LOOP</span>
          </div>
        </div>
      </div>

      {/* True particle */}
      <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500"
        style={{ animation: 'cond-true-particle 10s ease-in-out infinite', top: '22%' }} />

      {/* Loop particle (goes back to left) */}
      <div className="absolute w-2.5 h-2.5 rounded-full bg-orange-500"
        style={{ animation: 'cond-loop-particle 10s ease-in-out infinite' }} />

      {/* Loop label */}
      <div className="absolute left-2 bottom-1 text-[9px] font-medium text-orange-500"
        style={{ animation: 'cond-loop-label 10s ease-in-out infinite' }}>
        ↻ retry
      </div>
    </div>
  );
}
