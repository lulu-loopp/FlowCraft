import type { NodeProps } from '@xyflow/react';
import { AgentNode } from './agent-node';
import { GenericNode } from './generic-node';
import { InputNode } from './input-node';
import { OutputNode } from './output-node';
import { ConditionNode } from './condition-node';

export const nodeTypes = {
  agent: AgentNode,
  tool: (props: NodeProps) => <GenericNode {...props} type="tool" />,
  skill: (props: NodeProps) => <GenericNode {...props} type="skill" />,
  human: (props: NodeProps) => <GenericNode {...props} type="human" />,
  io: InputNode,
  condition: ConditionNode,
  initializer: (props: NodeProps) => <GenericNode {...props} type="system" />,
  output: OutputNode,
};
