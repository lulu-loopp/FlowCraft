'use client';

import React from 'react';
import { Sparkles, X, MessageCircle } from 'lucide-react';
import { useFlowStore } from '@/store/flowStore';
import { useUIStore } from '@/store/uiStore';
import type { TranslationKey } from '@/lib/i18n';

type Complexity = 'standard' | 'professional';
type OrbState = 'idle' | 'thinking' | 'generating' | 'done';

/* ── CSS blur blob orb ───────────────────────────────────────── */

function SiriOrb({ state }: { state: OrbState }) {
  return (
    <div className={`orb-state-${state}`}>
      <div className="orb-wrap">
        <div className="orb-blobs">
          <div className="orb-blob orb-b1" />
          <div className="orb-blob orb-b2" />
          <div className="orb-blob orb-b3" />
          <div className="orb-blob orb-b4" />
          <div className="orb-blob orb-b5" />
        </div>
        <div className="orb-core" />
        <div className="orb-highlight" />
      </div>
    </div>
  );
}

/* ── Generate dialog ─────────────────────────────────────────── */

function GenerateDialog({
  flowId,
  onClose,
  onGenerated,
}: {
  flowId: string;
  onClose: () => void;
  onGenerated: (nodeCount: number) => void;
}) {
  const { t } = useUIStore();
  const nodes = useFlowStore((s) => s.nodes);
  const [description, setDescription] = React.useState('');
  const [complexity, setComplexity] = React.useState<Complexity>('standard');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [orbState, setOrbState] = React.useState<OrbState>('idle');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const hasNodes = nodes.length > 0;

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleGenerate = async () => {
    if (loading || !description.trim()) return;
    setLoading(true);
    setError('');
    setOrbState('thinking');

    try {
      const res = await fetch('/api/flow/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          flowId,
          complexity,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Generation failed');
      }

      const store = useFlowStore.getState();
      // Clear canvas for fresh generation
      store.setNodesAndEdges([], []);

      // Track appeared node IDs for edge queue
      const appearedNodes = new Set<string>();
      const pendingEdges: Array<{ id: string; source: string; target: string; [k: string]: unknown }> = [];
      let nodeCount = 0;

      // Flush any pending edges whose endpoints are now both present
      const flushPendingEdges = () => {
        for (let i = pendingEdges.length - 1; i >= 0; i--) {
          const pe = pendingEdges[i];
          if (appearedNodes.has(pe.source) && appearedNodes.has(pe.target)) {
            pendingEdges.splice(i, 1);
            store.addSingleEdge(pe as Parameters<typeof store.addSingleEdge>[0]);
          }
        }
      };

      // Parse SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (double-newline separated)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const eventMatch = part.match(/^event:\s*(.+)$/m);
          const dataMatch = part.match(/^data:\s*(.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1].trim();
          let payload: Record<string, unknown>;
          try { payload = JSON.parse(dataMatch[1]); } catch { continue; }

          switch (event) {
            case 'status': {
              const phase = payload.phase as string;
              if (phase === 'thinking') setOrbState('thinking');
              if (phase === 'generating') setOrbState('generating');
              break;
            }

            case 'meta': {
              store.setFlowName((payload.name as string) || 'Untitled Flow');
              break;
            }

            case 'node': {
              // Add node with _skeleton flag → skeleton renders first
              const nodeData = payload as { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> };
              store.addNode({
                id: nodeData.id,
                type: nodeData.type,
                position: nodeData.position,
                data: { ...nodeData.data, _skeleton: true, _assembleIn: true },
              });
              nodeCount++;
              appearedNodes.add(nodeData.id);

              // After 300ms, reveal real content (remove _skeleton)
              setTimeout(() => {
                const s = useFlowStore.getState();
                s.setNodes(s.nodes.map(n =>
                  n.id === nodeData.id
                    ? { ...n, data: { ...n.data, _skeleton: false } }
                    : n
                ));
              }, 300);

              // After 550ms, remove assemble-in class
              setTimeout(() => {
                const s = useFlowStore.getState();
                s.setNodes(s.nodes.map(n =>
                  n.id === nodeData.id
                    ? { ...n, data: { ...n.data, _assembleIn: false } }
                    : n
                ));
              }, 550);

              // Check if any pending edges can now be added
              flushPendingEdges();
              break;
            }

            case 'edge': {
              const edgeData = payload as { id: string; source: string; target: string; [k: string]: unknown };
              if (appearedNodes.has(edgeData.source) && appearedNodes.has(edgeData.target)) {
                store.addSingleEdge(edgeData as Parameters<typeof store.addSingleEdge>[0]);
              } else {
                pendingEdges.push(edgeData);
              }
              break;
            }

            case 'done': {
              setOrbState('done');
              setTimeout(() => {
                onGenerated(nodeCount);
                onClose();
              }, 500);
              break;
            }

            case 'error': {
              throw new Error((payload.message as string) || 'Generation failed');
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setOrbState('idle');
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
    if (e.key === 'Escape') onClose();
  };

  const complexityOptions: { value: Complexity; labelKey: TranslationKey }[] = [
    { value: 'standard', labelKey: 'generate.standard' as TranslationKey },
    { value: 'professional', labelKey: 'generate.professional' as TranslationKey },
  ];

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in-up">
        {/* Header with orb */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-amber-500" />
            <span className="font-semibold text-sm text-slate-800">
              {t((hasNodes ? 'canvas.aiModifyTitle' : 'home.aiGenerateTitle') as TranslationKey)}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <textarea
            ref={textareaRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t((hasNodes ? 'canvas.aiModifyPlaceholder' : 'home.aiGeneratePlaceholder') as TranslationKey)}
            disabled={loading}
            rows={4}
            className="w-full px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400
                       bg-slate-50 border border-slate-200 rounded-xl resize-none
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

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          <div className="flex justify-end mt-4">
            <button
              onClick={handleGenerate}
              disabled={loading || !description.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium
                         bg-slate-900 text-white rounded-xl
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
    </div>
  );
}

/* ── Main orb component ──────────────────────────────────────── */

export function AIGenerateOrb({ flowId }: { flowId: string }) {
  const nodes = useFlowStore((s) => s.nodes);
  const { t } = useUIStore();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const isEmpty = nodes.length === 0;

  const handleGenerated = (nodeCount: number) => {
    const msg = t('home.aiGeneratedBanner' as TranslationKey).replace('{count}', String(nodeCount));
    setBanner(msg);
  };

  return (
    <>
      {/* Orb: always bottom-right, with hint when canvas is empty */}
      {!dialogOpen && (
        <div className="fixed bottom-8 right-8 z-[var(--z-modal)] flex flex-col items-center pointer-events-none">
          <button
            onClick={() => setDialogOpen(true)}
            className="pointer-events-auto group cursor-pointer
                       transition-transform duration-300 hover:scale-105 active:scale-95"
            aria-label="AI Generate"
          >
            <SiriOrb state="idle" />
          </button>
          {isEmpty && (
            <p className="pointer-events-none mt-3 text-sm text-slate-400 font-medium whitespace-nowrap">
              {t('canvas.aiOrbHint' as TranslationKey)}
            </p>
          )}
        </div>
      )}

      {/* Banner after generation */}
      {banner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3
                        px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-lg animate-fade-in-up">
          <span className="text-sm text-slate-700">{banner}</span>
          <button
            onClick={() => { setBanner(null); setDialogOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                       text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {t('generate.continueOptimize' as TranslationKey)}
          </button>
          <button
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {dialogOpen && (
        <GenerateDialog
          flowId={flowId}
          onClose={() => setDialogOpen(false)}
          onGenerated={handleGenerated}
        />
      )}
    </>
  );
}
