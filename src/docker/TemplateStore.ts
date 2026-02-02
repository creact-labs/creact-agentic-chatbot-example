import { createStore } from '@creact-labs/creact';

export interface DockerTemplate {
  id: string;
  name: string;
  description: string;
  dockerfile: string;
  testCommand?: string;
  createdAt: number;
  lastUsed: number;
}

interface TemplateStoreState {
  templates: Record<string, DockerTemplate>;
}

const [state, setState] = createStore<TemplateStoreState>({ templates: {} });

export const templateStore = {
  create(
    name: string,
    description: string,
    dockerfile: string,
    testCommand?: string
  ): DockerTemplate {
    const id = `tpl-${Date.now().toString(36)}`;
    const template: DockerTemplate = {
      id,
      name,
      description,
      dockerfile,
      testCommand,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };

    setState('templates', id, template);
    return template;
  },

  get(id: string): DockerTemplate | null {
    const template = state.templates[id];
    if (template) {
      setState('templates', id, 'lastUsed', Date.now());
    }
    return template || null;
  },

  getByName(name: string): DockerTemplate | null {
    for (const template of Object.values(state.templates)) {
      if (template.name === name) {
        setState('templates', template.id, 'lastUsed', Date.now());
        return template;
      }
    }
    return null;
  },

  list(): DockerTemplate[] {
    return Object.values(state.templates);
  },

  delete(id: string): void {
    const { [id]: _, ...rest } = state.templates;
    setState('templates', rest);
  },

  update(
    id: string,
    updates: Partial<Pick<DockerTemplate, 'name' | 'description' | 'dockerfile' | 'testCommand'>>
  ): DockerTemplate | null {
    const template = state.templates[id];
    if (!template) return null;

    const updated = { ...template, ...updates, lastUsed: Date.now() };
    setState('templates', id, updated);
    return updated;
  }
};
