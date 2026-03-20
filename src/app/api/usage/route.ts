import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { FLOWS_DIR } from '@/lib/flow-storage';
import { calculateCost } from '@/types/model';

interface TokenUsageData {
  inputTokens: number;
  outputTokens: number;
}

interface NodeData {
  label?: string;
  provider?: string;
  model?: string;
  tokenUsage?: TokenUsageData;
}

interface FlowNode {
  id: string;
  type?: string;
  data: NodeData;
}

interface FlowFile {
  id: string;
  name?: string;
  nodes?: FlowNode[];
}

interface ByModelEntry {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  calls: number;
}

interface ByFlowEntry {
  flowId: string;
  flowName: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  nodeCount: number;
}

interface ByNodeEntry {
  flowId: string;
  nodeId: string;
  nodeLabel: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export async function GET() {
  try {
    // Read all flow JSON files from flows directory
    let files: string[];
    try {
      files = await fs.readdir(FLOWS_DIR);
    } catch {
      return NextResponse.json({
        totalInput: 0,
        totalOutput: 0,
        totalCost: 0,
        byModel: [],
        byFlow: [],
        byNode: [],
      });
    }

    const flowFiles = files.filter(f => f.startsWith('flow-') && f.endsWith('.json'));

    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;

    const modelMap = new Map<string, ByModelEntry>();
    const byFlow: ByFlowEntry[] = [];
    const byNode: ByNodeEntry[] = [];

    for (const file of flowFiles) {
      try {
        const raw = await fs.readFile(path.join(FLOWS_DIR, file), 'utf-8');
        const flow: FlowFile = JSON.parse(raw);
        if (!flow.nodes || !Array.isArray(flow.nodes)) continue;

        let flowInput = 0;
        let flowOutput = 0;
        let flowCost = 0;
        let flowNodeCount = 0;

        for (const node of flow.nodes) {
          const usage = node.data?.tokenUsage;
          if (!usage || (!usage.inputTokens && !usage.outputTokens)) continue;

          const model = node.data.model || 'unknown';
          const provider = node.data.provider || 'unknown';
          const label = node.data.label || node.id;
          const inp = usage.inputTokens || 0;
          const out = usage.outputTokens || 0;
          const cost = calculateCost(model, inp, out);

          totalInput += inp;
          totalOutput += out;
          totalCost += cost;

          flowInput += inp;
          flowOutput += out;
          flowCost += cost;
          flowNodeCount++;

          // Aggregate by model
          const key = `${provider}:${model}`;
          const existing = modelMap.get(key);
          if (existing) {
            existing.inputTokens += inp;
            existing.outputTokens += out;
            existing.cost += cost;
            existing.calls += 1;
          } else {
            modelMap.set(key, { model, provider, inputTokens: inp, outputTokens: out, cost, calls: 1 });
          }

          // By node
          byNode.push({
            flowId: flow.id,
            nodeId: node.id,
            nodeLabel: label,
            model,
            inputTokens: inp,
            outputTokens: out,
            cost,
          });
        }

        if (flowNodeCount > 0) {
          byFlow.push({
            flowId: flow.id,
            flowName: flow.name || flow.id,
            inputTokens: flowInput,
            outputTokens: flowOutput,
            cost: flowCost,
            nodeCount: flowNodeCount,
          });
        }
      } catch {
        // Skip malformed files
        continue;
      }
    }

    const byModel = Array.from(modelMap.values()).sort((a, b) => b.cost - a.cost);
    byFlow.sort((a, b) => b.cost - a.cost);

    return NextResponse.json({
      totalInput,
      totalOutput,
      totalCost,
      byModel,
      byFlow,
      byNode,
    });
  } catch (err) {
    console.error('[usage GET]', err);
    return NextResponse.json({ error: 'Failed to aggregate usage data' }, { status: 500 });
  }
}
