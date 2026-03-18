'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, Settings } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import type { TranslationKey } from '@/lib/i18n';

export function DemoApiBanner() {
  const { t } = useUIStore();

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-sm text-amber-800">
          {t('demo.needApiKey' as TranslationKey)}
        </span>
      </div>
      <Link
        href="/settings"
        className="flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900
          bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-lg transition-colors"
      >
        <Settings className="w-3.5 h-3.5" />
        {t('demo.goSettings' as TranslationKey)}
      </Link>
    </div>
  );
}
