'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

interface ByModelEntry {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  calls: number;
}

interface ByFlowEntry {
  flowId: string;
  flowName: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  nodeCount: number;
}

interface ByNodeEntry {
  flowId: string;
  nodeId: string;
  nodeLabel: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

interface UsageData {
  totalInput: number;
  totalOutput: number;
  totalCost: number;
  byModel: ByModelEntry[];
  byFlow: ByFlowEntry[];
  byNode: ByNodeEntry[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

const USD_TO_CNY = 7.25;

function formatCost(n: number, currency: 'USD' | 'CNY'): string {
  if (currency === 'CNY') return '¥' + (n * USD_TO_CNY).toFixed(2);
  return '$' + n.toFixed(2);
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'bg-orange-100 text-orange-700',
  openai: 'bg-emerald-100 text-emerald-700',
  deepseek: 'bg-blue-100 text-blue-700',
  google: 'bg-purple-100 text-purple-700',
  minimax: 'bg-pink-100 text-pink-700',
  unknown: 'bg-slate-100 text-slate-600',
};

function ProviderBadge({ provider }: { provider: string }) {
  const colors = PROVIDER_COLORS[provider] || PROVIDER_COLORS.unknown;
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colors}`}>
      {provider}
    </span>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-semibold text-slate-900 tracking-tight">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

function FlowNodeRows({ flowId, nodes, currency }: { flowId: string; nodes: ByNodeEntry[]; currency: 'USD' | 'CNY' }) {
  const [open, setOpen] = React.useState(false);
  if (nodes.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors ml-1"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {nodes.length} node{nodes.length > 1 ? 's' : ''}
      </button>
      {open && (
        <tr>
          <td colSpan={5} className="px-0 py-0">
            <table className="w-full">
              <tbody>
                {nodes.map((n) => (
                  <tr key={`${flowId}-${n.nodeId}`} className="bg-slate-50/60">
                    <td className="pl-10 pr-5 py-2 text-xs text-slate-600">{n.nodeLabel}</td>
                    <td className="px-5 py-2 text-xs text-slate-500 font-mono">{n.model}</td>
                    <td className="px-5 py-2 text-xs text-slate-500 text-right tabular-nums">{formatTokens(n.inputTokens)}</td>
                    <td className="px-5 py-2 text-xs text-slate-500 text-right tabular-nums">{formatTokens(n.outputTokens)}</td>
                    <td className="px-5 py-2 text-xs text-slate-700 text-right tabular-nums font-medium">{formatCost(n.cost, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useUIStore();
  const [data, setData] = React.useState<UsageData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [currency, setCurrency] = React.useState<'USD' | 'CNY'>('USD');

  React.useEffect(() => {
    fetch('/api/usage')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const nodesByFlow = React.useMemo(() => {
    if (!data) return new Map<string, ByNodeEntry[]>();
    const map = new Map<string, ByNodeEntry[]>();
    for (const n of data.byNode) {
      const arr = map.get(n.flowId) || [];
      arr.push(n);
      map.set(n.flowId, arr);
    }
    return map;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const hasData = data && (data.totalInput > 0 || data.totalOutput > 0);

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-5 gap-4">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('settings.back')}
        </button>
        <h1 className="font-semibold text-slate-900 text-sm flex-1">{t('dashboard.title')}</h1>
        <button
          onClick={() => setCurrency(c => c === 'USD' ? 'CNY' : 'USD')}
          className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
        >
          {currency === 'USD' ? '$ USD → ¥ CNY' : '¥ CNY → $ USD'}
        </button>
      </header>

      <main className="max-w-4xl mx-auto py-10 px-5 space-y-8">
        {/* Empty state */}
        {(!hasData || error) && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm text-slate-500">{t('dashboard.noData')}</p>
          </div>
        )}

        {hasData && data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard
                label={t('dashboard.totalInput')}
                value={formatTokens(data.totalInput)}
                sub={data.totalInput.toLocaleString() + ' tokens'}
              />
              <SummaryCard
                label={t('dashboard.totalOutput')}
                value={formatTokens(data.totalOutput)}
                sub={data.totalOutput.toLocaleString() + ' tokens'}
              />
              <SummaryCard
                label={t('dashboard.totalCost')}
                value={formatCost(data.totalCost, currency)}
              />
            </div>

            {/* By Model */}
            {data.byModel.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  {t('dashboard.byModel')}
                </h2>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left">
                        <th className="px-5 py-3 text-xs font-medium text-slate-500">Model</th>
                        <th className="px-5 py-3 text-xs font-medium text-slate-500">Provider</th>
                        <th className="px-5 py-3 text-xs font-medium text-slate-500 text-right">Input</th>
                        <th className="px-5 py-3 text-xs font-medium text-slate-500 text-right">Output</th>
                        <th className="px-5 py-3 text-xs font-medium text-slate-500 text-right">Cost</th>
                        <th className="px-5 py-3 text-xs font-medium text-slate-500 text-right">Calls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.byModel.map((m) => (
                        <tr key={`${m.provider}-${m.model}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3 font-mono text-slate-700">{m.model}</td>
                          <td className="px-5 py-3"><ProviderBadge provider={m.provider} /></td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-600">{formatTokens(m.inputTokens)}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-600">{formatTokens(m.outputTokens)}</td>
                          <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-800">{formatCost(m.cost, currency)}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-600">{m.calls}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* By Flow */}
            {data.byFlow.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  {t('dashboard.byFlow')}
                </h2>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left">
                        <th className="px-5 py-3 text-xs font-medium text-slate-500">Flow</th>
                        <th className="px-5 py-3 text-xs font-medium text-slate-500 text-right">Nodes</th>
                        <th className="px-5 py-3 text-xs font-medium text-slate-500 text-right">Input</th>
                        <th className="px-5 py-3 text-xs font-medium text-slate-500 text-right">Output</th>
                        <th className="px-5 py-3 text-xs font-medium text-slate-500 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.byFlow.map((f) => (
                        <React.Fragment key={f.flowId}>
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/canvas/${f.flowId}`}
                                  className="text-teal-600 hover:text-teal-800 hover:underline font-medium transition-colors"
                                >
                                  {f.flowName}
                                </Link>
                                <FlowNodeRows flowId={f.flowId} nodes={nodesByFlow.get(f.flowId) || []} currency={currency} />
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums text-slate-600">{f.nodeCount}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-slate-600">{formatTokens(f.inputTokens)}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-slate-600">{formatTokens(f.outputTokens)}</td>
                            <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-800">{formatCost(f.cost, currency)}</td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
