import { createStore } from '@creact-labs/creact';

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  script: string;
  language: 'python' | 'node' | 'shell';
  createdAt: number;
}

interface ToolStoreState {
  tools: Record<string, CustomTool>;
}

const [state, setState] = createStore<ToolStoreState>({ tools: {} });

export const toolStore = {
  create(
    name: string,
    description: string,
    script: string,
    language: 'python' | 'node' | 'shell'
  ): CustomTool {
    const id = `tool-${Date.now().toString(36)}`;
    const tool: CustomTool = {
      id,
      name,
      description,
      script,
      language,
      createdAt: Date.now()
    };

    setState('tools', id, tool);
    return tool;
  },

  get(id: string): CustomTool | null {
    return state.tools[id] || null;
  },

  list(): CustomTool[] {
    return Object.values(state.tools);
  },

  delete(id: string): void {
    const { [id]: _, ...rest } = state.tools;
    setState('tools', rest);
  }
};
