import fs from 'fs/promises';
import path from 'path';
import type { FlowData, FlowMeta } from '@/types/flow';
import { removeWorkspace } from '@/lib/workspace-manager';

export const FLOWS_DIR = path.join(process.cwd(), 'flows');

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
export function assertSafeId(id: string): void {
  if (!SAFE_ID_RE.test(id)) {
    throw new Error(`Invalid flow id: ${id}`);
  }
}
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
  const index = await readIndex();
  // Remove index entries whose JSON file no longer exists (self-healing)
  const valid: FlowMeta[] = [];
  let changed = false;
  for (const meta of index) {
    const filePath = path.join(FLOWS_DIR, `${meta.id}.json`);
    try {
      await fs.access(filePath);
      valid.push(meta);
    } catch {
      changed = true; // orphaned entry
    }
  }

  // Discover flow files on disk that are missing from the index
  const indexedIds = new Set(valid.map(m => m.id));
  try {
    const files = await fs.readdir(FLOWS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'index.json') continue;
      const id = file.replace(/\.json$/, '');
      // Skip run records and non-flow files
      if (!SAFE_ID_RE.test(id) || indexedIds.has(id)) continue;
      if (/-runs$/.test(id) || /-run-/.test(id)) continue;
      try {
        const raw = await fs.readFile(path.join(FLOWS_DIR, file), 'utf-8');
        const data = JSON.parse(raw) as FlowData;
        valid.push({
          id,
          name: data.name || id,
          nodeCount: data.nodes?.length ?? 0,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          lastRunAt: data.lastRunAt,
        });
        changed = true;
      } catch { /* skip unparseable files */ }
    }
  } catch { /* readdir failure is non-critical */ }

  if (changed) await writeIndex(valid);
  return valid;
}

export async function readFlow(id: string): Promise<FlowData | null> {
  assertSafeId(id);
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
  assertSafeId(id);
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

// ── Trash / Recycle Bin ──
const TRASH_DIR = path.join(FLOWS_DIR, '.trash');
const TRASH_INDEX = path.join(TRASH_DIR, 'index.json');

async function ensureTrashDir(): Promise<void> {
  await fs.mkdir(TRASH_DIR, { recursive: true });
}

async function readTrashIndex(): Promise<(FlowMeta & { deletedAt: string })[]> {
  try {
    const raw = await fs.readFile(TRASH_INDEX, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeTrashIndex(index: (FlowMeta & { deletedAt: string })[]): Promise<void> {
  await fs.writeFile(TRASH_INDEX, JSON.stringify(index, null, 2), 'utf-8');
}

/** Remove run record files associated with a flow */
async function cleanupRunFiles(id: string): Promise<void> {
  try {
    const files = await fs.readdir(FLOWS_DIR);
    for (const file of files) {
      if (file.startsWith(`${id}-run`) && file.endsWith('.json')) {
        await fs.unlink(path.join(FLOWS_DIR, file)).catch(() => {});
      }
    }
    // Also remove the consolidated runs file
    await fs.unlink(path.join(FLOWS_DIR, `${id}-runs.json`)).catch(() => {});
  } catch { /* readdir failure is non-critical */ }
}

export async function deleteFlow(id: string): Promise<boolean> {
  assertSafeId(id);
  await ensureDir();
  await ensureTrashDir();
  const filePath = path.join(FLOWS_DIR, `${id}.json`);

  // Move file to trash instead of deleting
  try {
    await fs.rename(filePath, path.join(TRASH_DIR, `${id}.json`));
  } catch {
    return false;
  }

  // Clean up run record files (not needed after trash)
  await cleanupRunFiles(id);

  // Remove from main index, add to trash index
  const index = await readIndex();
  const meta = index.find(m => m.id === id);
  await writeIndex(index.filter(m => m.id !== id));

  const trashIndex = await readTrashIndex();
  trashIndex.push({
    id,
    name: meta?.name || id,
    nodeCount: meta?.nodeCount ?? 0,
    createdAt: meta?.createdAt || new Date().toISOString(),
    updatedAt: meta?.updatedAt || new Date().toISOString(),
    lastRunAt: meta?.lastRunAt,
    deletedAt: new Date().toISOString(),
  });
  await writeTrashIndex(trashIndex);
  return true;
}

export async function listTrash(): Promise<(FlowMeta & { deletedAt: string })[]> {
  await ensureTrashDir();
  const trashIndex = await readTrashIndex();
  // Self-healing: remove entries whose file no longer exists
  const valid = [];
  let changed = false;
  for (const meta of trashIndex) {
    try {
      await fs.access(path.join(TRASH_DIR, `${meta.id}.json`));
      valid.push(meta);
    } catch {
      changed = true;
    }
  }
  if (changed) await writeTrashIndex(valid);
  return valid;
}

export async function restoreFlow(id: string): Promise<boolean> {
  assertSafeId(id);
  await ensureTrashDir();
  const trashPath = path.join(TRASH_DIR, `${id}.json`);
  const restorePath = path.join(FLOWS_DIR, `${id}.json`);

  try {
    await fs.rename(trashPath, restorePath);
  } catch {
    return false;
  }

  // Remove from trash index
  const trashIndex = await readTrashIndex();
  const meta = trashIndex.find(m => m.id === id);
  await writeTrashIndex(trashIndex.filter(m => m.id !== id));

  // Add back to main index (upsert to avoid duplicates)
  const index = await readIndex();
  const flowMeta = {
    id,
    name: meta?.name || id,
    nodeCount: meta?.nodeCount ?? 0,
    createdAt: meta?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunAt: meta?.lastRunAt,
  };
  const existingIdx = index.findIndex(f => f.id === id);
  if (existingIdx >= 0) {
    index[existingIdx] = flowMeta;
  } else {
    index.push(flowMeta);
  }
  await writeIndex(index);
  return true;
}

export async function permanentDeleteFlow(id: string): Promise<boolean> {
  assertSafeId(id);
  await ensureTrashDir();
  try {
    await fs.unlink(path.join(TRASH_DIR, `${id}.json`));
  } catch {
    return false;
  }
  const trashIndex = await readTrashIndex();
  await writeTrashIndex(trashIndex.filter(m => m.id !== id));

  // Clean up workspace folder and any remaining run files
  await removeWorkspace(id);
  await cleanupRunFiles(id);
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
