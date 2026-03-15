'use client';

import { FlowEditor } from '@/components/canvas/flow-editor';
import { TopToolbar } from '@/components/layout/top-toolbar';
import { LeftPanel } from '@/components/layout/left-panel';
import { RightPanel } from '@/components/layout/right-panel';
import { BottomPanel } from '@/components/layout/bottom-panel';

export default function CanvasPage() {
  return (
    <div className="w-screen h-screen relative overflow-hidden bg-slate-50/50">
      <TopToolbar />
      <LeftPanel />
      <FlowEditor />
      <RightPanel />
      <BottomPanel />
    </div>
  );
}
