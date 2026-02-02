import { useInstance, type OutputAccessors } from '@creact-labs/creact';
import { Conversation as ConversationConstruct, type ConversationOutputs } from './Conversation.construct';

export function Conversation({ children }: {
  children: (outputs: OutputAccessors<ConversationOutputs>) => any;
}) {
  const outputs = useInstance<ConversationOutputs>(ConversationConstruct, {});
  return children(outputs);
}
