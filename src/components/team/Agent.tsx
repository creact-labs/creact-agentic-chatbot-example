import { useInstance, type OutputAccessors } from '@creact-labs/creact';
import { Agent as AgentConstruct, type AgentOutputs } from './Agent.construct';

export interface AgentComponentProps {
  memberId: string;
  role: string;
  systemPrompt: string;
  children: (outputs: OutputAccessors<AgentOutputs>) => any;
}

export function Agent({ memberId, role, systemPrompt, children }: AgentComponentProps) {
  const outputs = useInstance<AgentOutputs>(AgentConstruct, {
    memberId,
    role,
    systemPrompt
  });
  return children(outputs);
}
