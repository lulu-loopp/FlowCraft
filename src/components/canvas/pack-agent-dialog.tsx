'use client';

import React from 'react';
import { X, Blocks } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  defaultName?: string;
  onConfirm: (name: string, description: string) => void;
  onClose: () => void;
}

export function PackAgentDialog({ defaultName = '', onConfirm, onClose }: Props) {
  const [name, setName] = React.useState(defaultName);
  const [description, setDescription] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, description.trim());
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onMouseDown={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[400px] p-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
              <Blocks className="w-4 h-4 text-teal-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Pack into Agent</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Agent name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. research-agent"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-400">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Blocks className="w-3.5 h-3.5 mr-1.5" />
              Pack
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
