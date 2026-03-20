import { NextResponse } from 'next/server';
import { readFlow } from '@/lib/flow-storage';
import { flowToYaml } from '@/lib/flow-yaml';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const flow = await readFlow(id);
    if (!flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const yaml = flowToYaml(flow);
    const filename = flow.name.replace(/\s+/g, '-').toLowerCase();

    return new Response(yaml, {
      status: 200,
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.yaml"`,
      },
    });
  } catch (err) {
    console.error('[export/yaml GET]', err);
    return NextResponse.json({ error: 'Failed to export flow' }, { status: 500 });
  }
}
