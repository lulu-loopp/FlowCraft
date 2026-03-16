'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Trash2, GitBranch } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import type { FlowMeta } from '@/types/flow';

interface FlowCardProps {
  flow: FlowMeta;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function FlowCard({ flow, onDelete }: FlowCardProps) {
  const router = useRouter();
  const { t } = useUIStore();
  const [confirming, setConfirming] = React.useState(false);

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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleEdit}
      onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
      className="group relative bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer
                 hover:border-teal-300 hover:shadow-md hover:shadow-teal-50 transition-all duration-150 outline-none
                 focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
        <GitBranch className="w-5 h-5 text-teal-600" />
      </div>

      {/* Name */}
      <h3 className="font-semibold text-slate-800 text-sm mb-1 truncate pr-2">{flow.name}</h3>

      {/* Meta */}
      <p className="text-xs text-slate-400">
        {flow.nodeCount} {t('home.nodes')} &middot; {t('home.lastModified')}{' '}
        {formatDate(flow.updatedAt)}
      </p>

      {/* Action buttons — visible on hover */}
      <div
        className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleEdit(); }}
          title={t('home.edit')}
          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          title={confirming ? 'Click again to confirm' : t('home.delete')}
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
