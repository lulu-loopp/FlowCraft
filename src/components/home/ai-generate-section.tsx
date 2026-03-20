'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import type { TranslationKey } from '@/lib/i18n';

type Complexity = 'standard' | 'professional';

export function AIGenerateSection() {
  const { t } = useUIStore();
  const router = useRouter();
  const [description, setDescription] = React.useState('');
  const [complexity, setComplexity] = React.useState<Complexity>('standard');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleGenerate = async () => {
    if (loading || !description.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/flow/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          complexity,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Generation failed');
      }

      const data = await res.json();
      sessionStorage.setItem('flowcraft-animate', data.flowId);
      router.push(`/canvas/${data.flowId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const complexityOptions: { value: Complexity; labelKey: TranslationKey }[] = [
    { value: 'standard', labelKey: 'generate.standard' as TranslationKey },
    { value: 'professional', labelKey: 'generate.professional' as TranslationKey },
  ];

  return (
    <section className="mb-10">
      <div
        className="rounded-xl border border-slate-200 bg-white overflow-hidden
                    hover:border-slate-300 transition-colors"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-slate-700">
            {t('home.aiGenerateTitle' as TranslationKey)}
          </span>
        </div>

        {/* Body */}
        <div className="p-5">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('home.aiGeneratePlaceholder' as TranslationKey)}
            disabled={loading}
            rows={3}
            className="w-full px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400
                       bg-slate-50 border border-slate-200 rounded-lg resize-none
                       focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500
                       disabled:opacity-50 transition-colors"
          />

          {/* Complexity selector */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-slate-500 shrink-0">
              {t('generate.complexity' as TranslationKey)}
            </span>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              {complexityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => !loading && setComplexity(opt.value)}
                  disabled={loading}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    complexity === opt.value
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  } disabled:opacity-50`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          )}

          <div className="flex justify-end mt-3">
            <button
              onClick={handleGenerate}
              disabled={loading || !description.trim()}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                         bg-slate-900 text-white rounded-lg
                         hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {t('home.aiGenerating' as TranslationKey)}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t('home.aiGenerateButton' as TranslationKey)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
