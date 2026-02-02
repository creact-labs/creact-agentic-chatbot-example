import { useInstance, type OutputAccessors } from '@creact-labs/creact';
import { ChatHandler, type ChatHandlerOutputs } from './ChatHandler.construct';

export function Chat({ serverId, path, children }: {
  serverId: string | undefined;
  path: string;
  children: (outputs: OutputAccessors<ChatHandlerOutputs>) => any;
}) {
  const outputs = useInstance<ChatHandlerOutputs>(ChatHandler, { serverId, path });
  return children(outputs);
}
