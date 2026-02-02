import { useInstance, ChatResponse } from '@creact-labs/creact';

export function SendResponse({ handlerId, content }: {
  handlerId: string | undefined;
  content: string | undefined;
}) {
  console.log('[SendResponse] rendering:', { handlerId, content: content?.slice(0, 30) });
  useInstance(ChatResponse, { handlerId, content });
  return null;
}
