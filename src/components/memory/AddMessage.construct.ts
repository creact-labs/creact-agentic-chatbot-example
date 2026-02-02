export interface AddMessageProps {
  memoryId: string;
  currentMessages: Array<{ role: string; content: string }>;
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

export interface AddMessageOutputs {
  added: boolean;
}

export class AddMessage {
  constructor(public props: AddMessageProps) {}
}

// Batch version - add multiple messages at once
export interface AddMessagesProps {
  memoryId: string;
  currentMessages: Array<{ role: string; content: string }>;
  newMessages: Array<{ role: string; content: string }>;
}

export interface AddMessagesOutputs {
  added: boolean;
}

export class AddMessages {
  constructor(public props: AddMessagesProps) {}
}
