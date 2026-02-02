import type { InstanceNode } from '@creact-labs/creact';
import type { EventEmitter } from 'events';

function hash(obj: any): string {
  return JSON.stringify(obj);
}

export function handleMemory(node: InstanceNode): void {
  const messages = node.outputs?.messages || [];
  node.setOutputs({ id: node.id, messages });
}

export function handleAddMessages(node: InstanceNode, emitter: EventEmitter): void {
  const { memoryId, currentMessages, newMessages: messagesToAdd } = node.props;
  if (!memoryId || !messagesToAdd?.length) return;

  // Idempotency check
  const propsHash = hash({ memoryId, messagesToAdd });
  if (node.outputs?.propsHash === propsHash) {
    return;
  }

  node.setOutputs({ added: true, propsHash });

  const newMessages = [...(currentMessages || []), ...messagesToAdd];
  emitter.emit('outputsChanged', {
    resourceName: memoryId,
    outputs: { id: memoryId, messages: newMessages },
    timestamp: Date.now(),
  });
}
