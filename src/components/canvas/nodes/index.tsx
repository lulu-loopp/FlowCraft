import type { NodeProps } from '@xyflow/react';
import { AgentNode } from './agent-node';
import { GenericNode } from './generic-node';
import { InputNode } from './input-node';
import { OutputNode } from './output-node';
import { ConditionNode } from './condition-node';
import { PackedNode } from './packed-node';
import { AiCodingAgentNode } from './ai-coding-agent-node';
import { MergeNode } from './merge-node';
import { DispatcherNode } from './dispatcher-node';

export const nodeTypes = {
  agent: AgentNode,
  tool: (props: NodeProps) => <GenericNode {...props} type="tool" />,
  skill: (props: NodeProps) => <GenericNode {...props} type="skill" />,
  human: (props: NodeProps) => <GenericNode {...props} type="human" />,
  io: InputNode,
  condition: ConditionNode,
  initializer: (props: NodeProps) => <GenericNode {...props} type="system" />,
  output: OutputNode,
  packed: PackedNode,
  aiCodingAgent: AiCodingAgentNode,
  merge: MergeNode,
  dispatcher: DispatcherNode,
};
