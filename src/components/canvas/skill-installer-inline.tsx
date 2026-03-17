'use client';

import React, { useState } from 'react';
import { Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { useRegistryStore } from '@/store/registry-store';
import { useUIStore } from '@/store/uiStore';
import type { ScannedItem } from '@/types/registry';

interface ScanResult {
  type: 'single' | 'collection';
  items: ScannedItem[];
}

type Mode = 'url' | 'paste';

export function SkillInstallerInline() {
  const { fetchSkills, isScanning, isInstallingSkill, skillError, clearSkillError } = useRegistryStore();
  const { t } = useUIStore();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('url');
  const [urlInput, setUrlInput] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError || skillError;
  const isLoading = isScanning || isInstallingSkill;

  const handleClose = () => {
    setOpen(false);
    setUrlInput('');
    setPasteInput('');
    setScanResult(null);
    setLocalError(null);
    clearSkillError();
  };

  const handleScan = async () => {
    if (!urlInput.trim() || isLoading) return;
    setLocalError(null);
    clearSkillError();
    try {
      const res = await fetch('/api/skills/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.type === 'single') {
        await installItems(data.items, urlInput.trim());
      } else {
        setScanResult(data);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const installItems = async (items: ScannedItem[], source: string) => {
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, selectedItems: items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchSkills();
      handleClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleInstallSelected = async () => {
    if (!scanResult) return;
    const selected = scanResult.items.filter(i => i.selected);
    if (selected.length === 0) return;
    await installItems(selected, urlInput.trim());
  };

  const handleManualInstall = async () => {
    if (!pasteInput.trim() || isLoading) return;
    setLocalError(null);
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'manual', manualContent: pasteInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchSkills();
      handleClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const toggleItem = (name: string) => {
    if (!scanResult) return;
    setScanResult({
      ...scanResult,
      items: scanResult.items.map(i =>
        i.name === name ? { ...i, selected: !i.selected } : i
      ),
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 mt-1 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        {t('config.installSkillsInline')}
      </button>
    );
  }

  return (
    <div className="mt-2 border border-slate-200 rounded-lg bg-white/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <div className="flex gap-1">
          {(['url', 'paste'] as Mode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setLocalError(null); clearSkillError(); setScanResult(null); }}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                mode === m
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {m === 'url' ? 'GitHub' : t('config.paste')}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {/* URL mode */}
        {mode === 'url' && !scanResult && (
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setLocalError(null); }}
              onKeyDown={e => e.key === 'Enter' && handleScan()}
              placeholder="github.com/user/repo"
              disabled={isLoading}
              className="flex-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-200 bg-white/50 outline-none focus:ring-1 focus:ring-teal-400 placeholder-slate-400 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleScan}
              disabled={isLoading || !urlInput.trim()}
              className="px-2.5 py-1.5 text-xs rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {isScanning ? '...' : t('config.scan')}
            </button>
          </div>
        )}

        {/* Scan result: select items */}
        {mode === 'url' && scanResult && (
          <div className="space-y-1.5">
            {scanResult.items.map(item => (
              <label key={item.name} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleItem(item.name)}
                  className="mt-0.5 accent-teal-600"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-slate-400 truncate">{item.description}</p>
                  )}
                </div>
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleInstallSelected}
                disabled={isLoading || !scanResult.items.some(i => i.selected)}
                className="flex-1 py-1.5 text-xs rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
              >
                {isInstallingSkill ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {t('config.install')}
              </button>
              <button
                type="button"
                onClick={() => setScanResult(null)}
                className="px-3 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('canvas.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Paste mode */}
        {mode === 'paste' && (
          <div className="space-y-2">
            <textarea
              value={pasteInput}
              onChange={e => { setPasteInput(e.target.value); setLocalError(null); }}
              placeholder={'---\nname: my-skill\ndescription: ...\n---\n\n# My Skill\n\n...'}
              rows={5}
              disabled={isLoading}
              className="w-full px-2.5 py-2 text-xs rounded-md border border-slate-200 bg-white/50 outline-none focus:ring-1 focus:ring-teal-400 font-mono resize-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleManualInstall}
              disabled={isLoading || !pasteInput.trim()}
              className="w-full py-1.5 text-xs rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
            >
              {isInstallingSkill ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {t('config.install')}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-2.5 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
