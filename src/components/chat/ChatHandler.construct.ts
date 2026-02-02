export interface ChatHandlerProps {
  serverId: string;
  path: string;
}

export interface ChatHandlerOutputs {
  id: string;
  pending: string | null;
}

export class ChatHandler {
  constructor(public props: ChatHandlerProps) {}
}
