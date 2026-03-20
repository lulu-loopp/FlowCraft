import { NextResponse } from 'next/server';
import { writeFlow } from '@/lib/flow-storage';
import { yamlToFlow } from '@/lib/flow-yaml-importer';
import { requireMutationAuth } from '@/lib/api-auth';

export async function POST(request: Request) {
  const denied = await requireMutationAuth(request);
  if (denied) return denied;

  try {
    const contentType = request.headers.get('content-type') || '';
    let yamlText: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      yamlText = await file.text();
    } else {
      // Accept raw text body as well
      yamlText = await request.text();
    }

    if (!yamlText.trim()) {
      return NextResponse.json({ error: 'Empty YAML content' }, { status: 400 });
    }

    const { flow: flowData, nodeCount } = yamlToFlow(yamlText);
    const flowId = `flow-${Date.now()}`;
    const flow = await writeFlow(flowId, {
      name: flowData.name,
      nodes: flowData.nodes,
      edges: flowData.edges,
    });

    return NextResponse.json({ flowId: flow.id, nodeCount }, { status: 201 });
  } catch (err) {
    console.error('[import/yaml POST]', err);
    const message = err instanceof Error ? err.message : 'Failed to import YAML';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
