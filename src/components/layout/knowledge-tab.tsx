'use client'

import React from 'react'
import { BookOpen } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

export function KnowledgeTab() {
  const { t } = useUIStore()

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <BookOpen className="w-12 h-12 text-slate-200" />
      <p className="text-sm text-slate-500 text-center">
        {t('knowledge.comingSoon')}
      </p>
      <p className="text-xs text-slate-400 text-center">
        {t('knowledge.description')}
      </p>
      <div className="text-xs text-slate-400 mt-2 space-y-1">
        <p className="font-medium text-slate-500">{t('knowledge.upcoming')}</p>
        <p>· PDF / Word / {t('knowledge.webLinks')}</p>
        <p>· {t('knowledge.autoRetrieval')}</p>
        <p>· {t('knowledge.personalPublic')}</p>
      </div>
    </div>
  )
}
