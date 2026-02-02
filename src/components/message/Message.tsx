import { useInstance, type OutputAccessors } from '@creact-labs/creact';
import { Message as MessageConstruct, type MessageOutputs } from './Message.construct';

export function Message({ role, content, children }: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  children: (outputs: OutputAccessors<MessageOutputs>) => any;
}) {
  const outputs = useInstance<MessageOutputs>(MessageConstruct, { role, content });
  return children(outputs);
}
