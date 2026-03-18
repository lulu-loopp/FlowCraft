import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getWorkspaceDir } from '@/lib/workspace-manager';
import { requireMutationAuth } from '@/lib/api-auth';

interface Params {
  params: Promise<{ flowId: string }>;
}

// GET ?path=relative/path — read a single file's content
export async function GET(req: Request, { params }: Params) {
  const { flowId } = await params;
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
  }

  // Prevent path traversal
  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const wsDir = await getWorkspaceDir(flowId);
    const fullPath = path.join(wsDir, normalized);

    // Ensure the resolved path is inside workspace
    if (!fullPath.startsWith(path.resolve(wsDir) + path.sep)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    return NextResponse.json({ content, path: normalized });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

// PUT ?path=relative/path — update a file's content
export async function PUT(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  const { flowId } = await params;
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');
  const { content } = await req.json();

  if (!filePath) {
    return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
  }
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }

  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const wsDir = await getWorkspaceDir(flowId);
    const fullPath = path.join(wsDir, normalized);

    if (!fullPath.startsWith(path.resolve(wsDir) + path.sep)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }
}
