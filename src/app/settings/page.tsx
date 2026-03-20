'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, CheckCircle2, XCircle, Terminal } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import type { AppSettings } from '@/lib/settings-storage';
import type { SkillEntry } from '@/types/registry';
import { Button } from '@/components/ui/button';
import { SkillInstallerInline } from '@/components/canvas/skill-installer-inline';

type ToolCheckStatus = {
  claudeInstalled: boolean; claudeVersion: string | null;
  codexInstalled: boolean; codexVersion: string | null;
} | null;

function ToolStatusRow({ label, installed, version, installedText, notInstalledText }: {
  label: string; installed: boolean; version: string | null;
  installedText: string; notInstalledText: string;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex items-center gap-2 w-28 shrink-0">
        <Terminal className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {installed ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-emerald-600">{installedText}</span>
            {version && <span className="text-xs text-slate-400 font-mono ml-2">{version}</span>}
          </>
        ) : (
          <>
            <XCircle className="w-4 h-4 text-rose-400" />
            <span className="text-sm text-rose-500">{notInstalledText}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ToolIntegrationSection() {
  const { t } = useUIStore();
  const [status, setStatus] = React.useState<ToolCheckStatus>(null);

  React.useEffect(() => {
    fetch('/api/tools/claude-code/check')
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => setStatus({ claudeInstalled: false, claudeVersion: null, codexInstalled: false, codexVersion: null }));
  }, []);

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
        {t('settings.claudeCode')} / {t('settings.codex')}
      </h2>
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {status === null ? (
          <div className="flex items-center justify-center px-5 py-4">
            <div className="w-4 h-4 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <ToolStatusRow
              label="Claude Code"
              installed={status.claudeInstalled}
              version={status.claudeVersion}
              installedText={t('settings.claudeCodeInstalled')}
              notInstalledText={t('settings.claudeCodeNotInstalled')}
            />
            <ToolStatusRow
              label="Codex"
              installed={status.codexInstalled}
              version={status.codexVersion}
              installedText={t('settings.codexInstalled')}
              notInstalledText={t('settings.codexNotInstalled')}
            />
          </>
        )}
      </div>
    </section>
  );
}

const PROVIDERS = ['anthropic', 'openai', 'deepseek', 'google', 'minimax'];
const MODELS: Record<string, string[]> = {
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini', 'gpt-4o', 'gpt-4o-mini'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  minimax: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed'],
};

const API_KEY_FIELDS: { key: keyof AppSettings; label: string; placeholder: string }[] = [
  { key: 'anthropicApiKey', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { key: 'openaiApiKey', label: 'OpenAI', placeholder: 'sk-...' },
  { key: 'deepseekApiKey', label: 'DeepSeek', placeholder: 'sk-...' },
  { key: 'googleApiKey', label: 'Google', placeholder: 'AIza...' },
  { key: 'minimaxApiKey', label: 'MiniMax', placeholder: 'sk-...' },
  { key: 'tavilyApiKey', label: 'Tavily', placeholder: 'tvly-...' },
  { key: 'braveApiKey', label: 'Brave Search', placeholder: 'BSA...' },
  { key: 'replicateApiKey', label: 'Replicate', placeholder: 'r8_...' },
  { key: 'apiToken', label: 'API Token', placeholder: 'Set for remote mutation APIs' },
];

type ImageModelOption = {
  value: string
  label: string
  provider: 'google' | 'openai' | 'replicate'
}

const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  { value: 'nano-banana-2',   label: 'Nano Banana 2',            provider: 'google' },
  { value: 'nano-banana',     label: 'Nano Banana',              provider: 'google' },
  { value: 'nano-banana-pro', label: 'Nano Banana Pro',          provider: 'google' },
  { value: 'imagen-3',        label: 'Imagen 3 ($0.03/image)',   provider: 'google' },
  { value: 'dall-e-3',        label: 'DALL-E 3',                 provider: 'openai' },
  { value: 'stable-diffusion', label: 'Stable Diffusion',        provider: 'replicate' },
  { value: 'flux',            label: 'Flux',                     provider: 'replicate' },
];

type ImageKeyStatus = Record<'google' | 'openai' | 'replicate', boolean>;

