import { Tool } from './Tool';
import { projectStore } from '../../team';
import { workspaceRegistry, execInContainer } from '../../docker';
import type { TeamMember, Sprint, Task } from '../team/Project.construct';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper to run AI completion for team analysis and sprint planning
async function runCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });
  return completion.choices[0].message.content || '';
}

export function TeamTools() {
  return (
    <>
      {/* ═══════════════════ PROJECT MANAGEMENT ═══════════════════ */}

      <Tool
        name="project_create"
        description="Create a new development project with a Docker workspace"
        parameters={{
          type: "object",
          properties: {
            name: { type: "string", description: "Project name" },
            description: { type: "string", description: "Project description - what needs to be built" },
            dockerfile: { type: "string", description: "Optional Dockerfile for the workspace" },
            networkEnabled: { type: "boolean", description: "Enable internet access (default: true)" }
          },
          required: ["name", "description"]
        }}
        execute={async ({ name, description, dockerfile, networkEnabled = true }) => {
          try {
            // Create a workspace for the project
            const defaultDockerfile = dockerfile || `FROM python:3.11-slim
RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir requests pytest
WORKDIR /workspace`;
            
            const ws = await workspaceRegistry.createFromDockerfile(
              `${name}-workspace`,
              defaultDockerfile,
              networkEnabled
            );

            if (ws.status === 'failed') {
              return `✗ Failed to create workspace\n\nBuild log:\n${ws.buildLog?.slice(-1000)}`;
            }

            // Create the project
            const project = await projectStore.create(name, description, ws.id);

            return `✓ Project created\n` +
              `  ID: ${project.id}\n` +
              `  Name: ${project.name}\n` +
              `  Workspace: ${ws.id}\n` +
              `  Status: ${project.status}\n\n` +
              `Next steps:\n` +
              `  1. Run team_analyze to create a team\n` +
              `  2. Run sprint_create to plan work`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="project_list"
        description="List all development projects"
        parameters={{ type: "object", properties: {}, required: [] }}
        execute={async () => {
          try {
            const projects = await projectStore.list();
            if (projects.length === 0) {
              return 'No projects. Create one with project_create.';
            }

            return projects.map(p => {
              const statusIcon = {
                idle: '○',
                analyzing: '◐',
                planning: '◐',
                running: '●',
                paused: '◑',
                completed: '✓'
              }[p.status] || '?';

              return `[${statusIcon}] ${p.id}\n` +
                `    Name: ${p.name}\n` +
                `    Status: ${p.status}\n` +
                `    Team: ${p.team.length} members\n` +
                `    Sprints: ${p.sprints.length}`;
            }).join('\n\n');
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="project_status"
        description="Get detailed status of a project including team, sprints, and tasks"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" }
          },
          required: ["projectId"]
        }}
        execute={async ({ projectId }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;

            let output = `Project: ${project.name}\n`;
            output += `ID: ${project.id}\n`;
            output += `Status: ${project.status}\n`;
            output += `Workspace: ${project.workspaceId}\n`;
            output += `\n${'═'.repeat(40)}\n`;

            // Team
            output += `\nTeam (${project.team.length} members):\n`;
            if (project.team.length === 0) {
              output += '  (no team - run team_analyze)\n';
            } else {
              project.team.forEach(m => {
                output += `  • ${m.name} [${m.role}]\n`;
                output += `    Capabilities: ${m.capabilities.join(', ')}\n`;
              });
            }

            // Sprints
            output += `\nSprints (${project.sprints.length}):\n`;
            if (project.sprints.length === 0) {
              output += '  (no sprints - run sprint_create)\n';
            } else {
              project.sprints.forEach(s => {
                const done = s.tasks.filter(t => t.status === 'done').length;
                const total = s.tasks.length;
                const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                
                output += `  [${s.status}] ${s.id}: ${s.goal}\n`;
                output += `    Progress: ${done}/${total} tasks (${progress}%)\n`;
              });
            }

            return output;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="project_delete"
        description="Delete a project and optionally its workspace"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            keepWorkspace: { type: "boolean", description: "Keep the Docker workspace (default: false)" }
          },
          required: ["projectId"]
        }}
        execute={async ({ projectId, keepWorkspace = false }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;

            // Delete workspace unless requested to keep
            if (!keepWorkspace && project.workspaceId) {
              await workspaceRegistry.destroy(project.workspaceId);
            }

            await projectStore.delete(projectId);
            return `✓ Project ${projectId} deleted${keepWorkspace ? ' (workspace kept)' : ''}`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      {/* ═══════════════════ TEAM MANAGEMENT ═══════════════════ */}

      <Tool
        name="team_analyze"
        description="AI analyzes the project and dynamically creates an appropriate team"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" }
          },
          required: ["projectId"]
        }}
        execute={async ({ projectId }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;

            await projectStore.update(projectId, { status: 'analyzing' });

            const systemPrompt = `You are a project analyzer. Analyze the project description and create an appropriate team.
Output a JSON array of team members. Each member needs:
- id: unique identifier (e.g., "member-architect")
- role: the role (e.g., "architect", "backend-developer", "qa-engineer")
- name: friendly name (e.g., "Alex the Architect")
- systemPrompt: detailed prompt defining this agent's expertise and responsibilities
- capabilities: array of capabilities

Choose 2-5 team members based on project complexity.
Respond ONLY with valid JSON array.`;

            const response = await runCompletion(
              systemPrompt,
              `Project: ${project.name}\n\nDescription: ${project.description}`
            );

            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
              await projectStore.update(projectId, { status: 'idle' });
              return `✗ Failed to parse team from AI response`;
            }

            const team: TeamMember[] = JSON.parse(jsonMatch[0]);
            await projectStore.setTeam(projectId, team);

            let output = `✓ Team created for ${project.name}\n\n`;
            team.forEach(m => {
              output += `• ${m.name} [${m.role}]\n`;
              output += `  ID: ${m.id}\n`;
              output += `  Capabilities: ${m.capabilities.join(', ')}\n\n`;
            });

            return output;
          } catch (e: any) {
            try { projectStore.update(projectId, { status: 'idle' }); } catch {}
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="team_add_member"
        description="Manually add a team member to a project"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            role: { type: "string", description: "Role (e.g., 'devops', 'designer')" },
            name: { type: "string", description: "Friendly name" },
            capabilities: { type: "string", description: "Comma-separated capabilities" },
            systemPrompt: { type: "string", description: "Optional custom system prompt" }
          },
          required: ["projectId", "role", "name", "capabilities"]
        }}
        execute={async ({ projectId, role, name, capabilities, systemPrompt }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;

            const member: TeamMember = {
              id: `member-${role}-${Date.now().toString(36)}`,
              role,
              name,
              capabilities: capabilities.split(',').map((c: string) => c.trim()),
              systemPrompt: systemPrompt || `You are ${name}, a ${role}. Your capabilities include: ${capabilities}. Complete tasks thoroughly and create tools when useful.`
            };

            await projectStore.addTeamMember(projectId, member);
            return `✓ Added ${name} to team\n  ID: ${member.id}\n  Role: ${role}`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="team_list"
        description="List team members of a project"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" }
          },
          required: ["projectId"]
        }}
        execute={async ({ projectId }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;

            if (project.team.length === 0) {
              return 'No team members. Run team_analyze or team_add_member.';
            }

            return project.team.map(m =>
              `[${m.id}]\n` +
              `  Name: ${m.name}\n` +
              `  Role: ${m.role}\n` +
              `  Capabilities: ${m.capabilities.join(', ')}`
            ).join('\n\n');
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="team_remove_member"
        description="Remove a team member from a project"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            memberId: { type: "string", description: "Team member ID" }
          },
          required: ["projectId", "memberId"]
        }}
        execute={async ({ projectId, memberId }) => {
          try {
            await projectStore.removeTeamMember(projectId, memberId);
            return `✓ Removed team member ${memberId}`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      {/* ═══════════════════ SPRINT MANAGEMENT ═══════════════════ */}

      <Tool
        name="sprint_create"
        description="Create a sprint with a goal - AI will generate tasks and assign to team"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            goal: { type: "string", description: "Sprint goal - what should be accomplished" }
          },
          required: ["projectId", "goal"]
        }}
        execute={async ({ projectId, goal }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;
            if (project.team.length === 0) return `✗ No team. Run team_analyze first.`;

            await projectStore.update(projectId, { status: 'planning' });

            const teamDesc = project.team.map(m =>
              `- ${m.id}: ${m.role} (${m.name}) - ${m.capabilities.join(', ')}`
            ).join('\n');

            const systemPrompt = `You are a sprint planner. Create tasks for the sprint goal and assign them to team members.
Output a JSON object with:
- id: sprint ID (use "sprint-" + timestamp)
- goal: the sprint goal
- tasks: array of tasks
- status: "planning"

Each task needs:
- id: unique ID (e.g., "task-design", "task-implement")
- title: short title
- description: detailed description
- assignedTo: team member ID
- dependencies: array of task IDs that must complete first (empty if none)
- status: "pending"
- retries: 0

Consider task dependencies (e.g., testing depends on implementation).
Respond ONLY with valid JSON object.`;

            const response = await runCompletion(
              systemPrompt,
              `Goal: ${goal}\n\nTeam:\n${teamDesc}`
            );

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              await projectStore.update(projectId, { status: 'idle' });
              return `✗ Failed to parse sprint from AI response`;
            }

            const sprint: Sprint = JSON.parse(jsonMatch[0]);
            sprint.id = `sprint-${Date.now().toString(36)}`;
            sprint.tasks = sprint.tasks.map(t => ({ ...t, retries: t.retries ?? 0 }));

            await projectStore.addSprint(projectId, sprint);
            await projectStore.update(projectId, { status: 'idle' });

            let output = `✓ Sprint created: ${sprint.id}\n`;
            output += `Goal: ${sprint.goal}\n\n`;
            output += `Tasks (${sprint.tasks.length}):\n`;
            sprint.tasks.forEach(t => {
              const assignee = project.team.find(m => m.id === t.assignedTo);
              output += `  • ${t.title}\n`;
              output += `    ID: ${t.id}\n`;
              output += `    Assigned: ${assignee?.name || t.assignedTo}\n`;
              if (t.dependencies.length > 0) {
                output += `    Depends on: ${t.dependencies.join(', ')}\n`;
              }
            });

            return output;
          } catch (e: any) {
            try { projectStore.update(projectId, { status: 'idle' }); } catch {}
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="sprint_start"
        description="Begin executing a sprint - runs ready tasks in parallel"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" }
          },
          required: ["projectId", "sprintId"]
        }}
        execute={async ({ projectId, sprintId }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;

            const sprint = project.sprints.find(s => s.id === sprintId);
            if (!sprint) return `✗ Sprint ${sprintId} not found`;

            await projectStore.updateSprint(projectId, sprintId, { status: 'active' });
            await projectStore.update(projectId, { status: 'running' });

            // Find tasks ready to run (no dependencies or all deps done)
            const readyTasks = sprint.tasks.filter(t => {
              if (t.status !== 'pending') return false;
              return t.dependencies.every(depId => {
                const dep = sprint.tasks.find(d => d.id === depId);
                return dep?.status === 'done';
              });
            });

            if (readyTasks.length === 0) {
              const pending = sprint.tasks.filter(t => t.status === 'pending').length;
              const done = sprint.tasks.filter(t => t.status === 'done').length;
              
              if (pending === 0 && done === sprint.tasks.length) {
                await projectStore.updateSprint(projectId, sprintId, { status: 'completed' });
                await projectStore.update(projectId, { status: 'completed' });
                return `✓ Sprint ${sprintId} already complete! All ${done} tasks done.`;
              }
              
              return `No tasks ready to run.\n` +
                `  Pending: ${pending}\n` +
                `  Done: ${done}\n` +
                `  Check task dependencies.`;
            }

            // Execute ready tasks
            let output = `✓ Sprint ${sprintId} started\n\n`;
            output += `Executing ${readyTasks.length} task(s):\n\n`;

            for (const task of readyTasks) {
              const member = project.team.find(m => m.id === task.assignedTo);
              if (!member) {
                output += `---\n## ❌ ${task.title}\nNo assignee found\n\n`;
                continue;
              }

              output += `---\n## 🔨 ${task.title}\n`;
              output += `**Assigned to:** ${member.name} (${member.role})\n\n`;

              // Mark task as in progress
              await projectStore.updateTask(projectId, sprintId, task.id, { status: 'in_progress' });

              try {
                // Execute the task
                const taskResult = await executeTask(project, member, task);
                
                await projectStore.updateTask(projectId, sprintId, task.id, {
                  status: taskResult.success ? 'done' : 'failed',
                  output: taskResult.output
                });

                output += taskResult.output + '\n\n';
              } catch (err: any) {
                await projectStore.updateTask(projectId, sprintId, task.id, {
                  status: 'failed',
                  output: err.message
                });
                output += `❌ **Error:** ${err.message}\n\n`;
              }
            }

            // Check if more tasks became ready
            const updatedProject = await projectStore.get(projectId);
            const updatedSprint = updatedProject?.sprints.find(s => s.id === sprintId);
            const newReady = updatedSprint?.tasks.filter(t => {
              if (t.status !== 'pending') return false;
              return t.dependencies.every(depId => {
                const dep = updatedSprint.tasks.find(d => d.id === depId);
                return dep?.status === 'done';
              });
            }) || [];

            if (newReady.length > 0) {
              output += `\n${newReady.length} more tasks now ready. Run sprint_start again to continue.`;
            }

            // Check if sprint is complete
            const allDone = updatedSprint?.tasks.every(t => t.status === 'done' || t.status === 'failed');
            if (allDone) {
              await projectStore.updateSprint(projectId, sprintId, { status: 'completed' });
              await projectStore.update(projectId, { status: 'idle' });
              output += `\n\n✓ Sprint complete!`;
            }

            return output;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="sprint_pause"
        description="Pause a running sprint"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" }
          },
          required: ["projectId", "sprintId"]
        }}
        execute={async ({ projectId, sprintId }) => {
          try {
            await projectStore.updateSprint(projectId, sprintId, { status: 'paused' });
            await projectStore.update(projectId, { status: 'paused' });
            return `✓ Sprint ${sprintId} paused`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="sprint_resume"
        description="Resume a paused sprint"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" }
          },
          required: ["projectId", "sprintId"]
        }}
        execute={async ({ projectId, sprintId }) => {
          try {
            await projectStore.updateSprint(projectId, sprintId, { status: 'active' });
            await projectStore.update(projectId, { status: 'running' });
            return `✓ Sprint ${sprintId} resumed. Run sprint_start to execute tasks.`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="sprint_status"
        description="Get detailed status of a sprint"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" }
          },
          required: ["projectId", "sprintId"]
        }}
        execute={async ({ projectId, sprintId }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;

            const sprint = project.sprints.find(s => s.id === sprintId);
            if (!sprint) return `✗ Sprint ${sprintId} not found`;

            const statusIcon = (s: string) => ({
              pending: '○',
              in_progress: '◐',
              done: '✓',
              failed: '✗'
            }[s] || '?');

            let output = `Sprint: ${sprint.id}\n`;
            output += `Goal: ${sprint.goal}\n`;
            output += `Status: ${sprint.status}\n\n`;
            
            const done = sprint.tasks.filter(t => t.status === 'done').length;
            const failed = sprint.tasks.filter(t => t.status === 'failed').length;
            const progress = sprint.tasks.length > 0 
              ? Math.round((done / sprint.tasks.length) * 100) 
              : 0;
            
            output += `Progress: ${done}/${sprint.tasks.length} (${progress}%)\n`;
            if (failed > 0) output += `Failed: ${failed}\n`;
            output += `\nTasks:\n`;

            sprint.tasks.forEach(t => {
              const assignee = project.team.find(m => m.id === t.assignedTo);
              output += `  [${statusIcon(t.status)}] ${t.title}\n`;
              output += `      ID: ${t.id}\n`;
              output += `      Assigned: ${assignee?.name || t.assignedTo}\n`;
              if (t.dependencies.length > 0) {
                output += `      Deps: ${t.dependencies.join(', ')}\n`;
              }
              if (t.output) {
                output += `      Output: ${t.output.slice(0, 100)}${t.output.length > 100 ? '...' : ''}\n`;
              }
            });

            return output;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="sprint_complete"
        description="Mark a sprint as complete"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" }
          },
          required: ["projectId", "sprintId"]
        }}
        execute={async ({ projectId, sprintId }) => {
          try {
            await projectStore.updateSprint(projectId, sprintId, { status: 'completed' });
            await projectStore.update(projectId, { status: 'idle' });
            return `✓ Sprint ${sprintId} marked complete`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      {/* ═══════════════════ TASK MANAGEMENT ═══════════════════ */}

      <Tool
        name="task_list"
        description="List tasks in a sprint"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" }
          },
          required: ["projectId", "sprintId"]
        }}
        execute={async ({ projectId, sprintId }) => {
          try {
            const sprint = await projectStore.getSprint(projectId, sprintId);
            if (!sprint) return `✗ Sprint ${sprintId} not found`;

            const project = await projectStore.get(projectId);
            
            const statusIcon = (s: string) => ({
              pending: '○',
              in_progress: '◐',
              done: '✓',
              failed: '✗'
            }[s] || '?');

            return sprint.tasks.map(t => {
              const assignee = project?.team.find(m => m.id === t.assignedTo);
              return `[${statusIcon(t.status)}] ${t.id}\n` +
                `    Title: ${t.title}\n` +
                `    Assigned: ${assignee?.name || t.assignedTo}\n` +
                `    Status: ${t.status}`;
            }).join('\n\n');
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="task_run"
        description="Execute a single specific task"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" },
            taskId: { type: "string", description: "Task ID" }
          },
          required: ["projectId", "sprintId", "taskId"]
        }}
        execute={async ({ projectId, sprintId, taskId }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;

            const sprint = project.sprints.find(s => s.id === sprintId);
            if (!sprint) return `✗ Sprint ${sprintId} not found`;

            const task = sprint.tasks.find(t => t.id === taskId);
            if (!task) return `✗ Task ${taskId} not found`;

            const member = project.team.find(m => m.id === task.assignedTo);
            if (!member) return `✗ Assignee ${task.assignedTo} not found`;

            // Check dependencies
            const unmetDeps = task.dependencies.filter(depId => {
              const dep = sprint.tasks.find(t => t.id === depId);
              return dep?.status !== 'done';
            });

            if (unmetDeps.length > 0) {
              return `✗ Cannot run task - unmet dependencies: ${unmetDeps.join(', ')}`;
            }

            await projectStore.updateTask(projectId, sprintId, taskId, { status: 'in_progress' });

            const result = await executeTask(project, member, task);

            await projectStore.updateTask(projectId, sprintId, taskId, {
              status: result.success ? 'done' : 'failed',
              output: result.output
            });

            return `Task: ${task.title}\n` +
              `Status: ${result.success ? '✓ Completed' : '✗ Failed'}\n\n` +
              `Output:\n${result.output}`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="task_retry"
        description="Retry a failed task"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" },
            taskId: { type: "string", description: "Task ID" }
          },
          required: ["projectId", "sprintId", "taskId"]
        }}
        execute={async ({ projectId, sprintId, taskId }) => {
          try {
            const task = await projectStore.getTask(projectId, sprintId, taskId);
            if (!task) return `✗ Task ${taskId} not found`;

            if (task.status !== 'failed') {
              return `✗ Task is not failed (status: ${task.status})`;
            }

            await projectStore.updateTask(projectId, sprintId, taskId, {
              status: 'pending',
              output: undefined,
              retries: task.retries + 1
            });

            return `✓ Task ${taskId} reset to pending (retry #${task.retries + 1}). Run task_run to execute.`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="task_skip"
        description="Skip a task (mark as done without running)"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" },
            taskId: { type: "string", description: "Task ID" },
            reason: { type: "string", description: "Reason for skipping" }
          },
          required: ["projectId", "sprintId", "taskId"]
        }}
        execute={async ({ projectId, sprintId, taskId, reason = 'Manually skipped' }) => {
          try {
            await projectStore.updateTask(projectId, sprintId, taskId, {
              status: 'done',
              output: `[SKIPPED] ${reason}`
            });
            return `✓ Task ${taskId} skipped`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="task_status"
        description="Get detailed status and output of a task"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" },
            taskId: { type: "string", description: "Task ID" }
          },
          required: ["projectId", "sprintId", "taskId"]
        }}
        execute={async ({ projectId, sprintId, taskId }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;

            const task = await projectStore.getTask(projectId, sprintId, taskId);
            if (!task) return `✗ Task ${taskId} not found`;

            const member = project.team.find(m => m.id === task.assignedTo);

            let output = `Task: ${task.title}\n`;
            output += `ID: ${task.id}\n`;
            output += `Status: ${task.status}\n`;
            output += `Assigned: ${member?.name || task.assignedTo}\n`;
            output += `Retries: ${task.retries}\n`;
            
            if (task.dependencies.length > 0) {
              output += `Dependencies: ${task.dependencies.join(', ')}\n`;
            }
            
            output += `\nDescription:\n${task.description}\n`;
            
            if (task.output) {
              output += `\nOutput:\n${'─'.repeat(40)}\n${task.output}`;
            }

            return output;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="task_assign"
        description="Reassign a task to a different team member"
        parameters={{
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            sprintId: { type: "string", description: "Sprint ID" },
            taskId: { type: "string", description: "Task ID" },
            memberId: { type: "string", description: "New team member ID" }
          },
          required: ["projectId", "sprintId", "taskId", "memberId"]
        }}
        execute={async ({ projectId, sprintId, taskId, memberId }) => {
          try {
            const project = await projectStore.get(projectId);
            if (!project) return `✗ Project ${projectId} not found`;

            const member = project.team.find(m => m.id === memberId);
            if (!member) return `✗ Team member ${memberId} not found`;

            await projectStore.updateTask(projectId, sprintId, taskId, {
              assignedTo: memberId
            });

            return `✓ Task ${taskId} reassigned to ${member.name}`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />
    </>
  );
}

// Helper function to execute a task using the agent
async function executeTask(
  project: any,
  member: TeamMember,
  task: Task
): Promise<{ success: boolean; output: string }> {
  const taskPrompt = `You are working on a development task in workspace ${project.workspaceId}.

Task: ${task.title}

Description:
${task.description}

You MUST use these tools to complete the task - do NOT just describe what you would do:
- file_write: Write code files to the workspace (REQUIRED for any coding task)
- exec: Run shell commands (for testing, installing deps, etc.)
- file_read: Read existing files

CRITICAL RULES:
1. You MUST call file_write to create actual code files - do not just describe code
2. Start by writing the main file for this task
3. Use workspaceId "${project.workspaceId}" for ALL tool calls
4. After writing files, verify with exec("ls -la")

Example for a "Create API endpoint" task:
1. Call file_write with path="src/api.py" and actual Python code
2. Call exec with command="python -c 'import api'" to verify

NOW: Execute this task by calling the tools. Do NOT describe - ACT.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: member.systemPrompt },
      { role: 'user', content: taskPrompt }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'exec',
          description: 'Execute a shell command in the workspace',
          parameters: {
            type: 'object',
            properties: {
              workspaceId: { type: 'string' },
              command: { type: 'string' }
            },
            required: ['workspaceId', 'command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_write',
          description: 'Write content to a file',
          parameters: {
            type: 'object',
            properties: {
              workspaceId: { type: 'string' },
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['workspaceId', 'path', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_read',
          description: 'Read content from a file',
          parameters: {
            type: 'object',
            properties: {
              workspaceId: { type: 'string' },
              path: { type: 'string' }
            },
            required: ['workspaceId', 'path']
          }
        }
      }
    ]
  });

  let messages: any[] = [
    { role: 'system', content: member.systemPrompt },
    { role: 'user', content: taskPrompt }
  ];

  let response = completion.choices[0].message;
  let iterations = 0;
  const maxIterations = 10;
  
  // Track execution log for visibility
  const executionLog: string[] = [];

  // Handle tool calls
  while (response.tool_calls && response.tool_calls.length > 0 && iterations < maxIterations) {
    iterations++;
    messages.push(response);

    for (const toolCall of response.tool_calls) {
      // Type assertion for function tool calls
      const funcCall = toolCall as { id: string; type: string; function: { name: string; arguments: string } };
      const args = JSON.parse(funcCall.function.arguments);
      let result = '';

      // Log tool call input
      const toolName = funcCall.function.name;
      if (toolName === 'file_write') {
        const preview = args.content?.length > 200 
          ? args.content.substring(0, 200) + `... (${args.content.length} chars total)`
          : args.content;
        executionLog.push(`\n📝 **file_write** → \`${args.path}\`\n\`\`\`\n${preview}\n\`\`\``);
      } else if (toolName === 'exec') {
        executionLog.push(`\n⚡ **exec** → \`${args.command}\``);
      } else if (toolName === 'file_read') {
        executionLog.push(`\n📖 **file_read** → \`${args.path}\``);
      }

      try {
        const ws = await workspaceRegistry.get(args.workspaceId);
        if (!ws) {
          result = `Error: Workspace ${args.workspaceId} not found`;
        } else {
          switch (funcCall.function.name) {
            case 'exec':
              const execResult = await execInContainer(ws.containerName, args.command);
              result = execResult.stdout || '';
              if (execResult.stderr) result += `\n[stderr]: ${execResult.stderr}`;
              if (execResult.code !== 0) result += `\n[exit code: ${execResult.code}]`;
              break;
            case 'file_write':
              // Write file via exec
              const content = args.content.replace(/'/g, "'\\''");
              await execInContainer(ws.containerName, `mkdir -p $(dirname "${args.path}") && cat > "${args.path}" << 'CREACT_EOF'\n${args.content}\nCREACT_EOF`);
              result = `Written ${args.content.length} bytes to ${args.path}`;
              break;
            case 'file_read':
              const readResult = await execInContainer(ws.containerName, `cat "${args.path}"`);
              result = readResult.stdout || `Error: ${readResult.stderr}`;
              break;
            default:
              result = `Unknown tool: ${funcCall.function.name}`;
          }
        }
      } catch (err: any) {
        result = `Error: ${err.message}`;
      }

      // Log tool result
      const resultPreview = result.length > 300 
        ? result.substring(0, 300) + `... (${result.length} chars)`
        : result;
      executionLog.push(`   ↳ ${resultPreview.replace(/\n/g, '\n   ')}`);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result
      });
    }

    // Continue the conversation
    const nextCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: completion.choices[0].message.tool_calls ? [
        {
          type: 'function',
          function: {
            name: 'exec',
            description: 'Execute a shell command in the workspace',
            parameters: {
              type: 'object',
              properties: {
                workspaceId: { type: 'string' },
                command: { type: 'string' }
              },
              required: ['workspaceId', 'command']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'file_write',
            description: 'Write content to a file',
            parameters: {
              type: 'object',
              properties: {
                workspaceId: { type: 'string' },
                path: { type: 'string' },
                content: { type: 'string' }
              },
              required: ['workspaceId', 'path', 'content']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'file_read',
            description: 'Read content from a file',
            parameters: {
              type: 'object',
              properties: {
                workspaceId: { type: 'string' },
                path: { type: 'string' }
              },
              required: ['workspaceId', 'path']
            }
          }
        }
      ] : undefined
    });

    response = nextCompletion.choices[0].message;
  }

  const finalContent = response.content || 'Task completed (no summary provided)';
  
  // Check if any tools were actually called
  const toolsUsed = iterations > 0;
  
  // Build full output with execution log
  let fullOutput = '';
  
  if (executionLog.length > 0) {
    fullOutput += `### 🔧 Execution Log (${iterations} iteration${iterations > 1 ? 's' : ''})\n`;
    fullOutput += executionLog.join('\n');
    fullOutput += '\n\n---\n\n';
  }
  
  if (!toolsUsed) {
    // Model didn't use tools - this is a failure
    return {
      success: false,
      output: `⚠️ **Agent did not use any tools!**\n\nResponse was:\n${finalContent}\n\nThis task may need to be retried.`
    };
  }
  
  fullOutput += `### ✅ Summary\n${finalContent}`;
  
  const success = !finalContent.toLowerCase().includes('error:') &&
                  !finalContent.toLowerCase().includes('failed to');

  return { success, output: fullOutput };
}
