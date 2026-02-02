import { Completion } from '../completion';
import type { Sprint, Task, TeamMember } from './Project.construct';

export interface SprintPlannerProps {
  projectId: string;
  sprintId: string;
  goal: string;
  team: TeamMember[];
  children: (sprint: Sprint) => any;
}

const SPRINT_PLANNER_PROMPT = `You are a sprint planner. Your task is to break down a sprint goal into actionable tasks and assign them to team members.

You will receive:
1. A sprint goal
2. A list of available team members with their roles and capabilities

Create a JSON object for the sprint with:
- id: The sprint ID (will be provided)
- goal: The sprint goal
- tasks: An array of tasks
- status: "planning"

Each task should have:
- id: A unique identifier (e.g., "task-1", "task-design-api")
- title: A short title
- description: A detailed description of what needs to be done
- assignedTo: The ID of the team member best suited for this task
- dependencies: An array of task IDs that must complete before this task can start (empty array if none)
- status: "pending"
- retries: 0

Consider task dependencies carefully - some tasks naturally depend on others (e.g., testing depends on implementation, implementation depends on design).

Respond ONLY with valid JSON, no additional text.`;

export function SprintPlanner({ projectId, sprintId, goal, team, children }: SprintPlannerProps) {
  const requestId = `sprint-plan-${projectId}-${sprintId}`;
  
  const teamDescription = team.map(m => 
    `- ${m.id}: ${m.role} (${m.name}) - Capabilities: ${m.capabilities.join(', ')}`
  ).join('\n');

  const messages = [
    { role: 'system', content: SPRINT_PLANNER_PROMPT },
    { 
      role: 'user', 
      content: `Sprint ID: ${sprintId}\n\nGoal: ${goal}\n\nAvailable Team Members:\n${teamDescription}` 
    }
  ];

  return (
    <Completion requestId={requestId} model="gpt-4o-mini" messages={messages}>
      {(response) => {
        try {
          // Try to parse the JSON response
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            console.error('[SprintPlanner] Could not find JSON object in response');
            return null;
          }
          
          const sprint: Sprint = JSON.parse(jsonMatch[0]);
          // Ensure all tasks have retries set
          sprint.tasks = sprint.tasks.map(t => ({ ...t, retries: t.retries ?? 0 }));
          return children(sprint);
        } catch (e) {
          console.error('[SprintPlanner] Failed to parse sprint:', e);
          console.error('[SprintPlanner] Response was:', response);
          return null;
        }
      }}
    </Completion>
  );
}
