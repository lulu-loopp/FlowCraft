import { NextResponse } from 'next/server';
import { readFlow, FLOWS_DIR, assertSafeId } from '@/lib/flow-storage';
import { topologicalSort, areUpstreamsCompleteOrSkipped, markBranchSkipped, findLoopEdgeIds, DEFAULT_MAX_LOOP_ITERATIONS } from '@/lib/flow-executor';
import { resolveProviderApiKey } from '@/lib/resolve-api-key';
import { requireMutationAuth } from '@/lib/api-auth';
import { evaluateConditionExpression } from '@/lib/condition-expression';
import type { Node, Edge } from '@xyflow/react';
import fs from 'fs/promises';
import path from 'path';

interface Params {
  params: Promise<{ id: string }>;
}

function getNodeData(node?: Node): Record<string, unknown> {
  return (node?.data || {}) as Record<string, unknown>;
}

async function runAgentServer(node: Node, input: string): Promise<string> {
  const data = getNodeData(node);
  const provider = (data.provider as string | undefined) || 'anthropic';
  const apiKey = await resolveProviderApiKey(provider);
  if (!apiKey) throw new Error(`API key not configured for provider: ${provider}. Please set it in Settings.`);

  const temperature = (data.temperature as number) ?? 0.7;

  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: (data.model as string | undefined) || 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: (data.systemPrompt as string | undefined) || 'You are a helpful assistant.',
      messages: [{ role: 'user', content: input }],
      temperature,
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
    temperature,
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
  const apiKey = await resolveProviderApiKey(provider);
  if (!apiKey) throw new Error(`API key not configured for provider: ${provider}. Please set it in Settings.`);
  const prompt = `Context:\n${input}\n\nCondition: ${condition}\n\nAnswer only "true" or "false".`;

  const condTemp = (data.temperature as number) ?? 0.7;

  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: (data.model as string | undefined) || 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
      temperature: condTemp,
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
    temperature: condTemp,
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
  if (input === undefined || input === null) {
    return NextResponse.json({ error: 'Missing required field: input' }, { status: 400 });
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
    const loopEdgeIds = findLoopEdgeIds(edges);
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
      // Loop-aware scheduler: keep iterating until all nodes are done or max iterations reached
      const remaining = sorted.filter((n) => n.type !== 'io');
      let iteration = 0;
      const maxIterations = DEFAULT_MAX_LOOP_ITERATIONS * remaining.length || 100;

      while (iteration < maxIterations) {
        let progress = false;

        for (const node of remaining) {
          if (skipped.has(node.id)) {
            if (!completed.has(node.id)) {
              completed.add(node.id);
              outputs.set(node.id, '');
              progress = true;
            }
            continue;
          }
          if (!areUpstreamsCompleteOrSkipped(node.id, edges, completed, skipped, loopEdgeIds)) continue;

          // For loop back-edge targets: allow re-execution by removing from completed
          // (condition nodes that loop will re-enter their body nodes)
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
            logs.push(`[condition] -> ${result ? 'true' : 'false'}`);

            if (!result && loopEdgeIds.size > 0) {
              // Condition is false — check if the false branch is a loop back-edge
              const falseBackEdge = edges.find(
                (e) => e.source === node.id && e.sourceHandle === 'false-handle' && loopEdgeIds.has(e.id)
              );
              if (falseBackEdge) {
                // Re-enable loop body nodes for re-execution
                const loopBodyTargets = [falseBackEdge.target];
                for (const tid of loopBodyTargets) {
                  completed.delete(tid);
                  skipped.delete(tid);
                }
                output = nodeInput;
                outputs.set(node.id, output);
                completed.add(node.id);
                logs.push(`[${node.type}] ${label}: loop iteration`);
                progress = true;
                continue;
              }
            }

            markBranchSkipped(node.id, result ? 'false-handle' : 'true-handle', edges, completed, skipped, loopEdgeIds);
            output = nodeInput;
          } else {
            output = nodeInput;
          }

          outputs.set(node.id, output);
          completed.add(node.id);
          logs.push(`[${node.type}] ${label}: done`);
          progress = true;

          if (node.type === 'output') finalOutput = output;
        }

        iteration++;

        // Check if all nodes are done
        if (remaining.every((n) => completed.has(n.id))) break;
        // No progress means we're stuck
        if (!progress) break;
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
