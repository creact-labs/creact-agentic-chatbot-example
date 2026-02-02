import { Tool } from './Tool';
import { writeFile, readFile, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import {
  workspaceRegistry,
  templateStore,
  toolStore,
  execInContainer,
  copyToContainer,
  copyFromContainer
} from '../../docker';

export function DockerTools() {
  return (
    <>
      {/* ═══════════════════ DOCKERFILE TOOLS ═══════════════════ */}

      <Tool
        name="dockerfile_write"
        description="Write or update the Dockerfile for a workspace. Does not rebuild - use dockerfile_build or dockerfile_test after."
        parameters={{
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID" },
            content: { type: "string", description: "Full Dockerfile content" }
          },
          required: ["workspaceId", "content"]
        }}
        execute={async ({ workspaceId, content }) => {
          try {
            const ws = await workspaceRegistry.updateDockerfile(workspaceId, content);
            return `✓ Dockerfile updated for workspace ${ws.id}\n\nDockerfile:\n${content}\n\nRun dockerfile_build or dockerfile_test to apply changes.`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="dockerfile_build"
        description="Build/rebuild the Docker image for a workspace from its Dockerfile. Preserves workspace files in volume."
        parameters={{
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID" }
          },
          required: ["workspaceId"]
        }}
        execute={async ({ workspaceId }) => {
          try {
            const result = await workspaceRegistry.rebuild(workspaceId);
            if (result.success) {
              return `✓ Build successful for workspace ${workspaceId}\n\nBuild log:\n${result.log.slice(-2000)}`;
            } else {
              return `✗ Build failed for workspace ${workspaceId}\n\nBuild log:\n${result.log.slice(-2000)}`;
            }
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="dockerfile_test"
        description="Build the Docker image and run a test command to verify the setup works. Use this to iterate on Dockerfiles."
        parameters={{
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID" },
            testCommand: { type: "string", description: "Command to run to verify the image works (e.g., 'python --version')" }
          },
          required: ["workspaceId", "testCommand"]
        }}
        execute={async ({ workspaceId, testCommand }) => {
          try {
            // First rebuild
            const buildResult = await workspaceRegistry.rebuild(workspaceId);
            if (!buildResult.success) {
              return `✗ Build failed\n\nBuild log:\n${buildResult.log.slice(-2000)}`;
            }

            // Then run test command
            const ws = buildResult.workspace;
            const testResult = await execInContainer(ws.containerName, testCommand);

            let output = `Build: ✓ Success\n\nTest command: ${testCommand}\n`;
            if (testResult.code === 0) {
              output += `Test: ✓ Passed\n`;
            } else {
              output += `Test: ✗ Failed (exit code ${testResult.code})\n`;
            }
            if (testResult.stdout) output += `\nOutput:\n${testResult.stdout}`;
            if (testResult.stderr) output += `\nErrors:\n${testResult.stderr}`;

            return output;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      {/* ═══════════════════ TEMPLATE TOOLS ═══════════════════ */}

      <Tool
        name="template_save"
        description="Save the current Dockerfile of a workspace as a reusable template"
        parameters={{
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID to save as template" },
            name: { type: "string", description: "Template name (e.g., 'python-ml', 'rust-dev')" },
            description: { type: "string", description: "What this template is for" },
            testCommand: { type: "string", description: "Optional test command to verify the template" }
          },
          required: ["workspaceId", "name", "description"]
        }}
        execute={async ({ workspaceId, name, description, testCommand }) => {
          try {
            const ws = await workspaceRegistry.get(workspaceId);
            if (!ws) return `✗ Workspace ${workspaceId} not found`;

            const template = await templateStore.create(
              name,
              description,
              ws.dockerfile,
              testCommand
            );

            return `✓ Template saved\n  ID: ${template.id}\n  Name: ${template.name}\n  Description: ${template.description}`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="template_list"
        description="List all saved Dockerfile templates"
        parameters={{ type: "object", properties: {}, required: [] }}
        execute={async () => {
          try {
            const templates = await templateStore.list();
            if (templates.length === 0) {
              return 'No templates saved. Use template_save to save a working Dockerfile.';
            }

            return templates.map(t =>
              `[${t.id}] ${t.name}\n` +
              `  ${t.description}\n` +
              `  Test: ${t.testCommand || '(none)'}\n` +
              `  Created: ${new Date(t.createdAt).toLocaleString()}`
            ).join('\n\n');
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="template_delete"
        description="Delete a saved template"
        parameters={{
          type: "object",
          properties: {
            templateId: { type: "string", description: "Template ID to delete" }
          },
          required: ["templateId"]
        }}
        execute={async ({ templateId }) => {
          try {
            await templateStore.delete(templateId);
            return `✓ Template ${templateId} deleted`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      {/* ═══════════════════ WORKSPACE TOOLS ═══════════════════ */}

      <Tool
        name="workspace_create"
        description="Create a new workspace. Provide either a Dockerfile OR a templateId (not both). Set networkEnabled=true to allow internet access (for installing packages, making API calls, etc.)."
        parameters={{
          type: "object",
          properties: {
            name: { type: "string", description: "Workspace name" },
            dockerfile: { type: "string", description: "Full Dockerfile content (if not using template)" },
            templateId: { type: "string", description: "Template ID to create from (if not providing Dockerfile)" },
            networkEnabled: { type: "boolean", description: "Enable internet access in the container (default: false for security)" }
          },
          required: ["name"]
        }}
        execute={async ({ name, dockerfile, templateId, networkEnabled = false }) => {
          try {
            let ws;
            if (templateId) {
              ws = await workspaceRegistry.createFromTemplate(name, templateId, networkEnabled);
            } else if (dockerfile) {
              ws = await workspaceRegistry.createFromDockerfile(name, dockerfile, networkEnabled);
            } else {
              // Default minimal Dockerfile
              const defaultDockerfile = 'FROM alpine:3.19\nRUN apk add --no-cache bash\nWORKDIR /workspace';
              ws = await workspaceRegistry.createFromDockerfile(name, defaultDockerfile, networkEnabled);
            }

            if (ws.status === 'failed') {
              return `✗ Workspace created but build failed\n  ID: ${ws.id}\n  Status: ${ws.status}\n\nBuild log:\n${ws.buildLog?.slice(-2000) || 'No log'}`;
            }

            return `✓ Workspace created\n  ID: ${ws.id}\n  Name: ${ws.name}\n  Status: ${ws.status}\n  Network: ${ws.networkEnabled ? '🌐 enabled' : '🔒 disabled'}\n  Template: ${ws.templateId || '(custom)'}`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="workspace_list"
        description="List all workspaces with their status"
        parameters={{ type: "object", properties: {}, required: [] }}
        execute={async () => {
          try {
            const list = await workspaceRegistry.list();
            if (list.length === 0) {
              return 'No workspaces. Create one with workspace_create.';
            }

            const statusIcons: Record<string, string> = {
              running: '●',
              stopped: '○',
              building: '◐',
              failed: '✗'
            };

            return list.map(ws =>
              `[${statusIcons[ws.status] || '?'}] ${ws.id}\n` +
              `    Name: ${ws.name}\n` +
              `    Status: ${ws.status}\n` +
              `    Network: ${ws.networkEnabled ? '🌐 enabled' : '🔒 disabled'}\n` +
              `    Template: ${ws.templateId || '(custom)'}\n` +
              `    Last used: ${new Date(ws.lastAccessedAt).toLocaleString()}`
            ).join('\n\n');
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="workspace_destroy"
        description="Destroy a workspace. Optionally keep the volume to preserve files."
        parameters={{
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID" },
            keepVolume: { type: "boolean", description: "Keep volume data (default: false)" }
          },
          required: ["workspaceId"]
        }}
        execute={async ({ workspaceId, keepVolume = false }) => {
          try {
            await workspaceRegistry.destroy(workspaceId, keepVolume);
            return `✓ Workspace ${workspaceId} destroyed${keepVolume ? ' (volume preserved)' : ''}`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      {/* ═══════════════════ EXECUTION TOOLS ═══════════════════ */}

      <Tool
        name="exec"
        description="Execute a shell command in a workspace"
        parameters={{
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID" },
            command: { type: "string", description: "Shell command to run" }
          },
          required: ["workspaceId", "command"]
        }}
        execute={async ({ workspaceId, command }) => {
          try {
            const ws = await workspaceRegistry.ensureRunning(workspaceId);
            const result = await execInContainer(ws.containerName, command);

            let output = '';
            if (result.stdout) output += result.stdout;
            if (result.stderr) output += (output ? '\n' : '') + `[stderr] ${result.stderr}`;
            if (result.code !== 0) output += `\n[exit code: ${result.code}]`;

            return output || '(no output)';
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="file_write"
        description="Write content to a file in the workspace"
        parameters={{
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID" },
            path: { type: "string", description: "File path relative to /workspace" },
            content: { type: "string", description: "File content" }
          },
          required: ["workspaceId", "path", "content"]
        }}
        execute={async ({ workspaceId, path, content }) => {
          try {
            const ws = await workspaceRegistry.ensureRunning(workspaceId);

            // Create parent directories
            const dir = path.split('/').slice(0, -1).join('/');
            if (dir) {
              await execInContainer(ws.containerName, `mkdir -p /workspace/${dir}`);
            }

            // Write via temp file
            const tmp = `/tmp/creact-${randomUUID()}`;
            await writeFile(tmp, content);
            await copyToContainer(ws.containerName, tmp, `/workspace/${path}`);
            await rm(tmp);

            return `✓ Written ${content.length} bytes to ${path}`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="file_read"
        description="Read content from a file in the workspace"
        parameters={{
          type: "object",
          properties: {
            workspaceId: { type: "string", description: "Workspace ID" },
            path: { type: "string", description: "File path relative to /workspace" }
          },
          required: ["workspaceId", "path"]
        }}
        execute={async ({ workspaceId, path }) => {
          try {
            const ws = await workspaceRegistry.ensureRunning(workspaceId);

            const tmp = `/tmp/creact-${randomUUID()}`;
            await copyFromContainer(ws.containerName, `/workspace/${path}`, tmp);
            const content = await readFile(tmp, 'utf-8');
            await rm(tmp);

            return content;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      {/* ═══════════════════ CUSTOM TOOLS ═══════════════════ */}

      <Tool
        name="tool_create"
        description="Create and save a reusable tool as a shell script. The AI can create tools for common tasks and reuse them across workspaces."
        parameters={{
          type: "object",
          properties: {
            name: { type: "string", description: "Tool name (e.g., 'run_tests', 'lint_code')" },
            description: { type: "string", description: "What the tool does" },
            script: { type: "string", description: "Shell script to execute" },
            language: { 
              type: "string", 
              enum: ["python", "node", "shell"],
              description: "Recommended workspace language for this tool"
            }
          },
          required: ["name", "description", "script", "language"]
        }}
        execute={async ({ name, description, script, language }) => {
          try {
            const tool = await toolStore.create(name, description, script, language);
            return `✓ Tool created\n  ID: ${tool.id}\n  Name: ${tool.name}\n  Language: ${tool.language}\n\nScript:\n${script}`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="tool_list"
        description="List all saved custom tools"
        parameters={{ type: "object", properties: {}, required: [] }}
        execute={async () => {
          try {
            const tools = await toolStore.list();
            if (tools.length === 0) {
              return 'No custom tools saved. Use tool_create to save reusable scripts.';
            }

            return tools.map(t =>
              `[${t.id}] ${t.name}\n` +
              `  ${t.description}\n` +
              `  Language: ${t.language}\n` +
              `  Script: ${t.script.slice(0, 80)}${t.script.length > 80 ? '...' : ''}`
            ).join('\n\n');
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="tool_run"
        description="Execute a saved custom tool in a workspace"
        parameters={{
          type: "object",
          properties: {
            toolId: { type: "string", description: "Tool ID" },
            workspaceId: { type: "string", description: "Workspace ID to run the tool in" }
          },
          required: ["toolId", "workspaceId"]
        }}
        execute={async ({ toolId, workspaceId }) => {
          try {
            const tool = await toolStore.get(toolId);
            if (!tool) return `✗ Tool ${toolId} not found`;

            const ws = await workspaceRegistry.ensureRunning(workspaceId);
            const result = await execInContainer(ws.containerName, tool.script);

            let output = `Running tool: ${tool.name}\n${'─'.repeat(40)}\n`;
            if (result.stdout) output += result.stdout;
            if (result.stderr) output += (result.stdout ? '\n' : '') + `[stderr] ${result.stderr}`;
            if (result.code !== 0) output += `\n[exit code: ${result.code}]`;

            return output || `Tool ${tool.name} completed (no output)`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />

      <Tool
        name="tool_delete"
        description="Delete a saved custom tool"
        parameters={{
          type: "object",
          properties: {
            toolId: { type: "string", description: "Tool ID to delete" }
          },
          required: ["toolId"]
        }}
        execute={async ({ toolId }) => {
          try {
            await toolStore.delete(toolId);
            return `✓ Tool ${toolId} deleted`;
          } catch (e: any) {
            return `✗ Error: ${e.message}`;
          }
        }}
      />
    </>
  );
}
