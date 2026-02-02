import { useInstance } from '@creact-labs/creact';
import { AddToConversation as AddToConversationConstruct } from './AddToConversation.construct';

export function AddToConversation({ conversationId, messageId, currentMessageIds }: {
  conversationId: string | undefined;
  messageId: string | undefined;
  currentMessageIds: string[];
}) {
  useInstance(AddToConversationConstruct, { conversationId, messageId, currentMessageIds });
  return null;
}
