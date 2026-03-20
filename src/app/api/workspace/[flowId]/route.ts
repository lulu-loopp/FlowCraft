import { NextResponse } from 'next/server';
import { initWorkspace, listFiles, buildSessionContext } from '@/lib/workspace-manager';
import { requireMutationAuth } from '@/lib/api-auth';

interface Params {
  params: Promise<{ flowId: string }>;
}

// GET ?nodeId=xxx  → session context for an agent node
// GET (no nodeId)  → list workspace files
export async function GET(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  const { flowId } = await params;
  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get('nodeId');

  try {
    if (nodeId) {
      const context = await buildSessionContext(flowId, nodeId);
      return NextResponse.json({ context });
    }
    const files = await listFiles(flowId);
    return NextResponse.json({ files });
  } catch (err) {
    console.error('[workspace GET]', err);
    return NextResponse.json({ files: [], context: '' });
  }
}

// POST → initialize workspace structure for the flow
export async function POST(_req: Request, { params }: Params) {
  const denied = await requireMutationAuth(_req);
  if (denied) return denied;

  const { flowId } = await params;
  try {
    await initWorkspace(flowId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[workspace POST]', err);
    return NextResponse.json({ error: 'Failed to init workspace' }, { status: 500 });
  }
}
