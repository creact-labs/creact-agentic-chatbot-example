export interface MessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MessageOutputs {
  id: string;  // node.id from CReact (includes key)
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class Message {
  constructor(public props: MessageProps) {}
}
