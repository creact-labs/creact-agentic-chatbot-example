import type { InstanceNode } from '@creact-labs/creact';
import type { EventEmitter } from 'events';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Track completion requests that have been started
const completionStarted = new Set<string>();

export function handleCompletion(node: InstanceNode, emitter: EventEmitter): void {
  const { requestId, model, messages, tools } = node.props;
  if (!requestId || !model || !messages) return;

  // Already have a response for this request
  if (node.outputs?.response && node.outputs?.requestId === requestId) {
    return;
  }

  // Already started this request
  if (completionStarted.has(requestId)) {
    return;
  }

  completionStarted.add(requestId);
  const nodeId = node.id;

  // Start async completion
  (async () => {
    console.log(`[Provider] Completion: calling OpenAI for ${requestId}...`);

    const openaiTools = tools?.length ? tools.map((tool: any) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })) : undefined;

    const toolMap = new Map(tools?.map((t: any) => [t.name, t]) || []);
    let currentMessages: Array<any> = [...messages];

    while (true) {
      const completion = await openai.chat.completions.create({
        model,
        messages: currentMessages,
        tools: openaiTools,
      });

      const choice = completion.choices[0];
      const message = choice.message;

      if (choice.finish_reason === 'stop' || !message.tool_calls?.length) {
        const content = message.content || '';
        console.log(`[Provider] Completion: got response: ${content.slice(0, 50)}...`);

        // Add final assistant message to conversation history
        currentMessages.push(message);

        emitter.emit('outputsChanged', {
          resourceName: nodeId,
          outputs: { 
            id: nodeId, 
            status: 'complete', 
            response: content, 
            requestId,
            conversationHistory: currentMessages
          },
          timestamp: Date.now(),
        });
        break;
      }

      // Handle tool calls
      console.log(`[Provider] Completion: ${message.tool_calls.length} tool calls`);
      currentMessages.push(message);

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') continue;

        const toolName = toolCall.function.name;
        const tool = toolMap.get(toolName) as any;

        let result: string;
        if (tool) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            result = await tool.execute(args);
            console.log(`[Provider] Completion: tool ${toolName} result: ${result.slice(0, 100)}...`);
          } catch (error) {
            result = `Error: ${error instanceof Error ? error.message : String(error)}`;
          }
        } else {
          result = `Unknown tool: ${toolName}`;
        }

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }
  })();
}
