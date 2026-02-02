export interface ProjectProps {
  name: string;
  description: string;
  workspaceId: string;
}

export interface TeamMember {
  id: string;
  role: string;
  name: string;
  systemPrompt: string;
  capabilities: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  output?: string;
  retries: number;
}

export interface Sprint {
  id: string;
  goal: string;
  tasks: Task[];
  status: 'planning' | 'active' | 'paused' | 'completed';
}

export interface ProjectOutputs {
  id: string;
  name: string;
  description: string;
  workspaceId: string;
  team: TeamMember[];
  sprints: Sprint[];
  status: 'idle' | 'analyzing' | 'planning' | 'running' | 'paused' | 'completed';
}

export class Project {
  constructor(public props: ProjectProps) {}
}
