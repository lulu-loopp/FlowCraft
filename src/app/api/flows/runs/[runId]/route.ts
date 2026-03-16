import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { FLOWS_DIR } from '@/lib/flow-storage';

interface Params {
  params: Promise<{ runId: string }>;
}

// GET /api/flows/runs/{runId}  → poll run status
export async function GET(_req: Request, { params }: Params) {
  const { runId } = await params;

  // runId format: run-{timestamp}, search for matching file
  try {
    const files = await fs.readdir(FLOWS_DIR);
    const match = files.find(f => f.includes(`-run-${runId}.json`));
    if (!match) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const raw = await fs.readFile(path.join(FLOWS_DIR, match), 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }
}
