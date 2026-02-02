import type { InstanceNode } from '@creact-labs/creact';
import type { EventEmitter } from 'events';

function hash(obj: any): string {
  return JSON.stringify(obj);
}

export function handleChatModel(node: InstanceNode): void {
  node.setOutputs({ id: node.id, model: node.props.model });
}

export function handleTool(node: InstanceNode): void {
  node.setOutputs({
    id: node.id,
    name: node.props.name,
    description: node.props.description
  });
}

export function handleMessage(node: InstanceNode): void {
  node.setOutputs({
    id: node.id,
    role: node.props.role,
    content: node.props.content
  });
}

export function handleConversation(node: InstanceNode): void {
  const messageIds = node.outputs?.messageIds || [];
  node.setOutputs({ id: node.id, messageIds });
}

export function handleAddToConversation(node: InstanceNode, emitter: EventEmitter): void {
  const { conversationId, messageId, currentMessageIds } = node.props;
  if (!conversationId || !messageId) return;

  // Idempotency check
  const propsHash = hash({ conversationId, messageId });
  if (node.outputs?.propsHash === propsHash) {
    return;
  }

  node.setOutputs({ added: true, propsHash });

  const existingIds = currentMessageIds || [];
  if (!existingIds.includes(messageId)) {
    const newMessageIds = [...existingIds, messageId];

    emitter.emit('outputsChanged', {
      resourceName: conversationId,
      outputs: { id: conversationId, messageIds: newMessageIds },
      timestamp: Date.now(),
    });
  }
}
