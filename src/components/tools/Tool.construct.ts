export interface ToolProps {
  name: string;
  description: string;
}

export interface ToolOutputs {
  id: string;
  name: string;
  description: string;
}

export class Tool {
  constructor(public props: ToolProps) {}
}
