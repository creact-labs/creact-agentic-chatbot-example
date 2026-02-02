export interface ChatResponseProps {
  handlerId: string;
  content: string;
}

export interface ChatResponseOutputs {
  sent: boolean;
}

export class ChatResponse {
  readonly props: ChatResponseProps;
  outputs: ChatResponseOutputs = { sent: false };

  constructor(props: ChatResponseProps) {
    this.props = props;
  }

  setOutputs(outputs: Partial<ChatResponseOutputs>) {
    this.outputs = { ...this.outputs, ...outputs };
  }
}
