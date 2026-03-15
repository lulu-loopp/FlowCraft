'use client';

import React from 'react';
import { Play, Save, Share2, Square } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';

export function TopToolbar() {
  const [flowName, setFlowName] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);
  const { isRunning, setIsRunning, simulateRun } = useFlowStore();
  const { t, lang, setLang } = useUIStore();

  const inputRef = React.useRef<HTMLInputElement>(null);

  const displayName = flowName || t('toolbar.untitledFlow');

  React.useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') inputRef.current?.blur();
  };

  return (
    <header
      className="absolute top-4 left-4 right-4 h-14 glass-panel rounded-2xl flex items-center justify-between px-5"
      style={{ zIndex: 'var(--z-toolbar)' } as React.CSSProperties}
    >
      {/* Left: brand + flow name */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Brand mark */}
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

        {/* Editable flow name */}
        <input
          ref={inputRef}
          type="text"
          value={flowName}
          placeholder={t('toolbar.untitledFlow')}
          onChange={(e) => setFlowName(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="bg-transparent border-none text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0 w-48 min-w-0 truncate"
        />
      </div>

      {/* Center: running badge */}
      <div className="flex items-center">
        {isRunning && (
          <Badge variant="outline" className="animate-pulse border-teal-200 bg-teal-50 text-teal-700">
            {t('toolbar.running')}…
          </Badge>
        )}
      </div>

      {/* Right: actions + lang toggle */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md border border-slate-200 hover:border-slate-300 bg-white/60 transition-colors"
        >
          {lang === 'en' ? '中文' : 'EN'}
        </button>

        <Button variant="ghost" size="sm" className="hidden md:flex gap-1.5 text-slate-600">
          <Save className="w-3.5 h-3.5" />
          {t('toolbar.save')}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="hidden border-slate-200 text-slate-700 hover:bg-slate-50 sm:flex gap-1.5"
        >
          <Share2 className="w-3.5 h-3.5" />
          {t('toolbar.publishApi')}
        </Button>

        <Button
          size="sm"
          variant={isRunning ? 'danger' : 'primary'}
          onClick={() => (isRunning ? setIsRunning(false) : simulateRun())}
          className="gap-1.5"
        >
          {isRunning ? (
            <><Square className="w-3.5 h-3.5 fill-current" /> {t('toolbar.stop')}</>
          ) : (
            <><Play className="w-3.5 h-3.5 fill-current" /> {t('toolbar.runFlow')}</>
          )}
        </Button>
      </div>
    </header>
  );
}
