export interface ConversationProps {
  // Optional initial messages
}

export interface ConversationOutputs {
  id: string;
  messageIds: string[];
}

export class Conversation {
  constructor(public props: ConversationProps) {}
}
