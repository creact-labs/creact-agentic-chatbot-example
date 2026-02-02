import { Completion } from '../completion';
import { UpdateProject } from './UpdateProject';
import type { Task, TeamMember } from './Project.construct';

export interface TaskRunnerProps {
  task: Task;
  member: TeamMember;
  workspaceId: string;
  projectId: string;
  sprintId: string;
  children: (result: { success: boolean; output: string }) => any;
}

/**
 * TaskRunner executes a single task using the assigned agent.
 * The agent has access to all tools (Docker, file operations, tool creation).
 */
export function TaskRunner({ task, member, workspaceId, projectId, sprintId, children }: TaskRunnerProps) {
  const requestId = `task-run-${projectId}-${sprintId}-${task.id}`;
  
  const taskPrompt = `You are working on a task in workspace ${workspaceId}.

Task: ${task.title}

Description:
${task.description}

You have access to tools for:
- Executing shell commands in the workspace (exec)
- Reading and writing files (file_read, file_write)
- Creating reusable tools (tool_create)
- Running saved tools (tool_run)

Complete the task by using the appropriate tools. When finished, provide a summary of what you accomplished.

IMPORTANT: 
- Use the workspaceId "${workspaceId}" when calling workspace tools
- Create any tools you think will be useful for this or future tasks
- If you encounter errors, try to fix them before giving up`;

  const messages = [
    { role: 'system', content: member.systemPrompt },
    { role: 'user', content: taskPrompt }
  ];

  return (
    <Completion requestId={requestId} model="gpt-4o-mini" messages={messages}>
      {(response, conversationHistory) => {
        // Determine success based on response content
        const success = !response.toLowerCase().includes('failed') && 
                       !response.toLowerCase().includes('error:') &&
                       !response.toLowerCase().includes('could not');
        
        const status = success ? 'done' : 'failed';
        
        // Update the task in the project
        return (
          <>
            <UpdateTaskStatus
              projectId={projectId}
              sprintId={sprintId}
              taskId={task.id}
              status={status}
              output={response}
            />
            {children({ success, output: response })}
          </>
        );
      }}
    </Completion>
  );
}

/**
 * Helper component to update task status in the project
 */
function UpdateTaskStatus({ 
  projectId, 
  sprintId, 
  taskId, 
  status, 
  output 
}: { 
  projectId: string; 
  sprintId: string; 
  taskId: string; 
  status: Task['status']; 
  output: string;
}) {
  // This will emit an update to the project
  // The actual update logic is handled in the tools/handlers
  return (
    <UpdateProject
      projectId={projectId}
      updates={{
        // This is a signal to update a specific task
        // The handler will need to handle this specially
        _taskUpdate: { sprintId, taskId, status, output }
      } as any}
    />
  );
}
