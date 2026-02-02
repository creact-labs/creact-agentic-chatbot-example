import { useInstance } from '@creact-labs/creact';
import { ChatResponse } from './ChatResponse.construct';

export function SendResponse({ handlerId, messageId, content }: {
  handlerId: string | undefined;
  messageId: string | undefined;
  content: string | undefined;
}) {
  console.log('[SendResponse] rendering:', { handlerId, messageId, content: content?.slice(0, 30) });
  useInstance(ChatResponse, { handlerId, messageId, content });
  return null;
}
