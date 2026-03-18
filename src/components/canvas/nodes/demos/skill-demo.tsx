'use client';
import React from 'react';

export function SkillDemo({ className }: { className?: string }) {
  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center gap-2 ${className ?? ''}`}>
      <style>{`
        @keyframes skill-source {
          0%, 100% { opacity: 0.5; border-color: rgb(217 119 6 / 0.3); }
          20%, 60% { opacity: 1; border-color: rgb(217 119 6 / 0.8); }
        }
        @keyframes skill-particle {
          0%, 10% { opacity: 0; top: 28%; }
          20% { opacity: 1; top: 28%; }
          50% { opacity: 1; top: 62%; }
          60% { opacity: 0; top: 62%; }
          100% { opacity: 0; top: 62%; }
        }
        @keyframes skill-target {
          0%, 50% { opacity: 0.4; transform: scale(0.97); }
          60%, 85% { opacity: 1; transform: scale(1); }
          100% { opacity: 0.4; transform: scale(0.97); }
        }
      `}</style>
      <div className="w-36 h-10 rounded-lg border-2 border-amber-400 bg-amber-50 flex items-center justify-center gap-2"
        style={{ animation: 'skill-source 7s ease-in-out infinite' }}>
        <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h6" /></svg>
        <span className="text-xs font-semibold text-amber-700">Knowledge</span>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="absolute w-2 h-2 rounded-full bg-amber-400"
          style={{
            animation: `skill-particle 7s ease-in-out infinite ${i * 0.4}s`,
            left: `${42 + i * 8}%`,
            opacity: 0,
          }} />
      ))}
      <svg className="w-4 h-4 text-amber-300 my-0.5" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
      <div className="w-36 h-10 rounded-lg border-2 border-indigo-300 bg-indigo-50 flex items-center justify-center gap-2"
        style={{ animation: 'skill-target 7s ease-in-out infinite' }}>
        <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-7 8-7s8 3 8 7" /></svg>
        <span className="text-xs font-semibold text-indigo-600">Agent</span>
      </div>
    </div>
  );
}
