'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { NODE_HELP } from '@/lib/presets/help';
import { NodeDemoAnimation } from './node-demo-animation';
import type { TranslationKey } from '@/lib/i18n';

interface NodeHelpModalProps {
  /** The node type key from nodeTypes registry (e.g., 'agent', 'io', 'condition') */
  nodeType: string;
  onClose: () => void;
}

export function NodeHelpModal({ nodeType, onClose }: NodeHelpModalProps) {
  const { t, lang } = useUIStore();
  const router = useRouter();
  const help = NODE_HELP[nodeType];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!help) return null;

  const content = (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[150] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto animate-fade-in-up mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl">
          <span className="font-semibold text-slate-800">{help.title[lang]}</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Animation demo area */}
        <div className="mx-6 mt-4 h-[180px] bg-slate-50 rounded-xl p-4 flex items-center justify-center overflow-hidden">
          <NodeDemoAnimation animationType={help.animationType} />
        </div>

        {/* Description */}
        <div className="px-6 mt-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-1.5">
            {t('help.whatItDoes' as TranslationKey)}
          </h4>
          <p className="text-sm text-slate-600 leading-relaxed">
            {help.description[lang]}
          </p>
        </div>

        {/* Use cases */}
        <div className="px-6 mt-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-1.5">
            {t('help.useCases' as TranslationKey)}
          </h4>
          <ul className="space-y-1">
            {help.useCases[lang].map((uc, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-slate-600">
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                {uc}
              </li>
            ))}
          </ul>
        </div>

        {/* Recommended pairs */}
        {help.recommendedPairs.length > 0 && (
          <div className="px-6 mt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-1.5">
              {t('help.recommendedPairs' as TranslationKey)}
            </h4>
            <div className="flex flex-wrap gap-2">
              {help.recommendedPairs.map((pairType) => {
                const pairHelp = NODE_HELP[pairType];
                if (!pairHelp) return null;
                return (
                  <button
                    key={pairType}
                    onClick={() => onClose()}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600
                      hover:bg-slate-200 hover:scale-105 transition-all"
                  >
                    {pairHelp.title[lang]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Demo button */}
        {help.demoFlowId && (
          <div className="px-6 mt-5 pb-6">
            <button
              onClick={() => {
                onClose();
                router.push(`/canvas/demo/${help.demoFlowId}`);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                bg-slate-900 text-white text-sm font-medium rounded-lg
                hover:bg-slate-700 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {t('help.tryDemo' as TranslationKey)}
            </button>
          </div>
        )}

        {/* Bottom padding when no demo button */}
        {!help.demoFlowId && <div className="h-6" />}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
