import { createEffect } from '@creact-labs/creact';
import { useTools } from './ToolContext';

export interface ToolProps {
  name: string;
  description: string;
  parameters: Record<string, any>;  // JSON Schema
  execute: (args: Record<string, any>) => Promise<string>;
}

export function Tool({ name, description, parameters, execute }: ToolProps) {
  const { registerTool } = useTools();

  createEffect(() => {
    registerTool({ name, description, parameters, execute });
    return undefined;
  });

  return null;
}
