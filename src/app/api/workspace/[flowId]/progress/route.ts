import { NextResponse } from 'next/server';
import { updateProgress, readWorkspaceFile } from '@/lib/workspace-manager';

interface Params {
  params: Promise<{ flowId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { flowId } = await params;
  const content = await readWorkspaceFile(flowId, 'progress.md');
  return NextResponse.json({ content });
}

export async function POST(req: Request, { params }: Params) {
  const { flowId } = await params;
  try {
    const { nodeName, outcome } = await req.json() as { nodeName: string; outcome: string };
    await updateProgress(flowId, nodeName, outcome);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[workspace/progress POST]', err);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}
