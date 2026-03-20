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
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

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

    // Binary file — return raw with appropriate headers
    const isDownload = searchParams.get('download') === '1';
    const ext = path.extname(normalized).toLowerCase();
    const BINARY_EXTS = new Set(['.pptx', '.xlsx', '.docx', '.pdf', '.zip', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.mp4', '.wav']);

    if (isDownload || BINARY_EXTS.has(ext)) {
      const buffer = await fs.readFile(fullPath);
      const MIME_MAP: Record<string, string> = {
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.pdf': 'application/pdf',
        '.zip': 'application/zip',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      const fileName = path.basename(normalized);
      const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_');
      const encodedName = encodeURIComponent(fileName).replace(/['()]/g, escape);

      // PDF: use inline disposition for iframe preview, attachment for explicit downloads
      const disposition = ext === '.pdf' && !isDownload
        ? `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
        : `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;

      return new Response(buffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': disposition,
          'Content-Length': String(buffer.length),
        },
      });
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

// POST — upload binary file via FormData (multipart)
export async function POST(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  const { flowId } = await params;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const filePath = formData.get('path') as string | null;

    if (!file || !filePath) {
      return NextResponse.json({ error: 'file and path are required' }, { status: 400 });
    }

    const normalized = path.normalize(filePath).replace(/\\/g, '/');
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const wsDir = await getWorkspaceDir(flowId);
    const fullPath = path.join(wsDir, normalized);

    if (!fullPath.startsWith(path.resolve(wsDir) + path.sep)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(fullPath, buffer);

    return NextResponse.json({ ok: true, path: normalized, size: buffer.length });
  } catch (err) {
    console.error('[workspace file POST]', err);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

// DELETE ?path=relative/path — delete a file
export async function DELETE(req: Request, { params }: Params) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  const { flowId } = await params;
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
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

    await fs.unlink(fullPath);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
