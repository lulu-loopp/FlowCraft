'use client';
import React from 'react';
import { Package } from 'lucide-react';

export function PackedDemo({ className }: { className?: string }) {
  return (
    <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className ?? ''}`}>
      <style>{`
        @keyframes pd-node-scatter { 0%,7%{opacity:1;transform:translate(0,0) scale(1)} 25%,62%{opacity:0.3;transform:translate(var(--tx),var(--ty)) scale(0.7)} 75%,100%{opacity:1;transform:translate(0,0) scale(1)} }
        @keyframes pd-pack-appear { 0%,30%{opacity:0;transform:scale(0)} 40%,65%{opacity:1;transform:scale(1)} 75%,100%{opacity:0;transform:scale(0.8)} }
        @keyframes pd-progress { 0%,38%{width:0%} 62%{width:100%} 68%,100%{width:0%} }
        @keyframes pd-text-cycle { 0%,38%{opacity:0} 42%,50%{opacity:1} 52%,100%{opacity:0} }
        @keyframes pd-text-cycle2 { 0%,50%{opacity:0} 54%,62%{opacity:1} 64%,100%{opacity:0} }
        @keyframes pd-particle { 0%,38%{opacity:0;transform:translateX(0)} 55%,62%{opacity:0.8;transform:translateX(18px)} 65%,100%{opacity:0} }
        @keyframes pd-preview { 0%,63%{opacity:0;transform:translateY(6px)} 70%,87%{opacity:1;transform:translateY(0)} 93%,100%{opacity:0;transform:translateY(6px)} }
        @keyframes pd-fade-cycle { 0%,92%{opacity:1} 96%,100%{opacity:0} }
      `}</style>

      {/* Phase 1-2: scattered nodes → converge into pack */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'pd-fade-cycle 8s ease-in-out infinite' }}>
        {[
          { label: '研究员', tx: '-28px', ty: '-20px', delay: '0s', color: 'bg-indigo-100 text-indigo-600 border-indigo-300' },
          { label: '分析师', tx: '28px', ty: '-20px', delay: '0.15s', color: 'bg-teal-100 text-teal-600 border-teal-300' },
          { label: '写作助手', tx: '0px', ty: '20px', delay: '0.3s', color: 'bg-violet-100 text-violet-600 border-violet-300' },
        ].map(n => (
          <div key={n.label} className={`absolute px-2 py-1.5 rounded-lg border text-[10px] font-semibold ${n.color}`}
            style={{ '--tx': n.tx, '--ty': n.ty, animation: `pd-node-scatter 8s ease-in-out infinite ${n.delay}` } as React.CSSProperties}>
            {n.label}
          </div>
        ))}

        {/* Packed card that appears when nodes converge */}
        <div className="absolute flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 border-violet-400 bg-violet-50 shadow-lg"
          style={{ animation: 'pd-pack-appear 8s cubic-bezier(0.34,1.56,0.64,1) infinite' }}>
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-[11px] font-bold text-violet-800">竞品研究组合</span>
          </div>
          <span className="text-[9px] text-violet-500">包含 3 个节点</span>

          {/* Progress bar - phase 3 */}
          <div className="w-full h-1 bg-violet-200 rounded-full overflow-hidden mt-1">
            <div className="h-full bg-violet-500 rounded-full" style={{ animation: 'pd-progress 8s ease-in-out infinite', width: '0%' }} />
          </div>

          {/* Executing text */}
          <div className="relative h-3 w-full">
            <span className="absolute inset-0 text-[9px] text-violet-600 text-center" style={{ animation: 'pd-text-cycle 8s ease-in-out infinite' }}>正在执行：研究员...</span>
            <span className="absolute inset-0 text-[9px] text-violet-600 text-center" style={{ animation: 'pd-text-cycle2 8s ease-in-out infinite' }}>正在执行：分析师...</span>
          </div>

          {/* Input/output particles */}
          <div className="absolute -left-5 top-1/2 -translate-y-1/2 flex gap-0.5">
            {[0, 0.1, 0.2].map(d => (
              <div key={d} className="w-1 h-1 rounded-full bg-violet-400"
                style={{ animation: `pd-particle 8s ease-in-out infinite ${d}s` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Phase 4: hover preview card */}
      <div className="absolute bottom-3 right-4 w-28 rounded-lg border border-violet-200 bg-white shadow-md px-2 py-1.5 text-[9px]"
        style={{ animation: 'pd-preview 8s ease-in-out infinite' }}>
        <div className="font-semibold text-violet-700 mb-0.5">内部结构</div>
        <div className="flex items-center gap-0.5 text-slate-400">
          <span className="w-5 h-3 rounded bg-slate-100 inline-block" />
          <span>→</span>
          <span className="w-5 h-3 rounded bg-indigo-100 inline-block" />
          <span>→</span>
          <span className="w-5 h-3 rounded bg-slate-100 inline-block" />
        </div>
      </div>
    </div>
  );
}
