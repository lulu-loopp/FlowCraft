'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, GitBranch } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import type { FlowMeta } from '@/types/flow';

interface FlowCardProps {
  flow: FlowMeta;
  onDelete: (id: string) => void;
  onRenamed?: () => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function FlowCard({ flow, onDelete, onRenamed }: FlowCardProps) {
  const router = useRouter();
  const { t } = useUIStore();
  const [confirming, setConfirming] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [newName, setNewName] = React.useState(flow.name);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleEdit = () => router.push('/canvas/' + flow.id);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming) {
      onDelete(flow.id);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 2500);
    }
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewName(flow.name);
    setRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const submitRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === flow.name) {
      setRenaming(false);
      return;
    }
    try {
      const res = await fetch(`/api/flows/${flow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) onRenamed?.();
    } catch {}
    setRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submitRename(); }
    if (e.key === 'Escape') setRenaming(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={renaming ? undefined : handleEdit}
      onKeyDown={(e) => !renaming && e.key === 'Enter' && handleEdit()}
      className="group relative bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer
                 hover:border-teal-300 hover:shadow-md hover:shadow-teal-50 transition-all duration-150 outline-none
                 focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
        <GitBranch className="w-5 h-5 text-teal-600" />
      </div>

      {/* Name */}
      {renaming ? (
        <input
          ref={inputRef}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={handleRenameKeyDown}
          onClick={e => e.stopPropagation()}
          className="w-full font-semibold text-slate-800 text-sm mb-1 pr-2 bg-white border border-teal-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-teal-500"
          autoFocus
        />
      ) : (
        <h3 className="font-semibold text-slate-800 text-sm mb-1 truncate pr-2">{flow.name}</h3>
      )}

      {/* Meta */}
      <p className="text-xs text-slate-400">
        {flow.nodeCount} {t('home.nodes')} &middot; {t('home.lastModified')}{' '}
        {formatDateTime(flow.updatedAt)}
      </p>

      {/* Action buttons — visible on hover */}
      <div
        className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleRenameClick}
          title={t('home.rename')}
          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          title={confirming ? t('home.confirmPermanentDelete') : t('home.delete')}
          className={`p-1.5 rounded-lg transition-colors ${
            confirming
              ? 'text-white bg-rose-500 hover:bg-rose-600'
              : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
