import type { ProjectOutputs, TeamMember, Sprint } from './Project.construct';

export interface UpdateProjectProps {
  projectId: string;
  updates: Partial<ProjectOutputs>;
}

export interface UpdateProjectOutputs {
  updated: boolean;
  updateHash: string;
}

export class UpdateProject {
  constructor(public props: UpdateProjectProps) {}
}
