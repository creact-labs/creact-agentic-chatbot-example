export interface CompletionProps {
  requestId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
    execute: (args: Record<string, any>) => Promise<string>;
  }>;
}

export interface CompletionOutputs {
  id: string;
  status: 'pending' | 'complete';
  response: string | null;
  requestId: string;
}

export class Completion {
  constructor(public props: CompletionProps) {}
}