export default function SettingsPage() {
  const router = useRouter();
  const { t, lang, setLang } = useUIStore();
  const [settings, setSettings] = React.useState<AppSettings>({});
  const [savedSettings, setSavedSettings] = React.useState<AppSettings>({});
  const [saved, setSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [showUnsavedDialog, setShowUnsavedDialog] = React.useState(false);
  const [imageKeyStatus, setImageKeyStatus] = React.useState<ImageKeyStatus>({ google: false, openai: false, replicate: false });
  const [allSkills, setAllSkills] = React.useState<SkillEntry[]>([]);

  const isDirty = React.useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings]
  );

  const fetchAllSkills = React.useCallback(() => {
    fetch('/api/skills')
      .then((r) => r.json())
      .then((d) => setAllSkills(d.skills ?? []))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => { setSettings(data); setSavedSettings(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch('/api/settings/keys-status')
      .then((r) => r.json())
      .then((d) => setImageKeyStatus(d))
      .catch(() => {});
    fetchAllSkills();
  }, [fetchAllSkills]);

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
        setSavedSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {}
  };

  const handleBack = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      router.push('/');
    }
  };

  // Intercept browser back button / beforeunload
  React.useEffect(() => {
    if (!isDirty) return;

    // Handle browser tab close / refresh
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // Handle browser back/forward buttons
    // Push a dummy state so we can intercept the popstate
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => {
      setShowUnsavedDialog(true);
      // Re-push so the user stays on the page until they choose
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [isDirty]);

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
          onClick={handleBack}
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

        {/* Condition evaluation model */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            {t('settings.conditionModel')}
          </h2>
          <p className="text-xs text-slate-400 mb-3">{t('settings.conditionModelDesc')}</p>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            <div className="flex items-center gap-4 px-5 py-4">
              <label className="text-sm font-medium text-slate-700 w-28 shrink-0">Provider</label>
              <select
                value={settings.conditionProvider || ''}
                onChange={(e) => { set('conditionProvider', e.target.value); set('conditionModel', ''); }}
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">{t('settings.conditionModelAuto')}</option>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            {settings.conditionProvider && (
              <div className="flex items-center gap-4 px-5 py-4">
                <label className="text-sm font-medium text-slate-700 w-28 shrink-0">Model</label>
                <select
                  value={settings.conditionModel || (MODELS[settings.conditionProvider] || [])[0] || ''}
                  onChange={(e) => set('conditionModel', e.target.value)}
                  className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {(MODELS[settings.conditionProvider] || []).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
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

        {/* Image Generation */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            {t('settings.imageGeneration')}
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            <div className="px-5 py-4">
              <label className="text-sm font-medium text-slate-700 mb-3 block">
                {t('settings.defaultImageModel')}
              </label>
              <div className="space-y-2">
                {IMAGE_MODEL_OPTIONS.map((opt) => {
                  const hasKey = imageKeyStatus[opt.provider];
                  const disabled = !hasKey;
                  const providerLabel = opt.provider === 'google' ? 'Google' : opt.provider === 'openai' ? 'OpenAI' : 'Replicate';
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="defaultImageModel"
                        value={opt.value}
                        checked={(settings.defaultImageModel || 'nano-banana-2') === opt.value}
                        onChange={() => !disabled && set('defaultImageModel', opt.value)}
                        disabled={disabled}
                        className="accent-teal-600"
                      />
                      <span className="text-sm text-slate-700">{opt.label}</span>
                      {opt.value === 'nano-banana-2' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 font-medium">
                          {t('settings.recommended')}
                        </span>
                      )}
                      {disabled && (
                        <span className="text-[10px] text-slate-400 ml-auto">
                          {t('settings.needKey').replace('{provider}', providerLabel)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* AI Generate Flow */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            {t('settings.aiGenerate')}
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            <div className="flex items-center gap-4 px-5 py-4">
              <label className="text-sm font-medium text-slate-700 w-28 shrink-0">Provider</label>
              <select
                value={settings.generateProvider || 'deepseek'}
                onChange={(e) => { set('generateProvider', e.target.value); set('generateModel', ''); }}
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
                value={settings.generateModel || (MODELS[settings.generateProvider || 'deepseek'] || [])[0] || ''}
                onChange={(e) => set('generateModel', e.target.value)}
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {(MODELS[settings.generateProvider || 'deepseek'] || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="px-5 py-4">
              <label className="text-sm font-medium text-slate-700 mb-3 block">
                {t('settings.aiGenerateTools')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.generateEnableWebSearch !== false}
                    onChange={(e) => set('generateEnableWebSearch', e.target.checked)}
                    className="accent-teal-600"
                  />
                  <span className="text-sm text-slate-700">web_search</span>
                  <span className="text-xs text-slate-400">{t('settings.aiGenerateWebSearchHint')}</span>
                </label>
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.generateEnableUrlFetch !== false}
                    onChange={(e) => set('generateEnableUrlFetch', e.target.checked)}
                    className="accent-teal-600"
                  />
                  <span className="text-sm text-slate-700">url_fetch</span>
                  <span className="text-xs text-slate-400">{t('settings.aiGenerateUrlFetchHint')}</span>
                </label>
              </div>
            </div>
            {/* Skills for generate agent */}
            <div className="px-5 py-4">
              <label className="text-sm font-medium text-slate-700 mb-3 block">
                {t('settings.aiGenerateSkills')}
              </label>
              {allSkills.length > 0 ? (
                <div className="space-y-2">
                  {allSkills.map((skill) => {
                    const enabled = (settings.generateEnabledSkills ?? ['flow-design']).includes(skill.name);
                    return (
                      <label
                        key={skill.name}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => {
                            const current = settings.generateEnabledSkills ?? ['flow-design'];
                            const next = enabled
                              ? current.filter((n) => n !== skill.name)
                              : [...current, skill.name];
                            set('generateEnabledSkills', next);
                          }}
                          className="accent-teal-600"
                        />
                        <span className="text-sm text-slate-700">{skill.name}</span>
                        {skill.builtin && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 font-medium">
                            {t('settings.builtinSkill')}
                          </span>
                        )}
                        {skill.description && (
                          <span className="text-xs text-slate-400 truncate">{skill.description}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-2">{t('settings.aiGenerateNoSkills')}</p>
              )}
              <div className="mt-2">
                <SkillInstallerInline onInstalled={fetchAllSkills} />
              </div>
            </div>
          </div>
        </section>

        {/* Claude Code & Codex Integration */}
        <ToolIntegrationSection />

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

      {/* Unsaved changes dialog */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] max-w-[90vw] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-800 mb-2">{t('settings.unsavedTitle')}</h3>
            <p className="text-sm text-slate-500 mb-6">{t('settings.unsavedMessage')}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setSavedSettings(settings); setShowUnsavedDialog(false); router.push('/'); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {t('settings.unsavedDiscard')}
              </button>
              <button
                onClick={async () => { await handleSave(); setShowUnsavedDialog(false); router.push('/'); }}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
              >
                {t('settings.unsavedSave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
