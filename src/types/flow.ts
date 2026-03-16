import type { Node, Edge } from '@xyflow/react';

export interface FlowMeta {
  id: string;
  name: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
}

export interface FlowData {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
}
