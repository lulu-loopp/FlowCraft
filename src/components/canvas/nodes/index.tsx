import { AgentNode } from './agent-node';
import { GenericNode } from './generic-node';

export const nodeTypes = {
  agent: AgentNode,
  tool: (props: any) => <GenericNode {...props} type="tool" />,
  skill: (props: any) => <GenericNode {...props} type="skill" />,
  human: (props: any) => <GenericNode {...props} type="human" />,
  io: (props: any) => <GenericNode {...props} type="io" />,
  condition: (props: any) => <GenericNode {...props} type="control" />,
  initializer: (props: any) => <GenericNode {...props} type="system" />,
};
