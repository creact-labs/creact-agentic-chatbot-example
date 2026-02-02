import { useInstance } from '@creact-labs/creact';
import { AddMessages } from './AddMessage.construct';

export function SaveMessages({ memoryId, currentMessages, newMessages }: {
  memoryId: string | undefined;
  currentMessages: any[];
  newMessages: Array<{ role: string; content: string }>;
}) {
  useInstance(AddMessages, { memoryId, currentMessages, newMessages });
  return null;
}
