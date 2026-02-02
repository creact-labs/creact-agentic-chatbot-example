export interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface AgentProps {
  memberId: string;
  role: string;
  systemPrompt: string;
}

export interface AgentOutputs {
  id: string;
  memberId: string;
  messages: Message[];
  toolsCreated: string[];
  currentTask?: string;
  status: 'idle' | 'working' | 'blocked';
}

export class Agent {
  constructor(public props: AgentProps) {}
}
