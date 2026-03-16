import fs from 'fs/promises';
import path from 'path';
import type { FlowData, FlowMeta } from '@/types/flow';

export const FLOWS_DIR = path.join(process.cwd(), 'flows');
const INDEX_FILE = path.join(FLOWS_DIR, 'index.json');

async function ensureDir(): Promise<void> {
  await fs.mkdir(FLOWS_DIR, { recursive: true });
}

async function readIndex(): Promise<FlowMeta[]> {
  try {
    const raw = await fs.readFile(INDEX_FILE, 'utf-8');
    return JSON.parse(raw) as FlowMeta[];
  } catch {
    return [];
  }
}

async function writeIndex(index: FlowMeta[]): Promise<void> {
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

export async function listFlows(): Promise<FlowMeta[]> {
  await ensureDir();
  return readIndex();
}

export async function readFlow(id: string): Promise<FlowData | null> {
  await ensureDir();
  const filePath = path.join(FLOWS_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as FlowData;
  } catch {
    return null;
  }
}

export async function writeFlow(
  id: string,
  data: Partial<FlowData> & { name: string }
): Promise<FlowData> {
  await ensureDir();
  const filePath = path.join(FLOWS_DIR, `${id}.json`);

  let existing: FlowData | null = null;
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // new flow
  }

  const now = new Date().toISOString();
  const flow: FlowData = {
    id,
    name: data.name,
    nodes: data.nodes ?? existing?.nodes ?? [],
    edges: data.edges ?? existing?.edges ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastRunAt: data.lastRunAt ?? existing?.lastRunAt,
  };

  await fs.writeFile(filePath, JSON.stringify(flow, null, 2), 'utf-8');

  // Update index
  const index = await readIndex();
  const meta: FlowMeta = {
    id: flow.id,
    name: flow.name,
    nodeCount: flow.nodes.length,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
    lastRunAt: flow.lastRunAt,
  };
  const idx = index.findIndex((m) => m.id === id);
  if (idx >= 0) {
    index[idx] = meta;
  } else {
    index.push(meta);
  }
  await writeIndex(index);

  return flow;
}

export async function deleteFlow(id: string): Promise<boolean> {
  await ensureDir();
  const filePath = path.join(FLOWS_DIR, `${id}.json`);
  try {
    await fs.unlink(filePath);
  } catch {
    return false;
  }
  const index = await readIndex();
  await writeIndex(index.filter((m) => m.id !== id));
  return true;
}

export async function createFlow(name?: string): Promise<FlowData> {
  const id = `flow-${Date.now()}`;
  return writeFlow(id, { name: name || 'Untitled Flow' });
}

export async function ensureDefaultFlow(): Promise<void> {
  await ensureDir();
  const filePath = path.join(FLOWS_DIR, 'default-flow.json');
  try {
    await fs.access(filePath);
  } catch {
    await writeFlow('default-flow', { name: 'Default Flow', nodes: [], edges: [] });
  }
}
