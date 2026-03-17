import fs from 'fs/promises';
import path from 'path';

export interface AppSettings {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  deepseekApiKey?: string;
  tavilyApiKey?: string;
  braveApiKey?: string;
  apiToken?: string;
  defaultProvider?: string;
  defaultModel?: string;
  workspacePath?: string;
}

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

export async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(raw) as AppSettings;
  } catch {
    return {};
  }
}

export async function writeSettings(settings: AppSettings): Promise<AppSettings> {
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  return settings;
}
