import type { InstanceNode } from '@creact-labs/creact';

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
