import type { FlowData } from '@/types/flow';

function yamlStr(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) return 'null';

  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'number') return String(value);

  if (typeof value === 'string') {
    if (value === '') return "''";
    // Use block scalar for multiline
    if (value.includes('\n')) {
      const lines = value.split('\n');
      return '|\n' + lines.map((l) => pad + '  ' + l).join('\n');
    }
    // Quote strings that have special chars or look like numbers/booleans
    if (/[:#{}[\],&*?|<>=!%@`]/.test(value) || /^(true|false|null|\d)/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return '\n' + value.map((item) => `${pad}- ${yamlStr(item, indent + 1).trimStart()}`).join('\n');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined
    );
    if (entries.length === 0) return '{}';
    return (
      '\n' +
      entries
        .map(([k, v]) => {
          const vStr = yamlStr(v, indent + 1);
          if (vStr.startsWith('\n')) return `${pad}  ${k}:${vStr}`;
          return `${pad}  ${k}: ${vStr}`;
        })
        .join('\n')
    );
  }

  return String(value);
}

function buildNodeYaml(node: FlowData['nodes'][number]): string {
  const lines: string[] = [];
  lines.push(`  - id: ${node.id}`);
  lines.push(`    type: ${node.type ?? 'unknown'}`);
  if (node.data?.label) lines.push(`    label: ${yamlStr(node.data.label)}`);
  lines.push(`    position:`);
  lines.push(`      x: ${Math.round(node.position.x)}`);
  lines.push(`      y: ${Math.round(node.position.y)}`);

  const dataKeys = Object.keys(node.data || {}).filter(
    (k) => k !== 'label' && k !== 'status' && k !== 'logs'
  );
  if (dataKeys.length > 0) {
    lines.push('    config:');
    for (const k of dataKeys) {
      const v = (node.data as Record<string, unknown>)[k];
      const vStr = yamlStr(v, 3);
      if (vStr.startsWith('\n')) {
        lines.push(`      ${k}:${vStr}`);
      } else {
        lines.push(`      ${k}: ${vStr}`);
      }
    }
  }

  return lines.join('\n');
}

function buildEdgeYaml(edge: FlowData['edges'][number]): string {
  const lines: string[] = [];
  lines.push(`  - id: ${edge.id}`);
  lines.push(`    source: ${edge.source}`);
  lines.push(`    target: ${edge.target}`);
  if (edge.sourceHandle) lines.push(`    sourceHandle: ${edge.sourceHandle}`);
  if (edge.targetHandle) lines.push(`    targetHandle: ${edge.targetHandle}`);
  if (edge.label) lines.push(`    label: ${yamlStr(edge.label)}`);
  return lines.join('\n');
}

export function flowToYaml(flow: FlowData): string {
  const lines: string[] = [];
  lines.push(`# FlowCraft exported flow`);
  lines.push(`id: ${flow.id}`);
  lines.push(`name: ${yamlStr(flow.name)}`);
  lines.push(`createdAt: ${flow.createdAt}`);
  lines.push(`updatedAt: ${flow.updatedAt}`);
  if (flow.lastRunAt) lines.push(`lastRunAt: ${flow.lastRunAt}`);
  lines.push('');

  if (flow.nodes.length > 0) {
    lines.push('nodes:');
    for (const node of flow.nodes) {
      lines.push(buildNodeYaml(node));
    }
  } else {
    lines.push('nodes: []');
  }

  lines.push('');

  if (flow.edges.length > 0) {
    lines.push('edges:');
    for (const edge of flow.edges) {
      lines.push(buildEdgeYaml(edge));
    }
  } else {
    lines.push('edges: []');
  }

  lines.push('');
  return lines.join('\n');
}
