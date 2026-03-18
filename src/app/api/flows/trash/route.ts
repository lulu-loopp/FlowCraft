import { NextResponse } from 'next/server';
import { listTrash, emptyTrash } from '@/lib/flow-storage';
import { requireMutationAuth } from '@/lib/api-auth';

// GET — list all trashed flows
export async function GET() {
  try {
    const items = await listTrash();
    return NextResponse.json(items);
  } catch (err) {
    console.error('[flows/trash GET]', err);
    return NextResponse.json([], { status: 500 });
  }
}

// DELETE — permanently delete all trashed flows
export async function DELETE(req: Request) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  try {
    const count = await emptyTrash();
    return NextResponse.json({ success: true, deleted: count });
  } catch (err) {
    console.error('[flows/trash DELETE]', err);
    return NextResponse.json({ error: 'Failed to empty trash' }, { status: 500 });
  }
}
