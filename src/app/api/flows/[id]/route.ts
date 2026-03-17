import { NextResponse } from 'next/server';
import { readFlow, writeFlow, deleteFlow, ensureDefaultFlow } from '@/lib/flow-storage';
import { requireMutationAuth } from '@/lib/api-auth';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    if (id === 'default-flow') await ensureDefaultFlow();
    const flow = await readFlow(id);
    if (!flow) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(flow);
  } catch (err) {
    console.error('[flows/:id GET]', err);
    return NextResponse.json({ error: 'Failed to read flow' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  const denied = await requireMutationAuth(request);
  if (denied) return denied;

  const { id } = await params;
  try {
    const body = await request.json();
    const flow = await writeFlow(id, body);
    return NextResponse.json(flow);
  } catch (err) {
    console.error('[flows/:id PUT]', err);
    return NextResponse.json({ error: 'Failed to save flow' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    const ok = await deleteFlow(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[flows/:id DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete flow' }, { status: 500 });
  }
}
