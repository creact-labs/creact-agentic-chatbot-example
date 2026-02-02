import { createStore } from '@creact-labs/creact';
import * as ops from './operations';
import { templateStore } from './TemplateStore';

export interface Workspace {
  id: string;
  name: string;
  templateId?: string;
  dockerfile: string;
  imageId: string;
  imageTag: string;
  containerId: string | null;
  containerName: string;
  volumeName: string;
  status: 'building' | 'running' | 'stopped' | 'failed' | 'destroyed';
  buildLog?: string;
  networkEnabled: boolean;
  createdAt: number;
  lastAccessedAt: number;
}

interface WorkspaceStoreState {
  workspaces: Record<string, Workspace>;
}

const MAX_RUNNING = 5;
const MAX_TOTAL = 20;
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const [state, setState] = createStore<WorkspaceStoreState>({ workspaces: {} });

// Helper to update a workspace
function updateWorkspace(id: string, updates: Partial<Workspace>): Workspace | null {
  const ws = state.workspaces[id];
  if (!ws) return null;
  const updated = { ...ws, ...updates };
  setState('workspaces', id, updated);
  return updated;
}

// Helper to enforce limits
async function enforceLimit(): Promise<void> {
  const all = Object.values(state.workspaces);
  const running = all.filter(w => w.status === 'running');
  const now = Date.now();

  // Stop stale containers
  for (const ws of running) {
    if (now - ws.lastAccessedAt > TTL_MS) {
      await workspaceRegistry.stop(ws.id);
    }
  }

  // If still over limit, stop oldest
  const stillRunning = Object.values(state.workspaces).filter(w => w.status === 'running');
  if (stillRunning.length >= MAX_RUNNING) {
    const oldest = stillRunning.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)[0];
    await workspaceRegistry.stop(oldest.id);
  }

  // Destroy if over total limit
  const active = Object.values(state.workspaces).filter(w => w.status !== 'destroyed');
  if (active.length >= MAX_TOTAL) {
    const oldest = active.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)[0];
    await workspaceRegistry.destroy(oldest.id);
  }
}

