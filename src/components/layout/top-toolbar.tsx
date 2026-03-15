'use client';

import React from 'react';
import { Play, Save, Share2, Square } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { useFlowExecution } from '@/hooks/useFlowExecution';

export function TopToolbar() {
  const [flowName, setFlowName] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);
  const [showInputDialog, setShowInputDialog] = React.useState(false);
  const [flowInput, setFlowInput] = React.useState('');

  const { isRunning, setIsRunning } = useFlowStore();
  const { t, lang, setLang } = useUIStore();
  const { runFlow } = useFlowExecution();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const displayName = flowName || t('toolbar.untitledFlow');

  React.useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  React.useEffect(() => {
    if (showInputDialog) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [showInputDialog]);

  const handleRun = () => {
    if (isRunning) {
      setIsRunning(false);
      return;
    }
    setShowInputDialog(true);
  };

  const handleConfirmRun = () => {
    setShowInputDialog(false);
    runFlow(flowInput.trim() || undefined);
    setFlowInput('');
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setShowInputDialog(false);
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && flowInput.trim()) handleConfirmRun();
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0">
        {/* Left: brand + flow name */}
        <div className="flex items-center gap-3 min-w-0">
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

          <input
            ref={inputRef}
            type="text"
            value={flowName}
            placeholder={t('toolbar.untitledFlow')}
            onChange={(e) => setFlowName(e.target.value)}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.blur(); }}
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
            onClick={handleRun}
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

      {/* Goal input dialog */}
      {showInputDialog && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowInputDialog(false); }}
          onKeyDown={handleDialogKeyDown}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[480px] mx-4">
            <h3 className="font-semibold text-slate-800 mb-1">What's your goal?</h3>
            <p className="text-sm text-slate-500 mb-4">
              This will be passed as input to the first agent node.
            </p>
            <textarea
              ref={textareaRef}
              className="w-full h-28 p-3 text-sm border border-slate-200 rounded-lg resize-none outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g. Research the latest AI agent frameworks..."
              value={flowInput}
              onChange={e => setFlowInput(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1.5">⌘↵ to run</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowInputDialog(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRun}
                disabled={!flowInput.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                Run Flow
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
