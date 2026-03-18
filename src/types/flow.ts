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

/** Shared status type used by all node types */
export type NodeStatus = 'idle' | 'running' | 'success' | 'error' | 'waiting';

/** Data shape for Agent nodes */
export interface AgentNodeData extends Record<string, unknown> {
  label?: string;
  description?: string;
  status?: NodeStatus;
  logs?: { type: string; content: string }[];
  currentToken?: string;
  currentOutput?: string;
  documentUrl?: string;
  documentName?: string;
  isReference?: boolean;
  systemPrompt?: string;
  enabledTools?: string[];
  enabledSkills?: string[];
  model?: string;
  provider?: string;
  maxIterations?: number;
  personality?: import('@/lib/personality-injector').PersonalityConfig;
  individualName?: string;
  _flowId?: string;
  _overrideSystemPrompt?: string;
}

/** Data shape for Condition nodes */
export interface ConditionNodeData extends Record<string, unknown> {
  conditionMode?: 'natural' | 'expression';
  conditionValue?: string;
  provider?: string;
  model?: string;
  status?: NodeStatus;
}

/** Data shape for AI Coding Agent nodes */
export interface AiCodingNodeData extends Record<string, unknown> {
  label?: string;
  cli?: string;
  taskDescription?: string;
  workDir?: string;
  maxTimeout?: number;
  status?: NodeStatus;
  currentOutput?: string;
}

/** File attached to an Input node (image or text) */
export interface InputFile {
  name: string
  type: 'image' | 'text'
  content?: string
  base64?: string
  mimeType?: string
  preview?: string
}

/** Data shape for Output nodes */
export interface OutputNodeData extends Record<string, unknown> {
  label?: string;
  currentOutput?: string;
  status?: NodeStatus;
  documents?: { url: string; name: string }[];
  documentUrl?: string;
  documentName?: string;
}
