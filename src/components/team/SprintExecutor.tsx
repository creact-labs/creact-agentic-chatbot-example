import type { OutputAccessors } from '@creact-labs/creact';
import type { ProjectOutputs, Sprint, Task, TeamMember } from './Project.construct';
import { TaskRunner } from './TaskRunner';

export interface SprintExecutorProps {
  project: OutputAccessors<ProjectOutputs>;
  sprintId: string;
  children: (updates: { taskId: string; status: Task['status']; output?: string }[]) => any;
}

/**
 * SprintExecutor orchestrates parallel task execution within a sprint.
 * It finds tasks that are ready to run (dependencies met) and renders
 * TaskRunner components for each.
 */
export function SprintExecutor({ project, sprintId, children }: SprintExecutorProps) {
  const sprints = project.sprints();
  const team = project.team();
  const workspaceId = project.workspaceId();
  
  const sprint = sprints.find(s => s.id === sprintId);
  if (!sprint || sprint.status !== 'active') {
    return null;
  }

  // Find tasks that are ready to execute (all dependencies completed)
  const readyTasks = sprint.tasks.filter(task => {
    if (task.status !== 'pending') return false;
    
    // Check all dependencies are done
    return task.dependencies.every(depId => {
      const depTask = sprint.tasks.find(t => t.id === depId);
      return depTask?.status === 'done';
    });
  });

  // Find the team member for each task
  const taskRunners = readyTasks.map(task => {
    const member = team.find(m => m.id === task.assignedTo);
    if (!member) {
      console.warn(`[SprintExecutor] No member found for task ${task.id}, assigned to ${task.assignedTo}`);
      return null;
    }
    
    return (
      <TaskRunner
        key={task.id}
        task={task}
        member={member}
        workspaceId={workspaceId}
        projectId={project.id()}
        sprintId={sprintId}
      >
        {(result) => {
          // This will be handled by the TaskRunner internally
          return null;
        }}
      </TaskRunner>
    );
  }).filter(Boolean);

  // Check if sprint is complete (all tasks done or failed)
  const allTasksComplete = sprint.tasks.every(
    t => t.status === 'done' || t.status === 'failed'
  );

  // Collect updates for the children callback
  const updates = sprint.tasks
    .filter(t => t.status === 'done' || t.status === 'failed')
    .map(t => ({ taskId: t.id, status: t.status, output: t.output }));

  return (
    <>
      {taskRunners}
      {children(updates)}
    </>
  );
}
