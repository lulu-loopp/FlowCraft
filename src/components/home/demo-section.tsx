'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Play, Layers, Lightbulb, MapPin } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { DEMO_FLOWS } from '@/lib/presets/flows';
import type { TranslationKey } from '@/lib/i18n';

const ICON_MAP: Record<string, React.ElementType> = {
  Layers, Lightbulb, MapPin,
};

export function DemoSection() {
  const { t, lang } = useUIStore();
  const router = useRouter();

  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {t('home.demoTitle' as TranslationKey)}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('home.demoSubtitle' as TranslationKey)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEMO_FLOWS.map((demo) => {
          const Icon = ICON_MAP[demo.iconName] || Layers;
          return (
            <div
              key={demo.id}
              className="group bg-white rounded-xl border border-slate-100 p-5
                hover:border-slate-300 hover:-translate-y-1 hover:shadow-lg
                transition-all duration-200 cursor-pointer"
              onClick={() => router.push(`/canvas/demo/${demo.id}`)}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${demo.iconColor}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: demo.iconColor }} />
                </div>
                <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                  {t('home.demoNodes' as TranslationKey).replace('{count}', String(demo.nodeCount))}
                </span>
              </div>

              <h3 className="font-semibold text-base text-slate-800 mb-1">
                {demo.name[lang]}
              </h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                {demo.description[lang]}
              </p>

              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2
                  bg-slate-900 text-white text-sm font-medium rounded-lg
                  hover:bg-slate-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/canvas/demo/${demo.id}`);
                }}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {t('home.demoPlay' as TranslationKey)}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
