'use client';

import React from 'react';
import { X, Blocks, ArrowLeftCircle, ArrowRightCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/uiStore';
import { buildPackHandleConfig, getPackWarnings } from '@/hooks/usePackedNode';
import type { Node, Edge } from '@xyflow/react';

interface Props {
  selectedNodes: Node[];
  edges: Edge[];
  defaultName?: string;
  onConfirm: (name: string, description: string, isShared: boolean) => void;
  onClose: () => void;
}

export function PackAgentDialog({ selectedNodes, edges, defaultName = '', onConfirm, onClose }: Props) {
  const { t } = useUIStore();
  const [name, setName] = React.useState(defaultName);
  const [description, setDescription] = React.useState('');
  const [isShared, setIsShared] = React.useState(true);

  const handleConfig = React.useMemo(() => buildPackHandleConfig(selectedNodes), [selectedNodes]);
  const warnings = React.useMemo(() => getPackWarnings(selectedNodes, edges, t), [selectedNodes, edges, t]);
  const inputPorts = handleConfig.filter(h => h.type === 'input');
  const outputPorts = handleConfig.filter(h => h.type === 'output');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, description.trim(), isShared);
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onMouseDown={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[440px] p-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
              <Blocks className="w-4 h-4 text-teal-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">{t('packDialog.title')}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('packDialog.agentName')} <span className="text-rose-500">*</span>
            </label>
            <input type="text" autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder={t('packDialog.agentNamePlaceholder')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <p className="mt-1 text-xs text-slate-400">{t('packDialog.agentNameHint')}</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('packDialog.description')} <span className="text-slate-400">{t('packDialog.optional')}</span>
            </label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder={t('packDialog.descriptionPlaceholder')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>

          {/* Port Preview */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-slate-600">{t('packed.portPreview')}</p>
            <div className="flex gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                  <ArrowLeftCircle className="w-3 h-3" />
                  {t('packed.inputPorts')} ({inputPorts.length})
                </div>
                {inputPorts.length > 0 ? inputPorts.map(p => (
                  <div key={p.id} className="text-xs text-slate-600 pl-4">{p.label}</div>
                )) : (
                  <div className="text-[11px] text-slate-300 pl-4">-</div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                  <ArrowRightCircle className="w-3 h-3" />
                  {t('packed.outputPorts')} ({outputPorts.length})
                </div>
                {outputPorts.length > 0 ? outputPorts.map(p => (
                  <div key={p.id} className="text-xs text-slate-600 pl-4">{p.label}</div>
                )) : (
                  <div className="text-[11px] text-slate-300 pl-4">-</div>
                )}
              </div>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>{warnings.map((w, i) => <div key={i}>{w}</div>)}</div>
            </div>
          )}

          <div className="space-y-2">
            {[true, false].map(shared => (
              <label key={String(shared)} onClick={() => setIsShared(shared)}
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${isShared === shared ? 'border-violet-300 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" name="shareMode" checked={isShared === shared} onChange={() => setIsShared(shared)} className="mt-0.5 accent-violet-600" />
                <div>
                  <p className="text-xs font-medium text-slate-700">{t(shared ? 'packed.sharedDefinition' : 'packed.independentCopy')}</p>
                  <p className="text-[11px] text-slate-400">{t(shared ? 'packed.sharedHint' : 'packed.copyHint')}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>{t('canvas.cancel')}</Button>
            <Button type="submit" disabled={!name.trim()} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
              <Blocks className="w-3.5 h-3.5 mr-1.5" />{t('packDialog.pack')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
