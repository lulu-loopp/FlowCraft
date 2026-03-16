import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { FLOWS_DIR } from '@/lib/flow-storage';
import type { RunRecord } from '@/store/flowStore';

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
  return NextResponse.json(await readRuns(id));
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
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
