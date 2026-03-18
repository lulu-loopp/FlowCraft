import { NextResponse } from 'next/server';
import { restoreFlow, permanentDeleteFlow } from '@/lib/flow-storage';
import { requireMutationAuth } from '@/lib/api-auth';

interface Params {
  params: Promise<{ id: string }>;
}

// POST — restore a trashed flow
export async function POST(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    const ok = await restoreFlow(id);
    if (!ok) return NextResponse.json({ error: 'Not found in trash' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[flows/trash/:id POST]', err);
    return NextResponse.json({ error: 'Failed to restore' }, { status: 500 });
  }
}

// DELETE — permanently delete from trash
export async function DELETE(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    const ok = await permanentDeleteFlow(id);
    if (!ok) return NextResponse.json({ error: 'Not found in trash' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[flows/trash/:id DELETE]', err);
    return NextResponse.json({ error: 'Failed to permanently delete' }, { status: 500 });
  }
}
