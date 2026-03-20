'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import { getDemoFlowById } from '@/lib/presets/flows';
import { DEMO_SAMPLE_OUTPUTS } from '@/lib/presets/demo-sample-outputs';
import { DemoToolbar } from '@/components/canvas/demo-toolbar';
import { DemoApiBanner } from '@/components/canvas/demo-api-banner';
import { FlowEditor } from '@/components/canvas/flow-editor';
import { LeftPanel } from '@/components/layout/left-panel';
import { RightPanel } from '@/components/layout/right-panel';
import { BottomPanel } from '@/components/layout/bottom-panel';
import { useFlowExecution } from '@/hooks/useFlowExecution';
import { RunFromNodeContext } from '@/hooks/useRunFromNode';

export default function DemoPage() {
  const params = useParams();
  const router = useRouter();
  const demoId = params.demoId as string;
  const { lang } = useUIStore();
  const { runFlow, runFromNode, runSingleNode } = useFlowExecution();
  const [hasApiKey, setHasApiKey] = React.useState<boolean | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  const demo = getDemoFlowById(demoId);

  // Load demo flow into store
  React.useEffect(() => {
    if (!demo) return;
    const store = useFlowStore.getState();
    // Resolve i18n for nodes
    const resolvedNodes = demo.nodes.map(n => {
      const data = { ...n.data } as Record<string, unknown>;
      // Resolve systemPrompt i18n
      if (data.systemPrompt && typeof data.systemPrompt === 'object') {
        const sp = data.systemPrompt as Record<string, string>;
        data.systemPrompt = sp[lang] ?? sp.zh;
      }
      // Resolve inputText i18n
      if (data.inputText && typeof data.inputText === 'object') {
        const it = data.inputText as Record<string, string>;
        data.inputText = it[lang] ?? it.zh;
      }
      return { ...n, data };
    });
    store.setNodesAndEdges(resolvedNodes, demo.edges);
    store.setFlowName(demo.name[lang]);
    store.setFlowId(demoId);
    setLoaded(true);
  }, [demo, demoId, lang]);

  // Check API key availability
  React.useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(settings => {
        const hasKey = !!(settings.deepseekApiKey || settings.anthropicApiKey || settings.openaiApiKey);
        setHasApiKey(hasKey);
      })
      .catch(() => setHasApiKey(false));
  }, []);

  // Show sample output on output node when no API key
  React.useEffect(() => {
    if (loaded && hasApiKey === false) {
      const sampleOutput = DEMO_SAMPLE_OUTPUTS[demoId];
      if (!sampleOutput) return;
      const store = useFlowStore.getState();
      const outputNode = store.nodes.find(n => n.type === 'output');
      if (outputNode) {
        store.updateNodeData(outputNode.id, 'currentOutput', sampleOutput[lang] ?? sampleOutput.zh);
        store.updateNodeData(outputNode.id, 'status', 'success');
      }
    }
  }, [loaded, hasApiKey, demoId, lang]);

  if (!demo) {
    return (
      <div className="w-screen h-[100dvh] flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Demo not found</p>
      </div>
    );
  }

  const handleSaveAsFlow = async () => {
    const store = useFlowStore.getState();
    const newId = `flow-${Date.now()}`;
    try {
      await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          name: demo.name[lang],
          nodes: store.nodes,
          edges: store.edges,
        }),
      });
      router.push(`/canvas/${newId}`);
    } catch {}
  };

  const handleRerun = () => {
    const store = useFlowStore.getState();
    store.setIsRunning(false);
    store.clearLogs();
    store.setNodesAndEdges(
      store.nodes.map(n => ({ ...n, data: { ...n.data, status: 'idle', logs: [], currentOutput: '', currentToken: '' } })),
      store.edges,
    );
    setTimeout(() => runFlow(), 300);
  };

  return (
    <RunFromNodeContext.Provider value={{ runFromNode, runSingleNode }}>
    <div className="w-screen h-[100dvh] flex flex-col overflow-hidden bg-white">
      <DemoToolbar
        demoName={demo.name[lang]}
        onRerun={handleRerun}
        onSaveAsFlow={handleSaveAsFlow}
      />
      {hasApiKey === false && <DemoApiBanner />}
      <div className="flex flex-1 min-h-0">
        <LeftPanel />
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-slate-50">
          <FlowEditor />
          <BottomPanel />
        </div>
        <RightPanel />
      </div>
    </div>
    </RunFromNodeContext.Provider>
  );
}
