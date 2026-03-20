import { NextResponse } from 'next/server';
import { resolveProviderWithFallback } from '@/lib/resolve-api-key';
import { requireMutationAuth } from '@/lib/api-auth';
import { evaluateConditionExpression } from '@/lib/condition-expression';
import { stripThinkTags } from '@/lib/strip-think-tags';

async function evaluateNatural(
  input: string,
  condition: string,
  provider: string,
  model: string,
  apiKey: string,
): Promise<boolean> {
  // Truncate context to the last ~2000 chars — conclusions are usually at the end.
  // This reduces think-tag overhead for reasoning models.
  const maxContextLen = 2000
  const truncatedInput = input.length > maxContextLen
    ? '...(earlier content omitted)\n\n' + input.slice(-maxContextLen)
    : input

  const prompt = [
    'You are a precise condition evaluator.',
    'Given the context below (output from an AI agent), determine if the condition is met.',
    'IMPORTANT: Focus on the ACTUAL RESULT or VALUE, not surrounding explanation or code.',
    'If the context contains code, narrative, or explanation alongside a result,',
    'evaluate the condition against the final result/value only.',
    '',
    `Context:\n${truncatedInput}`,
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

  if (provider === 'google') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const gModel = genAI.getGenerativeModel({
      model,
      generationConfig: { maxOutputTokens: 10 },
    });
    const result = await gModel.generateContent(prompt);
    return (result.response.text() || '').toLowerCase().trim().startsWith('true');
  }

  // OpenAI / DeepSeek / MiniMax
  const { default: OpenAI } = await import('openai');
  const baseURLMap: Record<string, string> = { deepseek: 'https://api.deepseek.com', minimax: 'https://api.minimaxi.com/v1' };
  const baseURL = baseURLMap[provider] || undefined;
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  // No max_tokens limit — reasoning models (MiniMax, DeepSeek) produce <think> tags
  // that consume budget, but stripThinkTags extracts just the true/false answer.
  const resp = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = resp.choices[0].message.content || '';
  const { cleaned } = stripThinkTags(raw);
  const text = cleaned.toLowerCase().trim();
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
    const { input: rawInput, condition, mode, provider = 'anthropic', model = 'claude-haiku-4-5' } = body;
    // Safety net: strip <think> tags from upstream output before evaluation
    const input = stripThinkTags(rawInput).cleaned || rawInput;

    if (mode === 'expression') {
      try {
        return NextResponse.json({ result: evaluateConditionExpression(input, condition) });
      } catch (exprErr) {
        const msg = exprErr instanceof Error ? exprErr.message : 'Invalid expression';
        return NextResponse.json(
          { error: `Expression evaluation failed: ${msg}` },
          { status: 400 },
        );
      }
    }

    const resolved = await resolveProviderWithFallback(provider, model);
    if (!resolved) {
      return NextResponse.json({ error: `Missing API key for provider: ${provider}` }, { status: 400 });
    }

    const result = await evaluateNatural(input, condition, resolved.provider, resolved.model, resolved.apiKey);
    return NextResponse.json({ result });
  } catch (err) {
    console.error('[condition/eval]', err);
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}
