import { NextResponse } from 'next/server';
import { readFlow, FLOWS_DIR, assertSafeId } from '@/lib/flow-storage';
import { topologicalSort, areUpstreamsCompleteOrSkipped, markBranchSkipped, findLoopEdgeIds, DEFAULT_MAX_LOOP_ITERATIONS } from '@/lib/flow-executor';
import { resolveProviderWithFallback } from '@/lib/resolve-api-key';
import { requireMutationAuth } from '@/lib/api-auth';
import { evaluateConditionExpression } from '@/lib/condition-expression';
import type { HandleResult } from '@/lib/packed-executor';
import type { Node, Edge } from '@xyflow/react';
import fsPromises from 'fs/promises';
import path from 'path';

const PACKS_DIR = path.join(process.cwd(), 'agents', 'packs');

interface Params {
  params: Promise<{ id: string }>;
}

function getNodeData(node?: Node): Record<string, unknown> {
  return (node?.data || {}) as Record<string, unknown>;
}

async function runAgentServer(node: Node, input: string): Promise<string> {
  const data = getNodeData(node);
  const requestedProvider = (data.provider as string | undefined) || 'anthropic';
  const requestedModel = (data.model as string | undefined) || 'claude-sonnet-4-6';
  const resolved = await resolveProviderWithFallback(requestedProvider, requestedModel);
  if (!resolved) throw new Error(`API key not configured for provider: ${requestedProvider}. Please set it in Settings.`);
  const provider = resolved.provider;
  const apiKey = resolved.apiKey;
  const model = resolved.model;

  const temperature = (data.temperature as number) ?? 0.7;

  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: 4096,
      system: (data.systemPrompt as string | undefined) || 'You are a helpful assistant.',
      messages: [{ role: 'user', content: input }],
      temperature,
    });
    return (msg.content[0] as { text: string }).text || '';
  }

  if (provider === 'google') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({
      model,
      systemInstruction: (data.systemPrompt as string | undefined) || 'You are a helpful assistant.',
      generationConfig: { temperature, maxOutputTokens: 4096 },
    });
    const result = await genModel.generateContent(input);
    return result.response.text();
  }

  const { default: OpenAI } = await import('openai');
  const baseURL = provider === 'deepseek' ? 'https://api.deepseek.com' : undefined;
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  const resp = await client.chat.completions.create({
    model,
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

  const reqProvider = (data.provider as string | undefined) || 'anthropic';
  const reqModel = (data.model as string | undefined) || 'claude-haiku-4-5';
  const resolved = await resolveProviderWithFallback(reqProvider, reqModel);
  if (!resolved) throw new Error(`API key not configured for provider: ${reqProvider}. Please set it in Settings.`);
  const provider = resolved.provider;
  const apiKey = resolved.apiKey;
  const model = resolved.model;
  const prompt = `Context:\n${input}\n\nCondition: ${condition}\n\nAnswer only "true" or "false".`;

  const condTemp = (data.temperature as number) ?? 0.7;

  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
      temperature: condTemp,
    });
    return ((msg.content[0] as { text: string }).text || '').toLowerCase().trim().startsWith('true');
  }

  if (provider === 'google') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const condModel = genAI.getGenerativeModel({
      model,
      generationConfig: { temperature: condTemp, maxOutputTokens: 10 },
    });
    const result = await condModel.generateContent(prompt);
    return (result.response.text() || '').toLowerCase().trim().startsWith('true');
  }

  const { default: OpenAI } = await import('openai');
  const baseURL = provider === 'deepseek' ? 'https://api.deepseek.com' : undefined;
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  const resp = await client.chat.completions.create({
    model,
    max_tokens: 10,
    messages: [{ role: 'user', content: prompt }],
    temperature: condTemp,
  });
  const text = (resp.choices[0]?.message?.content || '').toLowerCase().trim();
  return text.startsWith('true');
}

interface PackedServerResult {
  output: string;
  handleOutputs: Record<string, string>;
  handleResults: Record<string, HandleResult>;
  overallStatus: 'completed' | 'partial' | 'error';
}

