import type { InstanceNode } from '@creact-labs/creact';
import type { EventEmitter } from 'events';

/**
 * Handle Project construct - initializes project state if not present
 */
export function handleProject(node: InstanceNode): void {
  if (!node.outputs?.id) {
    node.setOutputs({
      id: `proj-${Date.now().toString(36)}`,
      name: node.props.name,
      description: node.props.description,
      workspaceId: node.props.workspaceId,
      team: [],
      sprints: [],
      status: 'idle'
    });
  }
}

/**
 * Handle Agent construct - initializes agent state if not present
 */
export function handleAgent(node: InstanceNode): void {
  if (!node.outputs?.id) {
    node.setOutputs({
      id: `agent-${Date.now().toString(36)}`,
      memberId: node.props.memberId,
      messages: [],
      toolsCreated: [],
      status: 'idle'
    });
  }
}

/**
 * Update project state (team, sprints, tasks, status)
 */
export function handleUpdateProject(node: InstanceNode, emitter: EventEmitter): void {
  const { projectId, updates } = node.props;
  if (!projectId || !updates) return;

  // Create a hash to prevent duplicate updates
  const updateHash = JSON.stringify({ projectId, updates, ts: Date.now() });
  if (node.outputs?.updateHash === updateHash) return;

  node.setOutputs({ updated: true, updateHash });

  emitter.emit('outputsChanged', {
    resourceName: projectId,
    outputs: updates,
    timestamp: Date.now(),
    merge: true  // Merge with existing outputs
  });
}

/**
 * Update agent state (messages, currentTask, toolsCreated)
 */
export function handleUpdateAgent(node: InstanceNode, emitter: EventEmitter): void {
  const { agentId, updates } = node.props;
  if (!agentId || !updates) return;

  const updateHash = JSON.stringify({ agentId, updates, ts: Date.now() });
  if (node.outputs?.updateHash === updateHash) return;

  node.setOutputs({ updated: true, updateHash });

  emitter.emit('outputsChanged', {
    resourceName: agentId,
    outputs: updates,
    timestamp: Date.now(),
    merge: true
  });
}
