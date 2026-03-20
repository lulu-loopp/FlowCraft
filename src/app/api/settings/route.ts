import { NextResponse } from 'next/server';
import { readSettings, writeSettings } from '@/lib/settings-storage';
import { requireMutationAuth } from '@/lib/api-auth';

const KEY_FIELDS = new Set(['anthropicApiKey', 'openaiApiKey', 'deepseekApiKey', 'googleApiKey', 'minimaxApiKey', 'tavilyApiKey', 'braveApiKey', 'replicateApiKey', 'apiToken']);
const REDACTED = 'REDACTED';

function maskSettings(settings: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(settings).map(([k, v]) => [k, KEY_FIELDS.has(k) && v ? REDACTED : v])
  );
}

export async function GET() {
  try {
    const settings = await readSettings();
    return NextResponse.json(maskSettings(settings as Record<string, unknown>));
  } catch (err) {
    console.error('[settings GET]', err);
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireMutationAuth(request);
  if (denied) return denied;

  try {
    const body = await request.json() as Record<string, unknown>;
    // Strip REDACTED sentinel — user did not change those keys
    const updates = Object.fromEntries(
      Object.entries(body).filter(([k, v]) => !(KEY_FIELDS.has(k) && v === REDACTED))
    );
    // Merge with existing so unsubmitted keys are preserved
    const existing = await readSettings();
    const merged = { ...existing, ...updates };
    const saved = await writeSettings(merged);
    return NextResponse.json(maskSettings(saved as Record<string, unknown>));
  } catch (err) {
    console.error('[settings POST]', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
