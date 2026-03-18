import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getWorkspaceDir } from '@/lib/workspace-manager';
import { requireMutationAuth } from '@/lib/api-auth';

interface Params {
  params: Promise<{ flowId: string }>;
}

// POST — save a document to workspace/docs/
export async function POST(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  const { flowId } = await params;
  const { filename, content } = await req.json();

  if (!filename || !content) {
    return NextResponse.json({ error: 'filename and content required' }, { status: 400 });
  }

  // Sanitize filename
  const safeName = filename.replace(/[^a-zA-Z0-9_.\u4e00-\u9fff-]/g, '_');
  const docsDir = path.join(await getWorkspaceDir(flowId), 'docs');
  await fs.mkdir(docsDir, { recursive: true });
  const filePath = path.join(docsDir, safeName);
  await fs.writeFile(filePath, content, 'utf-8');

  return NextResponse.json({
    ok: true,
    filename: safeName,
    downloadUrl: `/api/workspace/${flowId}/documents?file=${encodeURIComponent(safeName)}`,
  });
}

// GET ?file=xxx — download a document
export async function GET(req: Request, { params }: Params) {
  const { flowId } = await params;
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');

  if (!file) {
    // List all docs
    const docsDir = path.join(await getWorkspaceDir(flowId), 'docs');
    try {
      const files = await fs.readdir(docsDir);
      return NextResponse.json({ files });
    } catch {
      return NextResponse.json({ files: [] });
    }
  }

  const safeName = file.replace(/[^a-zA-Z0-9_.\u4e00-\u9fff-]/g, '_');
  const filePath = path.join(await getWorkspaceDir(flowId), 'docs', safeName);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(safeName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.json': 'application/json',
      '.csv': 'text/csv',
    };
    const contentType = mimeMap[ext] || 'text/plain';

    // RFC 5987 encoding for non-ASCII filenames
    // Use ASCII-only fallback for filename, and filename* for full Unicode support
    const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_');
    const encodedName = encodeURIComponent(safeName).replace(/['()]/g, escape);
    return new Response(content, {
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