async function runPackedNodeServer(
  node: Node,
  input: string,
  logs: string[],
): Promise<PackedServerResult> {
  const data = getNodeData(node);
  const packName = (data.packName as string) || '';
  const nodeLabel = (data.label as string) || 'Pack';
  const inlineFlow = data.inlineFlow as { nodes: Node[]; edges: Edge[] } | undefined;

  if (!packName && !inlineFlow) {
    return { output: input, handleOutputs: {}, handleResults: {}, overallStatus: 'completed' };
  }

  // Load internal flow
  let internalNodes: Node[];
  let internalEdges: Edge[];

  if (inlineFlow) {
    internalNodes = inlineFlow.nodes || [];
    internalEdges = inlineFlow.edges || [];
  } else {
    const packDir = path.join(PACKS_DIR, packName);
    const flowStr = await fsPromises.readFile(path.join(packDir, 'flow.json'), 'utf-8').catch(() => '');
    if (!flowStr) throw new Error(`Failed to load pack "${packName}"`);
    const packFlow = JSON.parse(flowStr) as { nodes: Node[]; edges: Edge[] };
    internalNodes = packFlow.nodes || [];
    internalEdges = packFlow.edges || [];
  }

  if (internalNodes.length === 0) {
    return { output: input, handleOutputs: {}, handleResults: {}, overallStatus: 'completed' };
  }

  logs.push(`[packed] ${nodeLabel}: executing sub-flow (${internalNodes.length} nodes)`);

  const sorted = topologicalSort(internalNodes, internalEdges);
  const completedIds = new Set<string>();
  const skippedIds = new Set<string>();
  const failedIds = new Set<string>();
  const nodeOutputs = new Map<string, string>();

  // Sequential scheduler for internal nodes (server-side simplicity)
  const remaining = [...sorted];
  let stuckIterations = 0;
  const maxStuckIterations = remaining.length * 2;

  while (remaining.length > 0 && stuckIterations < maxStuckIterations) {
    let madeProgress = false;

    for (let i = 0; i < remaining.length; i++) {
      const iNode = remaining[i];
      const nid = iNode.id;

      if (skippedIds.has(nid)) {
        completedIds.add(nid);
        nodeOutputs.set(nid, '');
        remaining.splice(i, 1);
        i--;
        madeProgress = true;
        continue;
      }

      // Propagate upstream failure
      const upstreamIds = internalEdges.filter(e => e.target === nid).map(e => e.source);
      if (upstreamIds.some(uid => failedIds.has(uid))) {
        failedIds.add(nid);
        remaining.splice(i, 1);
        i--;
        const iLabel = (getNodeData(iNode).label as string) || iNode.type || '?';
        logs.push(`[packed] ${nodeLabel} › ${iLabel}: skipped (upstream failure)`);
        madeProgress = true;
        continue;
      }

      if (!areUpstreamsCompleteOrSkipped(nid, internalEdges, completedIds, skippedIds)) continue;

      const iLabel = (getNodeData(iNode).label as string) || iNode.type || '?';
      const upstreamOutput = internalEdges
        .filter(e => e.target === nid)
        .map(e => nodeOutputs.get(e.source) || '')
        .filter(Boolean)
        .join('\n\n');
      const nodeInput = upstreamOutput || input;

      try {
        let output = nodeInput;

        if (iNode.type === 'io') {
          output = input;
        } else if (iNode.type === 'agent') {
          logs.push(`[packed] ${nodeLabel} › ${iLabel}: starting agent`);
          output = await runAgentServer(iNode, nodeInput);
          logs.push(`[packed] ${nodeLabel} › ${iLabel}: done`);
        } else if (iNode.type === 'condition') {
          const result = await evaluateConditionServer(iNode, nodeInput);
          markBranchSkipped(nid, result ? 'false-handle' : 'true-handle', internalEdges, completedIds, skippedIds);
          logs.push(`[packed] ${nodeLabel} › ${iLabel}: condition → ${result}`);
          output = nodeInput;
        } else if (iNode.type === 'output') {
          output = nodeInput;
          logs.push(`[packed] ${nodeLabel} › ${iLabel}: output collected`);
        } else if (iNode.type === 'packed') {
          // Nested pack
          const nested = await runPackedNodeServer(iNode, nodeInput, logs);
          output = nested.output;
        } else {
          output = nodeInput;
        }

        nodeOutputs.set(nid, output);
        completedIds.add(nid);
      } catch (err) {
        failedIds.add(nid);
        logs.push(`[packed] ${nodeLabel} › ${iLabel}: error — ${err instanceof Error ? err.message : 'Unknown'}`);
      }

      remaining.splice(i, 1);
      i--;
      madeProgress = true;
    }

    if (!madeProgress) stuckIterations++;
    else stuckIterations = 0;
  }

  // Per-handle outputs and status
  const handleConfig = (data.handleConfig as Array<{ id: string; type: string; internalNodeId: string }>) || [];
  const handleOutputs: Record<string, string> = {};
  const handleResults: Record<string, HandleResult> = {};
  for (const h of handleConfig) {
    if (h.type === 'output') {
      const internalId = h.internalNodeId;
      if (failedIds.has(internalId)) {
        handleResults[h.id] = { status: 'error', error: 'Internal node failed' };
        handleOutputs[h.id] = '';
      } else if (skippedIds.has(internalId)) {
        handleResults[h.id] = { status: 'skipped' };
        handleOutputs[h.id] = '';
      } else {
        handleResults[h.id] = { status: 'completed', output: nodeOutputs.get(internalId) || '' };
        handleOutputs[h.id] = nodeOutputs.get(internalId) || '';
      }
    }
  }

  // Determine overall status
  const outputHandleResults = Object.values(handleResults);
  let overallStatus: 'completed' | 'partial' | 'error';
  if (outputHandleResults.length === 0) {
    overallStatus = failedIds.size === 0 ? 'completed' : 'error';
  } else {
    const allCompleted = outputHandleResults.every(r => r.status === 'completed');
    const allFailed = outputHandleResults.every(r => r.status === 'error' || r.status === 'skipped');
    overallStatus = allCompleted ? 'completed' : allFailed ? 'error' : 'partial';
  }

  // Combined output from successful output nodes
  const outputNodes = sorted.filter(n => n.type === 'output');
  const combined = outputNodes.length > 0
    ? outputNodes
        .filter(n => !failedIds.has(n.id))
        .map(n => nodeOutputs.get(n.id) || '').filter(Boolean).join('\n\n')
    : nodeOutputs.get(sorted[sorted.length - 1]?.id || '') || input;

  const statusLabel = overallStatus === 'partial' ? 'partial success' : overallStatus;
  logs.push(`[packed] ${nodeLabel}: ${statusLabel}`);

  return { output: combined, handleOutputs, handleResults, overallStatus };
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

  await fsPromises.writeFile(
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
    const handleOutputsMap = new Map<string, Record<string, string>>();
    const handleResultsMap = new Map<string, Record<string, HandleResult>>();
    const logs: string[] = [];
    let finalOutput = '';

    // Process ALL io nodes — each is an independent entry point
    const inputNodes = sorted.filter((n) => n.type === 'io');
    let firstInputUsed = false;
    for (const ioNode of inputNodes) {
      const ioData = getNodeData(ioNode);
      const ioText = (ioData.inputText as string | undefined) || '';
      const applyUserInput = !firstInputUsed && (!ioText.trim() || inputNodes.length === 1);
      const nodeInput = (applyUserInput ? (ioText || input) : ioText) || 'Start';
      if (applyUserInput) firstInputUsed = true;
      completed.add(ioNode.id);
      outputs.set(ioNode.id, nodeInput);
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

          // Check per-handle status: if this node connects to a pack's failed handle, mark it error
          const incomingEdges = edges.filter(e => e.target === node.id && !loopEdgeIds.has(e.id));
          const failedHandle = incomingEdges.find(e => {
            const hr = handleResultsMap.get(e.source);
            if (!hr || !e.sourceHandle) return false;
            const hs = hr[e.sourceHandle]?.status;
            return hs === 'error' || hs === 'skipped';
          });
          if (failedHandle) {
            const label = (getNodeData(node).label as string | undefined) || node.id;
            logs.push(`[${node.type}] ${label}: error (upstream Pack output failed)`);
            completed.add(node.id);
            outputs.set(node.id, '');
            progress = true;
            continue;
          }

          // Gather upstream outputs with per-handle routing
          const upstream = edges
            .filter((e) => e.target === node.id && !loopEdgeIds.has(e.id))
            .map((e) => {
              const hOutputs = handleOutputsMap.get(e.source);
              if (hOutputs && e.sourceHandle && hOutputs[e.sourceHandle] !== undefined) {
                return hOutputs[e.sourceHandle];
              }
              return outputs.get(e.source) || '';
            })
            .filter(Boolean)
            .join('\n\n');
          const nodeInput = upstream || input || 'Start';
          const label = (getNodeData(node).label as string | undefined) || node.id;
          logs.push(`[${node.type}] ${label}: starting`);

          let output = '';
          if (node.type === 'agent') {
            output = await runAgentServer(node, nodeInput);
          } else if (node.type === 'condition') {
            const result = await evaluateConditionServer(node, nodeInput);
            logs.push(`[condition] -> ${result ? 'true' : 'false'}`);

            if (!result && loopEdgeIds.size > 0) {
              const falseBackEdge = edges.find(
                (e) => e.source === node.id && e.sourceHandle === 'false-handle' && loopEdgeIds.has(e.id)
              );
              if (falseBackEdge) {
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
          } else if (node.type === 'packed') {
            const packResult = await runPackedNodeServer(node, nodeInput, logs);
            output = packResult.output;
            if (Object.keys(packResult.handleOutputs).length > 0) {
              handleOutputsMap.set(node.id, packResult.handleOutputs);
            }
            if (Object.keys(packResult.handleResults).length > 0) {
              handleResultsMap.set(node.id, packResult.handleResults);
            }
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
      await fsPromises.writeFile(runFile, JSON.stringify({ runId, status: 'done', output: finalOutput, logs, error: null }), 'utf-8');
    } catch (err) {
      await fsPromises.writeFile(
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
