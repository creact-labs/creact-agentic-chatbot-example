export interface ChatHandlerProps {
  serverId: string;
  path: string;
}

export interface PendingMessage {
  id: string;
  content: string;
}

export interface ChatHandlerOutputs {
  id: string;
  pending: PendingMessage | null;
}

export class ChatHandler {
  constructor(public props: ChatHandlerProps) {}
}
