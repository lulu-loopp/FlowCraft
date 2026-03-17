'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import type { AppSettings } from '@/lib/settings-storage';
import { Button } from '@/components/ui/button';

const PROVIDERS = ['anthropic', 'openai', 'deepseek'];
const MODELS: Record<string, string[]> = {
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
};

const API_KEY_FIELDS: { key: keyof AppSettings; label: string; placeholder: string }[] = [
  { key: 'anthropicApiKey', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { key: 'openaiApiKey', label: 'OpenAI', placeholder: 'sk-...' },
  { key: 'deepseekApiKey', label: 'DeepSeek', placeholder: 'sk-...' },
  { key: 'tavilyApiKey', label: 'Tavily', placeholder: 'tvly-...' },
  { key: 'braveApiKey', label: 'Brave Search', placeholder: 'BSA...' },
  { key: 'apiToken', label: 'API Token', placeholder: 'Set for remote mutation APIs' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { t, lang, setLang } = useUIStore();
  const [settings, setSettings] = React.useState<AppSettings>({});
  const [saved, setSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {}
  };

  const availableModels = MODELS[settings.defaultProvider || 'anthropic'] || [];

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
      </div>
    );
  }

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
        <h1 className="font-semibold text-slate-900 text-sm">{t('settings.title')}</h1>
      </header>

      <main className="max-w-2xl mx-auto py-10 px-5 space-y-8">
        {/* API Keys */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            {t('settings.apiKeys')}
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {API_KEY_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="flex items-center gap-4 px-5 py-4">
                <label className="text-sm font-medium text-slate-700 w-28 shrink-0">{label}</label>
                <input
                  type="password"
                  value={(settings[key] as string) || ''}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                             placeholder:text-slate-400 font-mono"
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Default model */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            {t('settings.defaultModel')}
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            <div className="flex items-center gap-4 px-5 py-4">
              <label className="text-sm font-medium text-slate-700 w-28 shrink-0">Provider</label>
              <select
                value={settings.defaultProvider || 'anthropic'}
                onChange={(e) => { set('defaultProvider', e.target.value); set('defaultModel', ''); }}
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4 px-5 py-4">
              <label className="text-sm font-medium text-slate-700 w-28 shrink-0">Model</label>
              <select
                value={settings.defaultModel || availableModels[0] || ''}
                onChange={(e) => set('defaultModel', e.target.value)}
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Workspace path */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            {t('settings.workspacePath')}
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
            <input
              type="text"
              value={settings.workspacePath || ''}
              onChange={(e) => set('workspacePath', e.target.value)}
              placeholder="/path/to/workspace"
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-400 font-mono"
            />
          </div>
        </section>

        {/* Language */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            {t('settings.language')}
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex gap-3">
            {(['en', 'zh'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  lang === l
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {l === 'en' ? 'English' : '中文'}
              </button>
            ))}
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end">
          <Button
            size="md"
            variant="primary"
            onClick={handleSave}
            className="gap-2 min-w-[100px]"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                {t('settings.saved')}
              </>
            ) : (
              t('settings.save')
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
