import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { addAgentEntry } from '@/lib/registry-manager';
import { requireMutationAuth } from '@/lib/api-auth';

const AGENTS_DIR = path.join(process.cwd(), 'agents');

export async function POST(req: Request) {
  const denied = await requireMutationAuth(req);
  if (denied) return denied;

  try {
    const body = await req.json() as { name: string; description?: string; instructions: string };
    const cleanName = body.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
    if (!cleanName) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });

    const description = body.description || `Packed agent: ${cleanName}`;
    const content = [
      '---',
      `name: ${cleanName}`,
      `description: ${description}`,
      'model: claude-sonnet-4-6',
      '---',
      '',
      body.instructions,
    ].join('\n');

    const agentDir = path.join(AGENTS_DIR, cleanName);
    await fs.mkdir(agentDir, { recursive: true });
    await fs.writeFile(path.join(agentDir, `${cleanName}.md`), content, 'utf-8');

    await addAgentEntry({
      name: cleanName,
      description,
      source: 'local',
      installedAt: Date.now(),
      enabled: true,
      path: `agents/${cleanName}`,
    });

    return NextResponse.json({ name: cleanName });
  } catch (err) {
    console.error('[agents/local POST]', err);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
