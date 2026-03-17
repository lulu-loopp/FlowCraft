import { NextResponse } from 'next/server';
import { listFlows, createFlow } from '@/lib/flow-storage';
import { requireMutationAuth } from '@/lib/api-auth';

export async function GET() {
  try {
    const flows = await listFlows();
    return NextResponse.json(flows);
  } catch (err) {
    console.error('[flows GET]', err);
    return NextResponse.json({ error: 'Failed to list flows' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireMutationAuth(request);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const flow = await createFlow(body?.name);
    return NextResponse.json(flow, { status: 201 });
  } catch (err) {
    console.error('[flows POST]', err);
    return NextResponse.json({ error: 'Failed to create flow' }, { status: 500 });
  }
}
