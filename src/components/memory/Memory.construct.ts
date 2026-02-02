export interface MemoryProps {
  windowSize?: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

export interface MemoryOutputs {
  id: string;
  messages: Message[];
}

export class Memory {
  constructor(public props: MemoryProps) {}
}
