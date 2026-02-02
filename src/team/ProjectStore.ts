import { createStore } from '@creact-labs/creact';
import type { ProjectOutputs, TeamMember, Sprint, Task } from '../components/team/Project.construct';

export interface StoredProject extends ProjectOutputs {
  createdAt: number;
  updatedAt: number;
}

interface ProjectStoreState {
  projects: Record<string, StoredProject>;
}

const [state, setState] = createStore<ProjectStoreState>({ projects: {} });

// Helper to update a project
function updateProject(id: string, updates: Partial<StoredProject>): StoredProject | null {
  const project = state.projects[id];
  if (!project) return null;
  const updated = { ...project, ...updates, updatedAt: Date.now() };
  setState('projects', id, updated);
  return updated;
}

export const projectStore = {
  create(name: string, description: string, workspaceId: string): StoredProject {
    const id = `proj-${Date.now().toString(36)}`;
    const project: StoredProject = {
      id,
      name,
      description,
      workspaceId,
      team: [],
      sprints: [],
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setState('projects', id, project);
    return project;
  },

  get(id: string): StoredProject | null {
    return state.projects[id] || null;
  },

  list(): StoredProject[] {
    return Object.values(state.projects);
  },

  delete(id: string): void {
    const { [id]: _, ...rest } = state.projects;
    setState('projects', rest);
  },

  update(id: string, updates: Partial<StoredProject>): StoredProject | null {
    return updateProject(id, updates);
  },

  // Team management
  setTeam(projectId: string, team: TeamMember[]): StoredProject | null {
    return updateProject(projectId, { team, status: 'idle' });
  },

  addTeamMember(projectId: string, member: TeamMember): StoredProject | null {
    const project = state.projects[projectId];
    if (!project) return null;
    
    const team = [...project.team, member];
    return updateProject(projectId, { team });
  },

  removeTeamMember(projectId: string, memberId: string): StoredProject | null {
    const project = state.projects[projectId];
    if (!project) return null;
    
    const team = project.team.filter(m => m.id !== memberId);
    return updateProject(projectId, { team });
  },

  // Sprint management
  addSprint(projectId: string, sprint: Sprint): StoredProject | null {
    const project = state.projects[projectId];
    if (!project) return null;
    
    const sprints = [...project.sprints, sprint];
    return updateProject(projectId, { sprints });
  },

  updateSprint(projectId: string, sprintId: string, updates: Partial<Sprint>): StoredProject | null {
    const project = state.projects[projectId];
    if (!project) return null;
    
    const sprints = project.sprints.map(s => 
      s.id === sprintId ? { ...s, ...updates } : s
    );
    return updateProject(projectId, { sprints });
  },

  getSprint(projectId: string, sprintId: string): Sprint | null {
    const project = state.projects[projectId];
    if (!project) return null;
    return project.sprints.find(s => s.id === sprintId) || null;
  },

  // Task management
  updateTask(
    projectId: string, 
    sprintId: string, 
    taskId: string, 
    updates: Partial<Task>
  ): StoredProject | null {
    const project = state.projects[projectId];
    if (!project) return null;
    
    const sprints = project.sprints.map(s => {
      if (s.id !== sprintId) return s;
      return {
        ...s,
        tasks: s.tasks.map(t => 
          t.id === taskId ? { ...t, ...updates } : t
        )
      };
    });
    return updateProject(projectId, { sprints });
  },

  getTask(projectId: string, sprintId: string, taskId: string): Task | null {
    const sprint = this.getSprint(projectId, sprintId);
    if (!sprint) return null;
    return sprint.tasks.find(t => t.id === taskId) || null;
  }
};
