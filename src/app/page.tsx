'use client';

import React from 'react';
import Link from 'next/link';
import { Settings, GitBranch, BarChart3 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { FlowCard } from '@/components/home/flow-card';
import { NewFlowButton } from '@/components/home/new-flow-button';
import { ImportYamlButton } from '@/components/home/import-yaml-button';
import { DemoSection } from '@/components/home/demo-section';
import { TrashSection } from '@/components/home/trash-section';
import type { FlowMeta } from '@/types/flow';

export default function Home() {
  const { t, lang, setLang } = useUIStore();
  const [flows, setFlows] = React.useState<FlowMeta[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchFlows = React.useCallback(async () => {
    try {
      const res = await fetch('/api/flows');
      if (res.ok) {
        const data = await res.json();
        setFlows(data);
      }
    } catch {}
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/flows/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFlows((prev) => prev.filter((f) => f.id !== id));
      }
    } catch {}
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm shadow-teal-200">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="4" cy="10" r="2.5" fill="white"/>
              <circle cx="16" cy="5" r="2.5" fill="white"/>
              <circle cx="16" cy="15" r="2.5" fill="white"/>
              <path d="M6.5 10H10M13.5 5H10M10 10V5M13.5 15H10M10 10V15" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-semibold text-slate-900 tracking-tight">FlowCraft</span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/playground"
            className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            {t('home.playground')}
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            {t('home.dashboard')}
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Settings className="w-4 h-4" />
            {t('home.settings')}
          </Link>
          <button
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-colors"
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto py-10 px-6">
        {/* Title row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{t('home.myFlows')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('home.tagline')}</p>
          </div>
          <div className="flex items-center gap-2">
            <ImportYamlButton />
            <NewFlowButton />
          </div>
        </div>

        {/* Demo section */}
        <DemoSection />

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && flows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <GitBranch className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">{t('home.noFlows')}</p>
              <p className="text-sm text-slate-400 mt-1">{t('home.noFlowsHint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <ImportYamlButton />
              <NewFlowButton />
            </div>
          </div>
        )}

        {/* Flow grid */}
        {!loading && flows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {flows.map((flow) => (
              <FlowCard key={flow.id} flow={flow} onDelete={handleDelete} onRenamed={fetchFlows} />
            ))}
          </div>
        )}

        {/* Recycle bin */}
        {!loading && <TrashSection onRestored={fetchFlows} />}
      </main>
    </div>
  );
}
