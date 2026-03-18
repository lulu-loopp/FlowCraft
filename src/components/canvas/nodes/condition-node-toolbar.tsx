import React from 'react';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';

interface ConditionNodeToolbarProps {
  id: string;
  isLocked: boolean;
}

export function ConditionNodeToolbar({ id, isLocked }: ConditionNodeToolbarProps) {
  const { removeNode, duplicateNode, toggleNodeLock } = useFlowStore();
  const { t } = useUIStore();

  return (
    <div
      className="absolute -top-11 left-1/2 -translate-x-1/2 z-10"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex gap-1 bg-white/95 p-1 rounded-lg shadow-xl shadow-slate-200/50 border border-slate-200 backdrop-blur-md">
        <button
          className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 active:scale-90 rounded-md transition-all"
          onClick={(e) => { e.stopPropagation(); duplicateNode(id); }}
          title={t('node.duplicate')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
        </button>
        <button
          className={`p-2 rounded-md transition-all active:scale-90 ${isLocked ? 'text-amber-500 bg-amber-50' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-50'}`}
          onClick={(e) => { e.stopPropagation(); toggleNodeLock(id); }}
          title={isLocked ? t('node.unlockPosition') : t('node.lockPosition')}
        >
          {isLocked ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
            </svg>
          )}
        </button>
        <div className="w-[1px] h-4 bg-slate-200 self-center mx-0.5" />
        <button
          className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:scale-90 rounded-md transition-all"
          onClick={(e) => { e.stopPropagation(); removeNode(id); }}
          title={t('node.delete')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
