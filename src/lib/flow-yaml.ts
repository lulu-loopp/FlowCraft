import type { FlowData } from '@/types/flow';
import type { Node } from '@xyflow/react';

// ── Runtime fields to strip from exported YAML ──
const RUNTIME_FIELDS = new Set([
  'status', 'logs', 'currentOutput', 'currentToken',
  'conditionResult', 'handleResults', 'selected', 'measured', 'dragging',
  'runningInnerNodes', 'completedInnerNodes', 'innerProgress',
  'hasPackUpdate', 'isReference',
]);

// Fields that are always part of node structure, not data
const STRUCTURAL_FIELDS = new Set(['label']);

/** Escape a YAML string value, using block scalars for multiline */
function yamlValue(value: unknown, indent: number): string {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);

  if (typeof value === 'string') {
    if (value === '') return "''";
    if (value.includes('\n')) {
      const lines = value.split('\n');
      return '|\n' + lines.map(l => pad + '  ' + l).join('\n');
    }
    if (/[:#{}[\],&*?|<>=!%@`]/.test(value) || /^(true|false|null|\d)/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    // Simple string/number arrays on one line each
    if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
      return '\n' + value.map(v => `${pad}  - ${yamlValue(v, indent + 1)}`).join('\n');
    }
    return '\n' + value.map(item => {
      const s = yamlValue(item, indent + 1);
      return `${pad}  - ${s.trimStart()}`;
    }).join('\n');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return '\n' + entries.map(([k, v]) => {
      const vStr = yamlValue(v, indent + 1);
      if (vStr.startsWith('\n')) return `${pad}  ${k}:${vStr}`;
      return `${pad}  ${k}: ${vStr}`;
    }).join('\n');
  }

  return String(value);
}

// ── ID simplification ──

/** Build a mapping from original node IDs to simplified human-readable IDs */
function buildIdMap(nodes: Node[]): Map<string, string> {
  const counters = new Map<string, number>();
  const map = new Map<string, string>();

  for (const node of nodes) {
    const prefix = node.type || 'node';
    const count = (counters.get(prefix) || 0) + 1;
    counters.set(prefix, count);
    map.set(node.id, `${prefix}-${count}`);
  }

  return map;
}

// ── Data cleaning ──

/** Strip runtime fields and base64 from inputFiles */
function cleanNodeData(data: Record<string, unknown>, nodeType?: string): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (RUNTIME_FIELDS.has(key)) continue;
    if (STRUCTURAL_FIELDS.has(key)) continue;

    // inputFiles: strip base64/preview, keep name+type as reference
    if (key === 'inputFiles' && Array.isArray(value)) {
      const files = value
        .filter(f => f && typeof f === 'object')
        .map((f: Record<string, unknown>) => ({
          name: f.name,
          type: f.type,
          ...(f.mimeType ? { mimeType: f.mimeType } : {}),
        }));
      if (files.length > 0) clean[key] = files;
      continue;
    }

    // packed node: strip internal metadata, but keep inlineFlow for independent copies (no packName)
    if (key === 'internalNodeNames' || key === 'internalNodeCount' ||
        key === 'internalEdgeCount' || key === 'packVersion') {
      continue;
    }
    // Only strip inlineFlow if the packed node has a packName (shared pack, loadable by reference)
    if (key === 'inlineFlow' && nodeType === 'packed' && data.packName) {
      continue;
    }

    // Skip internal/ephemeral fields
    if (key.startsWith('_')) continue;

    clean[key] = value;
  }

  return clean;
}

// ── Main export ──

export function flowToYaml(flow: FlowData): string {
  const idMap = buildIdMap(flow.nodes);
  const lines: string[] = [];

  lines.push('# FlowCraft Flow');
  lines.push(`name: ${yamlValue(flow.name, 0)}`);
  lines.push(`version: "1.0"`);
  lines.push(`created: ${yamlValue(flow.createdAt, 0)}`);
  lines.push('');

  // Nodes
  if (flow.nodes.length > 0) {
    lines.push('nodes:');
    for (const node of flow.nodes) {
      const simpleId = idMap.get(node.id) || node.id;
      lines.push(`  - id: ${simpleId}`);
      lines.push(`    type: ${node.type ?? 'unknown'}`);
      lines.push(`    position: { x: ${Math.round(node.position.x)}, y: ${Math.round(node.position.y)} }`);

      // Label
      const label = node.data?.label as string | undefined;
      if (label) {
        lines.push(`    label: ${yamlValue(label, 2)}`);
      }

      // Clean data fields
      const data = cleanNodeData((node.data || {}) as Record<string, unknown>, node.type);
      const dataEntries = Object.entries(data);

      if (dataEntries.length > 0) {
        lines.push('    data:');
        for (const [k, v] of dataEntries) {
          const vStr = yamlValue(v, 3);
          if (vStr.startsWith('\n')) {
            lines.push(`      ${k}:${vStr}`);
          } else {
            lines.push(`      ${k}: ${vStr}`);
          }
        }
      }

      lines.push('');
    }
  } else {
    lines.push('nodes: []');
    lines.push('');
  }

  // Edges
  if (flow.edges.length > 0) {
    lines.push('edges:');
    for (const edge of flow.edges) {
      const source = idMap.get(edge.source) || edge.source;
      const target = idMap.get(edge.target) || edge.target;
      lines.push(`  - source: ${source}`);
      lines.push(`    target: ${target}`);
      if (edge.sourceHandle) lines.push(`    sourceHandle: ${edge.sourceHandle}`);
      if (edge.targetHandle) lines.push(`    targetHandle: ${edge.targetHandle}`);
      if (edge.label) lines.push(`    label: ${yamlValue(edge.label, 2)}`);
      lines.push('');
    }
  } else {
    lines.push('edges: []');
  }

  return lines.join('\n');
}
