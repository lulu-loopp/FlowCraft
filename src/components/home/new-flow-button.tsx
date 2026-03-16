'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export function NewFlowButton() {
  const router = useRouter();
  const { t } = useUIStore();
  const [loading, setLoading] = React.useState(false);

  const handleCreate = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Flow' }),
      });
      if (res.ok) {
        const flow = await res.json();
        router.push('/canvas/' + flow.id);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium
                 rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors shadow-sm shadow-teal-200"
    >
      <Plus className="w-4 h-4" />
      {t('home.newFlow')}
    </button>
  );
}
