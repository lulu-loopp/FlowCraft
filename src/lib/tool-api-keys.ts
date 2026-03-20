import { readSettings } from '@/lib/settings-storage';

export interface ToolApiKeys {
  tavily: string;
  brave: string;
  google: string;
  openai: string;
  replicate: string;
}

export async function readToolApiKeys(): Promise<ToolApiKeys> {
  const settings = await readSettings();
  return {
    tavily:
      (typeof settings.tavilyApiKey === 'string' && settings.tavilyApiKey.trim()) ||
      process.env.TAVILY_API_KEY ||
      '',
    brave:
      (typeof settings.braveApiKey === 'string' && settings.braveApiKey.trim()) ||
      process.env.BRAVE_API_KEY ||
      '',
    google:
      (typeof settings.googleApiKey === 'string' && settings.googleApiKey.trim()) ||
      process.env.GOOGLE_API_KEY ||
      '',
    openai:
      (typeof settings.openaiApiKey === 'string' && settings.openaiApiKey.trim()) ||
      process.env.OPENAI_API_KEY ||
      '',
    replicate:
      (typeof settings.replicateApiKey === 'string' && settings.replicateApiKey.trim()) ||
      process.env.REPLICATE_API_KEY ||
      '',
  };
}
