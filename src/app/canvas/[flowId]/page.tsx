'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useFlowStore } from '@/store/flowStore';
import { useFlowPersistence } from '@/hooks/useFlowPersistence';
import { FlowEditor } from '@/components/canvas/flow-editor';
import { TopToolbar } from '@/components/layout/top-toolbar';
import { LeftPanel } from '@/components/layout/left-panel';
import { RightPanel } from '@/components/layout/right-panel';
import { BottomPanel } from '@/components/layout/bottom-panel';

export default function CanvasPage() {
  const params = useParams();
  const flowId = params.flowId as string;
  const { loadFlow, saveFlow } = useFlowPersistence(flowId);

  React.useEffect(() => {
    useFlowStore.getState().setFlowId(flowId);
    loadFlow();
    return () => {
      // Clean up transient state when leaving this flow
      useFlowStore.getState().resetForNewFlow();
    };
  }, [flowId, loadFlow]);

  return (
    <div className="w-screen h-[100dvh] flex flex-col overflow-hidden bg-white">
      <TopToolbar />
      <div className="flex flex-1 min-h-0">
        <LeftPanel />
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-slate-50">
          <FlowEditor onSave={saveFlow} />
          <BottomPanel />
        </div>
        <RightPanel />
      </div>
    </div>
  );
}
