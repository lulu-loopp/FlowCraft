'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, X, Pencil } from 'lucide-react';
import { useFlowStore } from '@/store/flowStore';
import { useFlowPersistence } from '@/hooks/useFlowPersistence';
import { useFlowExecution } from '@/hooks/useFlowExecution';
import { RunFromNodeContext } from '@/hooks/useRunFromNode';
import { FlowEditor } from '@/components/canvas/flow-editor';
import { TopToolbar } from '@/components/layout/top-toolbar';
import { LeftPanel } from '@/components/layout/left-panel';
import { RightPanel } from '@/components/layout/right-panel';
import { BottomPanel } from '@/components/layout/bottom-panel';
import { AIGenerateOrb } from '@/components/canvas/ai-generate-orb';
import { useUIStore } from '@/store/uiStore';
import type { TranslationKey } from '@/lib/i18n';

function useAIFlyInAnimation(flowId: string) {
  const [banner, setBanner] = React.useState<{ nodeCount: number } | null>(null);
  const firedRef = React.useRef(false);
  const storeNodes = useFlowStore(s => s.nodes);

  React.useEffect(() => {
    // Already fired this animation, or nodes not loaded yet
    if (firedRef.current || storeNodes.length === 0) return;

    // Check sessionStorage — read without removing so strict-mode double-run is safe
    const animateId = sessionStorage.getItem('flowcraft-animate');
    if (animateId !== flowId) return;

    // Mark as consumed
    firedRef.current = true;
    sessionStorage.removeItem('flowcraft-animate');

    // Give ReactFlow a frame + small buffer to render DOM nodes
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        const nodeEls = document.querySelectorAll<HTMLElement>('.react-flow__node');
        if (nodeEls.length === 0) return;

        // Sort nodes left-to-right by their transform x position
        const sorted = Array.from(nodeEls).sort((a, b) => {
          const ax = parseFloat(a.style.transform?.match(/translate\(([^,]+)/)?.[1] || '0');
          const bx = parseFloat(b.style.transform?.match(/translate\(([^,]+)/)?.[1] || '0');
          return ax - bx;
        });

        // Hide all edges initially
        const edgeContainer = document.querySelector('.react-flow__edges');
        if (edgeContainer instanceof HTMLElement) {
          edgeContainer.style.opacity = '0';
          edgeContainer.style.transition = 'opacity 0.3s ease-in';
        }

        // Apply staggered fly-in animation
        sorted.forEach((el, i) => {
          el.classList.add('node-fly-in');
          el.style.animationDelay = `${i * 150}ms`;
        });

        // Show edges + banner after all nodes have appeared
        const totalDelay = sorted.length * 150 + 300;
        setTimeout(() => {
          if (edgeContainer instanceof HTMLElement) {
            edgeContainer.style.opacity = '1';
          }
          setBanner({ nodeCount: sorted.length });
        }, totalDelay);
      }, 150);
    });

    return () => cancelAnimationFrame(raf);
  }, [flowId, storeNodes]);

  const dismissBanner = React.useCallback(() => setBanner(null), []);

  return { banner, dismissBanner };
}

export default function CanvasPage() {
  const params = useParams();
  const flowId = params.flowId as string;
  const { loadFlow, saveFlow } = useFlowPersistence(flowId);
  const { runFromNode, runSingleNode } = useFlowExecution();
  const { banner, dismissBanner } = useAIFlyInAnimation(flowId);
  const { t } = useUIStore();

  React.useEffect(() => {
    useFlowStore.getState().setFlowId(flowId);
    loadFlow();
    return () => {
      useFlowStore.getState().resetForNewFlow();
    };
  }, [flowId, loadFlow]);

  return (
    <RunFromNodeContext.Provider value={{ runFromNode, runSingleNode }}>
    <div className="w-screen h-[100dvh] flex flex-col overflow-hidden bg-white">
      <TopToolbar />
      <div className="flex flex-1 min-h-0">
        <LeftPanel />
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-slate-50 relative">
          {banner && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50
                            flex items-center gap-3 px-4 py-2.5
                            bg-slate-800/90 backdrop-blur-md rounded-full
                            border border-slate-700 shadow-xl animate-fade-in-up">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-slate-200">
                {t('home.aiGeneratedBanner' as TranslationKey).replace('{count}', String(banner.nodeCount))}
              </span>
              <div className="w-[1px] h-4 bg-slate-600" />
              <button
                onClick={dismissBanner}
                className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {t('home.aiGeneratedEdit' as TranslationKey)}
              </button>
              <button
                onClick={dismissBanner}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <FlowEditor onSave={saveFlow} />
          <BottomPanel />
        </div>
        <RightPanel />
      </div>
      <AIGenerateOrb flowId={flowId} />
    </div>
    </RunFromNodeContext.Provider>
  );
}
