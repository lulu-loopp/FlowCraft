'use client';

import Link from 'next/link';
import { useUIStore } from '@/store/uiStore';

export default function Home() {
  const { t, lang, setLang } = useUIStore();

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center bg-[--color-background] px-4">
      {/* Language toggle */}
      <div className="absolute top-5 right-5">
        <button
          onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-colors"
        >
          {lang === 'en' ? '中文' : 'EN'}
        </button>
      </div>

      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-teal-600 flex items-center justify-center shadow-[0_4px_14px_rgba(13,148,136,0.3)]">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="4" cy="10" r="2.5" fill="white"/>
            <circle cx="16" cy="5" r="2.5" fill="white"/>
            <circle cx="16" cy="15" r="2.5" fill="white"/>
            <path d="M6.5 10H10M13.5 5H10M10 10V5M13.5 15H10M10 10V15" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">FlowCraft</h1>
        <p className="text-sm text-slate-500">{t('home.tagline')}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/canvas/default-flow"
          className="px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-sm shadow-teal-200"
        >
          {t('home.openCanvas')}
        </Link>
        <Link
          href="/playground"
          className="px-5 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
        >
          {t('home.playground')}
        </Link>
      </div>
    </main>
  );
}
