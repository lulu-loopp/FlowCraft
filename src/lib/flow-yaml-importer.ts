import YAML from 'yaml';
import type { Node, Edge } from '@xyflow/react';
import type { FlowData } from '@/types/flow';

interface YamlNode {
  id?: string;
  type?: string;
  position?: { x: number; y: number };
  label?: string;
  data?: Record<string, unknown>;
}

interface YamlEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

interface YamlFlow {
  name?: string;
  version?: string;
  created?: string;
  nodes?: YamlNode[];
  edges?: YamlEdge[];
}

/** Parse YAML text into a FlowData object, generating new unique IDs for all nodes */
export function yamlToFlow(yamlText: string): { flow: Omit<FlowData, 'id'>; nodeCount: number } {
  const parsed = YAML.parse(yamlText) as YamlFlow;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML: expected an object');
  }

  const yamlNodes = parsed.nodes || [];
  const yamlEdges = parsed.edges || [];

  // Build ID mapping: old id → new unique id
  const idMap = new Map<string, string>();
  const now = Date.now();

  for (let i = 0; i < yamlNodes.length; i++) {
    const yn = yamlNodes[i];
    const oldId = yn.id || `node-${i}`;
    const type = yn.type || 'agent';
    const newId = `${type}-${now + i}`;
    idMap.set(oldId, newId);
  }

  // Convert nodes
  const nodes: Node[] = yamlNodes.map((yn, i) => {
    const oldId = yn.id || `node-${i}`;
    const newId = idMap.get(oldId)!;
    const type = yn.type || 'agent';

    const data: Record<string, unknown> = {
      label: yn.label || yn.data?.label || `${type} node`,
      ...((yn.data || {}) as Record<string, unknown>),
    };

    // Remove label from data if it was set at top level
    if (yn.label && data.label === yn.label) {
      // label is already set, that's fine
    }

    return {
      id: newId,
      type,
      position: yn.position || { x: 100 + i * 300, y: 300 },
      data,
    };
  });

  // Convert edges with remapped IDs
  const edges: Edge[] = yamlEdges
    .filter(ye => ye.source && ye.target)
    .map(ye => {
      const source = idMap.get(ye.source) || ye.source;
      const target = idMap.get(ye.target) || ye.target;
      return {
        id: `xy-edge__${source}-${target}`,
        type: 'custom' as const,
        source,
        target,
        ...(ye.sourceHandle ? { sourceHandle: ye.sourceHandle } : {}),
        ...(ye.targetHandle ? { targetHandle: ye.targetHandle } : {}),
        ...(ye.label ? { label: ye.label } : {}),
      };
    });

  const nowIso = new Date().toISOString();

  return {
    flow: {
      name: parsed.name || 'Imported Flow',
      nodes,
      edges,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    nodeCount: nodes.length,
  };
}
