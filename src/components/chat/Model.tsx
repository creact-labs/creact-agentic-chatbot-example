import { useInstance, type OutputAccessors } from '@creact-labs/creact';
import { ChatModel, type ChatModelOutputs } from './ChatModel.construct';

export function Model({ model, children }: {
  model: string;
  children: (outputs: OutputAccessors<ChatModelOutputs>) => any;
}) {
  const outputs = useInstance<ChatModelOutputs>(ChatModel, { model });
  return children(outputs);
}
