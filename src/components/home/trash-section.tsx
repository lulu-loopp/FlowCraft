'use client';

import React from 'react';
import { Trash2, RotateCcw, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { FlowMeta } from '@/types/flow';

type TrashedFlow = FlowMeta & { deletedAt: string };

interface TrashSectionProps {
  onRestored: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TrashSection({ onRestored }: TrashSectionProps) {
  const { t } = useUIStore();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<TrashedFlow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = React.useState(false);

  const fetchTrash = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/flows/trash');
      if (res.ok) setItems(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (open) fetchTrash();
  }, [open, fetchTrash]);

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/flows/trash/${id}`, { method: 'POST' });
      if (res.ok) {
        setItems(prev => prev.filter(f => f.id !== id));
        onRestored();
      }
    } catch {}
  };

  const handlePermanentDelete = async (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      setTimeout(() => setConfirmingId(null), 2500);
      return;
    }
    try {
      const res = await fetch(`/api/flows/trash/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(prev => prev.filter(f => f.id !== id));
        setConfirmingId(null);
      }
    } catch {}
  };

  const handleEmptyTrash = async () => {
    try {
      const res = await fetch('/api/flows/trash', { method: 'DELETE' });
      if (res.ok) {
        setItems([]);
      }
    } catch {}
    setShowEmptyConfirm(false);
  };

  return (
    <div className="mt-8">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Trash2 className="w-4 h-4" />
        {t('home.trash')}
        {items.length > 0 && open && (
          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{items.length}</span>
        )}
      </button>

      {open && (
        <div className="mt-3">
          {loading && (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-xs text-slate-400 py-4 pl-6">{t('home.trashEmpty')}</p>
          )}

          {!loading && items.length > 0 && (
            <div className="pl-6">
              {/* Empty trash button */}
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setShowEmptyConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-200 hover:border-rose-500 rounded-lg transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  {t('home.emptyTrash')}
                </button>
              </div>

              <div className="space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-white border border-slate-150 rounded-xl px-4 py-3 group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-600 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">
                        {item.nodeCount} {t('home.nodes')} &middot; {t('home.deletedAt')} {formatDate(item.deletedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <button
                        onClick={() => handleRestore(item.id)}
                        title={t('home.restore')}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(item.id)}
                        title={confirmingId === item.id ? t('home.confirmPermanentDelete') : t('home.permanentDelete')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          confirmingId === item.id
                            ? 'text-white bg-rose-500 hover:bg-rose-600'
                            : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showEmptyConfirm && (
        <ConfirmDialog
          title={t('home.emptyTrashTitle')}
          message={t('home.emptyTrashMessage').replace('{count}', String(items.length))}
          confirmLabel={t('home.emptyTrashConfirm')}
          cancelLabel={t('home.emptyTrashCancel')}
          onConfirm={handleEmptyTrash}
          onCancel={() => setShowEmptyConfirm(false)}
        />
      )}
    </div>
  );
}
