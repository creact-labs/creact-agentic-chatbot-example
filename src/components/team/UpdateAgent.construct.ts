import type { AgentOutputs } from './Agent.construct';

export interface UpdateAgentProps {
  agentId: string;
  updates: Partial<AgentOutputs>;
}

export interface UpdateAgentOutputs {
  updated: boolean;
  updateHash: string;
}

export class UpdateAgent {
  constructor(public props: UpdateAgentProps) {}
}
