import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { FLOWS_DIR, assertSafeId } from '@/lib/flow-storage';
import type { RunRecord } from '@/store/flowStore';
import { requireMutationAuth } from '@/lib/api-auth';

interface Params {
  params: Promise<{ id: string }>;
}

function runsFile(flowId: string) {
  return path.join(FLOWS_DIR, `${flowId}-runs.json`);
}

async function readRuns(flowId: string): Promise<RunRecord[]> {
  try {
    const raw = await fs.readFile(runsFile(flowId), 'utf-8');
    return JSON.parse(raw) as RunRecord[];
  } catch {
    return [];
  }
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    assertSafeId(id);
  } catch {
    return NextResponse.json({ error: 'Invalid flow id' }, { status: 400 });
  }
  return NextResponse.json(await readRuns(id));
}

export async function POST(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    assertSafeId(id);
  } catch {
    return NextResponse.json({ error: 'Invalid flow id' }, { status: 400 });
  }

  try {
    const record = await req.json() as RunRecord;
    const runs = await readRuns(id);
    runs.unshift(record);
    const trimmed = runs.slice(0, 50);
    await fs.writeFile(runsFile(id), JSON.stringify(trimmed, null, 2), 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[flows/:id/runs POST]', err);
    return NextResponse.json({ error: 'Failed to save run' }, { status: 500 });
  }
}