export const workspaceRegistry = {
  /**
   * Create a workspace from a Dockerfile
   */
  async createFromDockerfile(name: string, dockerfile: string, networkEnabled: boolean = false): Promise<Workspace> {
    await enforceLimit();

    const id = `ws-${Date.now().toString(36)}`;
    const containerName = `creact-${id}`;
    const volumeName = `creact-vol-${id}`;
    const imageTag = `creact-img-${id}`;

    // Create volume first
    await ops.createVolume(volumeName);

    // Build image
    const buildResult = await ops.buildImage(dockerfile, imageTag);

    if (!buildResult.success) {
      const workspace: Workspace = {
        id,
        name,
        dockerfile,
        imageId: '',
        imageTag,
        containerId: null,
        containerName,
        volumeName,
        status: 'failed',
        networkEnabled,
        buildLog: buildResult.log,
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
      };

      setState('workspaces', id, workspace);
      return workspace;
    }

    // Create and start container
    const containerId = await ops.createContainerFromImage(
      buildResult.imageId!,
      containerName,
      volumeName,
      networkEnabled
    );
    await ops.startContainer(containerName);

    const workspace: Workspace = {
      id,
      name,
      dockerfile,
      imageId: buildResult.imageId!,
      imageTag,
      containerId,
      containerName,
      volumeName,
      networkEnabled,
      status: 'running',
      buildLog: buildResult.log,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    setState('workspaces', id, workspace);
    return workspace;
  },

  /**
   * Create a workspace from a saved template
   */
  async createFromTemplate(name: string, templateId: string, networkEnabled: boolean = false): Promise<Workspace> {
    const template = templateStore.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const workspace = await this.createFromDockerfile(name, template.dockerfile, networkEnabled);
    updateWorkspace(workspace.id, { templateId });
    return { ...workspace, templateId };
  },

  /**
   * Get a workspace by ID
   */
  get(id: string): Workspace | null {
    const ws = state.workspaces[id];
    if (ws && ws.status !== 'destroyed') {
      updateWorkspace(id, { lastAccessedAt: Date.now() });
    }
    return ws || null;
  },

  /**
   * List all non-destroyed workspaces
   */
  list(): Workspace[] {
    return Object.values(state.workspaces).filter(w => w.status !== 'destroyed');
  },

  /**
   * Update the Dockerfile for a workspace (does not rebuild)
   */
  updateDockerfile(id: string, dockerfile: string): Workspace {
    const ws = state.workspaces[id];
    if (!ws) throw new Error(`Workspace ${id} not found`);
    if (ws.status === 'destroyed') throw new Error(`Workspace ${id} is destroyed`);

    const updated = updateWorkspace(id, { dockerfile, lastAccessedAt: Date.now() });
    return updated!;
  },

  /**
   * Rebuild a workspace from its Dockerfile
   */
  async rebuild(id: string): Promise<{ success: boolean; log: string; workspace: Workspace }> {
    const ws = state.workspaces[id];
    if (!ws) throw new Error(`Workspace ${id} not found`);
    if (ws.status === 'destroyed') throw new Error(`Workspace ${id} is destroyed`);

    // Stop and remove old container (keep volume!)
    await ops.stopContainer(ws.containerName);
    await ops.removeContainer(ws.containerName);

    // Remove old image
    if (ws.imageId) {
      await ops.removeImage(ws.imageId);
    }

    updateWorkspace(id, { status: 'building' });

    // Build new image (pass volume so COPY commands work)
    const buildResult = await ops.buildImage(ws.dockerfile, ws.imageTag, ws.volumeName);

    if (!buildResult.success) {
      const updated = updateWorkspace(id, { 
        status: 'failed', 
        imageId: '', 
        buildLog: buildResult.log 
      });
      return { success: false, log: buildResult.log, workspace: updated! };
    }

    // Create and start new container with existing volume
    const containerId = await ops.createContainerFromImage(
      buildResult.imageId!,
      ws.containerName,
      ws.volumeName,
      ws.networkEnabled ?? false
    );
    await ops.startContainer(ws.containerName);

    const updated = updateWorkspace(id, {
      imageId: buildResult.imageId!,
      containerId,
      status: 'running',
      buildLog: buildResult.log,
      lastAccessedAt: Date.now()
    });

    return { success: true, log: buildResult.log, workspace: updated! };
  },

  /**
   * Ensure a workspace is running (start if stopped)
   */
  async ensureRunning(id: string): Promise<Workspace> {
    const ws = state.workspaces[id];
    if (!ws) throw new Error(`Workspace ${id} not found`);
    if (ws.status === 'destroyed') throw new Error(`Workspace ${id} is destroyed`);
    if (ws.status === 'failed') throw new Error(`Workspace ${id} failed to build. Update Dockerfile and rebuild.`);
    if (ws.status === 'building') throw new Error(`Workspace ${id} is currently building`);

    if (ws.status === 'stopped') {
      await enforceLimit();
      await ops.startContainer(ws.containerName);
      updateWorkspace(id, { status: 'running' });
    }

    const updated = updateWorkspace(id, { lastAccessedAt: Date.now() });
    return updated!;
  },

  /**
   * Stop a workspace
   */
  async stop(id: string): Promise<void> {
    const ws = state.workspaces[id];
    if (!ws || ws.status !== 'running') return;

    await ops.stopContainer(ws.containerName);
    updateWorkspace(id, { status: 'stopped' });
  },

  /**
   * Destroy a workspace
   */
  async destroy(id: string, keepVolume = false): Promise<void> {
    const ws = state.workspaces[id];
    if (!ws) return;

    await ops.stopContainer(ws.containerName);
    await ops.removeContainer(ws.containerName);
    if (ws.imageId) {
      await ops.removeImage(ws.imageId);
    }
    if (!keepVolume) {
      await ops.removeVolume(ws.volumeName);
    }

    updateWorkspace(id, { status: 'destroyed', containerId: null });
  }
};
