'use client';

import React from 'react';
import { Home, Play, BookmarkPlus, Square } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { useRunTimer } from '@/hooks/useRunTimer';
import type { TranslationKey } from '@/lib/i18n';

interface DemoToolbarProps {
  demoName: string;
  onRerun: () => void;
  onSaveAsFlow: () => void;
}

export function DemoToolbar({ demoName, onRerun, onSaveAsFlow }: DemoToolbarProps) {
  const router = useRouter();
  const { isRunning, setIsRunning } = useFlowStore();
  const { t, lang, setLang } = useUIStore();
  const elapsed = useRunTimer(isRunning);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => router.push('/')}
          title={t('toolbar.home')}
          className="flex items-center justify-center w-7 h-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Home className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center shadow-sm">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <circle cx="4" cy="10" r="2.5" fill="white"/>
              <circle cx="16" cy="5" r="2.5" fill="white"/>
              <circle cx="16" cy="15" r="2.5" fill="white"/>
              <path d="M6.5 10H10M13.5 5H10M10 10V5M13.5 15H10M10 10V15" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-semibold text-sm text-slate-900 tracking-tight">FlowCraft</span>
        </div>

        <div className="h-4 w-px bg-slate-200 shrink-0" />

        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
          {t('demo.badge' as TranslationKey)}
        </Badge>

        <span className="text-sm font-medium text-slate-700 truncate">{demoName}</span>
      </div>

      {/* Center: running status */}
      <div className="flex items-center">
        {isRunning && (
          <Badge variant="outline" className="animate-pulse border-teal-200 bg-teal-50 text-teal-700">
            {t('toolbar.running')}… {elapsed && <span className="ml-1 font-mono text-teal-600">{elapsed}</span>}
          </Badge>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md border border-slate-200 hover:border-slate-300 bg-white/60 transition-colors"
        >
          {lang === 'en' ? '中文' : 'EN'}
        </button>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-slate-200 text-slate-700"
          onClick={onSaveAsFlow}
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('demo.saveAsMyFlow' as TranslationKey)}</span>
        </Button>

        {isRunning ? (
          <Button size="sm" variant="danger" onClick={() => setIsRunning(false)} className="gap-1.5">
            <Square className="w-3.5 h-3.5 fill-current" />
            {t('toolbar.stop')}
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={onRerun} className="gap-1.5">
            <Play className="w-3.5 h-3.5 fill-current" />
            {t('toolbar.runFlow')}
          </Button>
        )}
      </div>
    </header>
  );
}
