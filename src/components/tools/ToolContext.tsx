import { createContext, useContext } from '@creact-labs/creact';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;  // JSON Schema
  execute: (args: Record<string, any>) => Promise<string>;
}

interface ToolContextValue {
  tools: () => ToolDefinition[];  // Signal getter for reactivity
  registerTool: (tool: ToolDefinition) => void;
}

export const ToolContext = createContext<ToolContextValue>({
  tools: () => [],  // Default getter returns empty array
  registerTool: () => {},
});

export const useTools = () => useContext(ToolContext);
