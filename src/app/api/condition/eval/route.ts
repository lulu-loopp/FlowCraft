import { NextResponse } from 'next/server';
import { readSettings } from '@/lib/settings-storage';

function getApiKey(provider: string, settings: Awaited<ReturnType<typeof readSettings>>): string {
  switch (provider) {
    case 'anthropic': return settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';
    case 'openai':    return settings.openaiApiKey    || process.env.OPENAI_API_KEY    || '';
    case 'deepseek':  return settings.deepseekApiKey  || process.env.DEEPSEEK_API_KEY  || '';
    default:          return '';
  }
}

async function evaluateNatural(
  input: string,
  condition: string,
  provider: string,
  model: string,
  apiKey: string,
): Promise<boolean> {
  const prompt =
    `Context:\n${input}\n\nCondition: ${condition}\n\nAnswer with only the single word "true" or "false".`;

  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = ((msg.content[0] as { text: string }).text || '').toLowerCase().trim();
    return text.startsWith('true');
  }

  // OpenAI / DeepSeek
  const { default: OpenAI } = await import('openai');
  const baseURL = provider === 'deepseek' ? 'https://api.deepseek.com' : undefined;
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  const resp = await client.chat.completions.create({
    model,
    max_tokens: 10,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = (resp.choices[0].message.content || '').toLowerCase().trim();
  return text.startsWith('true');
}

function evaluateExpression(input: string, expression: string): boolean {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('output', `"use strict"; return !!(${expression})`);
    return fn(input);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      input: string;
      condition: string;
      mode: 'natural' | 'expression';
      provider?: string;
      model?: string;
    };
    const { input, condition, mode, provider = 'anthropic', model = 'claude-haiku-4-5-20251001' } = body;

    if (mode === 'expression') {
      return NextResponse.json({ result: evaluateExpression(input, condition) });
    }

    const settings = await readSettings();
    const apiKey = getApiKey(provider, settings);
    if (!apiKey) {
      return NextResponse.json({ error: `Missing API key for provider: ${provider}` }, { status: 400 });
    }

    const result = await evaluateNatural(input, condition, provider, model, apiKey);
    return NextResponse.json({ result });
  } catch (err) {
    console.error('[condition/eval]', err);
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}
