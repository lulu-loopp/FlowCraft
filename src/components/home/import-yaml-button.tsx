'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FileUp } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { pickAndImportYaml } from '@/lib/yaml-import-handler';

export function ImportYamlButton() {
  const router = useRouter();
  const { t } = useUIStore();
  const [loading, setLoading] = React.useState(false);

  const handleImport = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await pickAndImportYaml();
      if (result) {
        router.push('/canvas/' + result.flowId);
      }
    } catch (err) {
      console.error('YAML import failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleImport}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700
                 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300
                 disabled:opacity-60 transition-colors"
    >
      <FileUp className="w-4 h-4" />
      {t('home.importYaml')}
    </button>
  );
}
