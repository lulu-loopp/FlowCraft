import { NextResponse } from 'next/server';
import { resolveProviderApiKey } from '@/lib/resolve-api-key';
import { requireMutationAuth } from '@/lib/api-auth';
import { evaluateConditionExpression } from '@/lib/condition-expression';

async function evaluateNatural(
  input: string,
  condition: string,
  provider: string,
  model: string,
  apiKey: string,
): Promise<boolean> {
  const prompt = [
    'You are a precise condition evaluator.',
    'Given the context below (output from an AI agent), determine if the condition is met.',
    'IMPORTANT: Focus on the ACTUAL RESULT or VALUE, not surrounding explanation or code.',
    'If the context contains code, narrative, or explanation alongside a result,',
    'evaluate the condition against the final result/value only.',
    '',
    `Context:\n${input}`,
    '',
    `Condition to evaluate: ${condition}`,
    '',
    'Answer with ONLY the single word "true" or "false".',
  ].join('\n');

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

export async function POST(req: Request) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

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
      return NextResponse.json({ result: evaluateConditionExpression(input, condition) });
    }

    const apiKey = await resolveProviderApiKey(provider);
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
