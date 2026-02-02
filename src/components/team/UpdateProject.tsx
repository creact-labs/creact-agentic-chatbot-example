import { useInstance } from '@creact-labs/creact';
import { UpdateProject as UpdateProjectConstruct, type UpdateProjectOutputs, type UpdateProjectProps } from './UpdateProject.construct';
import type { ProjectOutputs } from './Project.construct';

export function UpdateProject({ projectId, updates }: { projectId: string; updates: Partial<ProjectOutputs> }) {
  useInstance<UpdateProjectOutputs>(UpdateProjectConstruct, { projectId, updates });
  return null;
}
