export interface AddToConversationProps {
  conversationId: string;
  messageId: string;
  currentMessageIds: string[];
}

export interface AddToConversationOutputs {
  added: boolean;
}

export class AddToConversation {
  constructor(public props: AddToConversationProps) {}
}
