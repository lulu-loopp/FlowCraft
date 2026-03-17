import { NextResponse } from 'next/server';
import { readFlow, FLOWS_DIR, assertSafeId } from '@/lib/flow-storage';
import { topologicalSort, areUpstreamsCompleteOrSkipped, markBranchSkipped } from '@/lib/flow-executor';
import { readSettings } from '@/lib/settings-storage';
import { requireMutationAuth } from '@/lib/api-auth';
import { evaluateConditionExpression } from '@/lib/condition-expression';
import type { Node, Edge } from '@xyflow/react';
import fs from 'fs/promises';
import path from 'path';

interface Params {
  params: Promise<{ id: string }>;
}

async function getApiKey(provider: string): Promise<string> {
  const settings = await readSettings();
  switch (provider) {
    case 'anthropic': return settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';
    case 'openai':    return settings.openaiApiKey || process.env.OPENAI_API_KEY || '';
    case 'deepseek':  return settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '';
    default:          return '';
  }
}

function getNodeData(node?: Node): Record<string, unknown> {
  return (node?.data || {}) as Record<string, unknown>;
}

async function runAgentServer(node: Node, input: string): Promise<string> {
  const data = getNodeData(node);
  const provider = (data.provider as string | undefined) || 'anthropic';
  const apiKey = await getApiKey(provider);

  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: (data.model as string | undefined) || 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: (data.systemPrompt as string | undefined) || 'You are a helpful assistant.',
      messages: [{ role: 'user', content: input }],
    });
    return (msg.content[0] as { text: string }).text || '';
  }

  const { default: OpenAI } = await import('openai');
  const baseURL = provider === 'deepseek' ? 'https://api.deepseek.com' : undefined;
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  const resp = await client.chat.completions.create({
    model: (data.model as string | undefined) || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o'),
    messages: [
      { role: 'system', content: (data.systemPrompt as string | undefined) || 'You are a helpful assistant.' },
      { role: 'user', content: input },
    ],
  });
  return resp.choices[0]?.message?.content || '';
}

async function evaluateConditionServer(node: Node, input: string): Promise<boolean> {
  const data = getNodeData(node);
  const mode = (data.conditionMode as string | undefined) || 'natural';
  const condition = ((data.conditionValue as string | undefined) || '').trim();
  if (!condition) return true;

  if (mode === 'expression') return evaluateConditionExpression(input, condition);

  const provider = (data.provider as string | undefined) || 'anthropic';
  const apiKey = await getApiKey(provider);
  const prompt = `Context:\n${input}\n\nCondition: ${condition}\n\nAnswer only "true" or "false".`;

  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: (data.model as string | undefined) || 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    });
    return ((msg.content[0] as { text: string }).text || '').toLowerCase().trim().startsWith('true');
  }

  const { default: OpenAI } = await import('openai');
  const baseURL = provider === 'deepseek' ? 'https://api.deepseek.com' : undefined;
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  const resp = await client.chat.completions.create({
    model: (data.model as string | undefined) || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'),
    max_tokens: 10,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = (resp.choices[0]?.message?.content || '').toLowerCase().trim();
  return text.startsWith('true');
}

// POST /api/flows/{id}/run -> start a run, returns runId
export async function POST(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    assertSafeId(id);
  } catch {
    return NextResponse.json({ error: 'Invalid flow id' }, { status: 400 });
  }

  const flow = await readFlow(id).catch(() => null);
  if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 });

  let input: string | undefined;
  try {
    const body = await req.json() as { input?: string };
    input = body.input;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const runId = `run-${Date.now()}`;
  const runFile = path.join(FLOWS_DIR, `${id}-run-${runId}.json`);

  await fs.writeFile(
    runFile,
    JSON.stringify({
      runId,
      status: 'running',
      startedAt: new Date().toISOString(),
      output: null,
      logs: [],
      error: null,
    }),
    'utf-8',
  );

  void (async () => {
    const nodes: Node[] = flow.nodes as Node[];
    const edges: Edge[] = flow.edges as Edge[];
    const sorted = topologicalSort(nodes, edges);
    const completed = new Set<string>();
    const skipped = new Set<string>();
    const outputs = new Map<string, string>();
    const logs: string[] = [];
    let finalOutput = '';

    const inputNode = sorted.find((n) => n.type === 'io');
    const inputText = (getNodeData(inputNode).inputText as string | undefined) || input || 'Start';
    if (inputNode) {
      completed.add(inputNode.id);
      outputs.set(inputNode.id, inputText);
    }

    try {
      for (const node of sorted) {
        if (node.type === 'io') continue;
        if (skipped.has(node.id)) {
          completed.add(node.id);
          outputs.set(node.id, '');
          continue;
        }
        if (!areUpstreamsCompleteOrSkipped(node.id, edges, completed, skipped)) continue;

        const upstream = edges
          .filter((e) => e.target === node.id)
          .map((e) => outputs.get(e.source) || '')
          .filter(Boolean)
          .join('\n\n');
        const nodeInput = upstream || inputText;
        const label = (getNodeData(node).label as string | undefined) || node.id;
        logs.push(`[${node.type}] ${label}: starting`);

        let output = '';
        if (node.type === 'agent') {
          output = await runAgentServer(node, nodeInput);
        } else if (node.type === 'condition') {
          const result = await evaluateConditionServer(node, nodeInput);
          markBranchSkipped(node.id, result ? 'false-handle' : 'true-handle', edges, completed, skipped);
          output = nodeInput;
          logs.push(`[condition] -> ${result ? 'true' : 'false'}`);
        } else {
          output = nodeInput;
        }

        outputs.set(node.id, output);
        completed.add(node.id);
        logs.push(`[${node.type}] ${label}: done`);

        if (node.type === 'output') finalOutput = output;
      }

      if (!finalOutput && outputs.size) finalOutput = [...outputs.values()].at(-1) || '';
      await fs.writeFile(runFile, JSON.stringify({ runId, status: 'done', output: finalOutput, logs, error: null }), 'utf-8');
    } catch (err) {
      await fs.writeFile(
        runFile,
        JSON.stringify({
          runId,
          status: 'error',
          output: null,
          logs,
          error: err instanceof Error ? err.message : 'Unknown error',
        }),
        'utf-8',
      );
    }
  })();

  return NextResponse.json({ runId });
}
