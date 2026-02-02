export interface ChatModelProps {
  model: string;
}

export interface ChatModelOutputs {
  id: string;
  model: string;
}

export class ChatModel {
  constructor(public props: ChatModelProps) {}
}
