import { createSignal, type JSXElement } from '@creact-labs/creact';
import { ToolContext, type ToolDefinition } from './ToolContext';

export function ToolProvider({ children }: { children: JSXElement | JSXElement[] }) {
  const [tools, setTools] = createSignal<ToolDefinition[]>([]);

  const registerTool = (tool: ToolDefinition) => {
    const prev = tools() || [];
    if (prev.some(t => t.name === tool.name)) return;
    setTools([...prev, tool]);
  };

  return (
    <ToolContext.Provider value={{ tools: () => tools() || [], registerTool }}>
      {children}
    </ToolContext.Provider>
  );
}
