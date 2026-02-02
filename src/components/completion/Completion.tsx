import { useInstance, type JSXElement } from '@creact-labs/creact';
import { Completion as CompletionConstruct, type CompletionOutputs } from './Completion.construct';
import { useTools } from '../tools/ToolContext';

export interface CompletionProps {
  requestId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  children: (response: string, conversationHistory?: Array<any>) => JSXElement | null;
}

export function Completion({ requestId, model, messages, children }: CompletionProps) {
  const { tools: getTools } = useTools();
  const tools = getTools();

  const outputs = useInstance<CompletionOutputs>(CompletionConstruct, {
    requestId,
    model,
    messages,
    tools,
  });

  const response = outputs.response();
  const conversationHistory = outputs.conversationHistory?.();
  if (!response) return null;
  return children(response, conversationHistory);
}
