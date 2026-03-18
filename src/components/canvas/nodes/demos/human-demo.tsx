'use client';
import React from 'react';

export function HumanDemo({ className }: { className?: string }) {
  return (
    <div className={`relative w-full h-full flex items-center justify-center gap-3 ${className ?? ''}`}>
      <style>{`
        @keyframes human-flow-in {
          0%, 8% { opacity: 0; transform: translateX(-20px); }
          15%, 30% { opacity: 1; transform: translateX(0); }
          35%, 100% { opacity: 0; }
        }
        @keyframes human-pulse {
          0%, 20% { opacity: 0; box-shadow: none; }
          25%, 55% { opacity: 1; box-shadow: 0 0 12px rgb(245 158 11 / 0.5); }
          60%, 100% { opacity: 0.3; box-shadow: none; }
        }
        @keyframes human-ring {
          25%, 35% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.6); opacity: 0; }
          0%, 24%, 51%, 100% { transform: scale(1); opacity: 0; }
        }
        @keyframes human-approve {
          0%, 52% { opacity: 0; transform: scale(0.5); }
          58%, 75% { opacity: 1; transform: scale(1); }
          85%, 100% { opacity: 0; }
        }
        @keyframes human-flow-out {
          0%, 60% { opacity: 0; transform: translateX(0); }
          68%, 80% { opacity: 1; transform: translateX(0); }
          90%, 100% { opacity: 0; transform: translateX(20px); }
        }
      `}</style>
      <div className="w-3 h-3 rounded-full bg-rose-400"
        style={{ animation: 'human-flow-in 7s ease-in-out infinite' }} />
      <div className="relative flex flex-col items-center gap-1">
        <div className="absolute inset-0 rounded-xl border-2 border-amber-400"
          style={{ animation: 'human-ring 7s ease-out infinite' }} />
        <div className="w-20 h-16 rounded-xl border-2 border-amber-400 bg-amber-50 flex flex-col items-center justify-center"
          style={{ animation: 'human-pulse 7s ease-in-out infinite' }}>
          <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-7 8-7s8 3 8 7" /></svg>
          <span className="text-[9px] font-semibold text-amber-600 mt-0.5">Approval?</span>
        </div>
        <div className="w-12 h-5 rounded bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center"
          style={{ animation: 'human-approve 7s ease-out infinite' }}>
          Approve
        </div>
      </div>
      <div className="w-3 h-3 rounded-full bg-emerald-400"
        style={{ animation: 'human-flow-out 7s ease-in-out infinite' }} />
    </div>
  );
}
