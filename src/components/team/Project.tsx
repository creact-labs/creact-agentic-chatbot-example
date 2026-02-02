import { useInstance, type OutputAccessors } from '@creact-labs/creact';
import { Project as ProjectConstruct, type ProjectOutputs } from './Project.construct';

export interface ProjectComponentProps {
  name: string;
  description: string;
  workspaceId: string;
  children: (outputs: OutputAccessors<ProjectOutputs>) => any;
}

export function Project({ name, description, workspaceId, children }: ProjectComponentProps) {
  const outputs = useInstance<ProjectOutputs>(ProjectConstruct, {
    name,
    description,
    workspaceId
  });
  return children(outputs);
}
