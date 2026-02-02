import { useInstance } from '@creact-labs/creact';
import { UpdateAgent as UpdateAgentConstruct, type UpdateAgentOutputs } from './UpdateAgent.construct';
import type { AgentOutputs } from './Agent.construct';

export function UpdateAgent({ agentId, updates }: { agentId: string; updates: Partial<AgentOutputs> }) {
  useInstance<UpdateAgentOutputs>(UpdateAgentConstruct, { agentId, updates });
  return null;
}
