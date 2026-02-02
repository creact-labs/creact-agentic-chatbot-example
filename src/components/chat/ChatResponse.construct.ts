export interface ChatResponseProps {
  handlerId: string;
  messageId: string;
  content: string;
}

export interface ChatResponseOutputs {
  sent: boolean;
}

export class ChatResponse {
  constructor(public props: ChatResponseProps) {}
}
