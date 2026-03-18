'use client';
import React from 'react';

export function AgentDemo({ className }: { className?: string }) {
  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className ?? ''}`}>
      <style>{`
        @keyframes agent-phase {
          0%, 100% { opacity: 0.25; transform: scale(0.95); }
          10%, 30% { opacity: 1; transform: scale(1); }
        }
        @keyframes agent-arrow {
          0%, 100% { opacity: 0.2; }
          15%, 25% { opacity: 0.8; }
        }
      `}</style>
      <div className="flex items-center gap-2">
        {[
          { label: 'Think', delay: '0s', color: 'bg-indigo-100 text-indigo-600 border-indigo-300' },
          { label: 'Act', delay: '2s', color: 'bg-indigo-100 text-indigo-600 border-indigo-300' },
          { label: 'Observe', delay: '4s', color: 'bg-indigo-100 text-indigo-600 border-indigo-300' },
        ].map((phase, i) => (
          <React.Fragment key={phase.label}>
            {i > 0 && (
              <svg className="w-4 h-4 text-indigo-300 shrink-0" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: `agent-arrow 6s ease-in-out infinite ${phase.delay}` }}>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-14 h-14 rounded-xl border ${phase.color} flex items-center justify-center text-xs font-bold`}
                style={{ animation: `agent-phase 6s ease-in-out infinite ${phase.delay}` }}>
                {phase.label.charAt(0)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{phase.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
      <svg className="absolute bottom-3 right-6 w-5 h-5 text-indigo-300" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" />
        <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
    </div>
  );
}
