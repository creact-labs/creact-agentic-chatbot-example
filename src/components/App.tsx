import { untrack } from '@creact-labs/creact';
import { Server } from './server';
import { Chat, Model, SendResponse } from './chat';
import { Memory, SaveMessages } from './memory';
import { Message } from './message';
import { Completion } from './completion';
import { ToolProvider, DuckDuckGo, Browser } from './tools';

export function App() {
  return (
    <Server key="main" port={3000} staticDir="./public">
      {(server) => (
        <Chat serverId={server.id()} path="/chat">
          {(chat) => (
            <Model model="gpt-4o-mini">
              {(model) => (
                <Memory>
                  {(memory) => {
                    const pending = chat.pending();
                    if (!pending?.id || !pending?.content) return null;

                    const modelName = model.model();
                    if (!modelName) return null;

                    const memoryId = memory.id();
                    if (!memoryId) return null;

                    // Use untrack to read messages without creating reactive dependency
                    // This prevents re-render when SaveMessages updates memory
                    const existingMessages = untrack(() => memory.messages()) || [];

                    // Create user message
                    return (
                      <ToolProvider>
                        <DuckDuckGo />
                        <Browser />
                        <Message key={`user-${pending.id}`} role="user" content={pending.content}>
                          {(userMsg) => {
                            // Filter out any messages with null/undefined content (from incomplete hydration)
                            // But keep assistant messages with tool_calls even if content is null
                            // Also keep tool messages (they have content but we want to be explicit)
                            const validMessages = existingMessages.filter(
                              (m: any) => {
                                if (!m || !m.role) return false;
                                // Keep messages with content
                                if (m.content) return true;
                                // Keep assistant messages with tool_calls (even if content is null)
                                if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) return true;
                                // Keep tool messages
                                if (m.role === 'tool') return true;
                                return false;
                              }
                            );
                            
                            // Debug: log message structure to verify filter is working
                            console.log(`[App] Filtered ${validMessages.length} valid messages from ${existingMessages.length} existing messages`);
                            if (validMessages.length > 0) {
                              console.log(`[App] First valid message:`, JSON.stringify(validMessages[0], null, 2).slice(0, 200));
                            }
                            
                            const allMessages = [
                              { role: 'system', content: 'You are a helpful assistant. Always respond using valid Markdown formatting. Use bullet points, numbered lists, headers, bold, italic, and code blocks where appropriate.' },
                              ...validMessages,
                              { role: 'user', content: pending.content }
                            ];
                            
                            // Debug: verify message order before sending to OpenAI
                            console.log(`[App] Sending ${allMessages.length} messages to OpenAI. First 3 roles:`, allMessages.slice(0, 3).map(m => m.role));

                            return (
                              <Completion
                                requestId={pending.id}
                                model={modelName}
                                messages={allMessages}
                              >
                                {(responseContent, conversationHistory) => {
                                  console.log(`[App] Got response, creating assistant message...`);
                                  // Extract only NEW messages (those not in allMessages)
                                  const inputMessageCount = allMessages.length;
                                  const newMessages = conversationHistory?.slice(inputMessageCount) || [
                                    { role: 'user', content: pending.content },
                                    { role: 'assistant', content: responseContent }
                                  ];
                                  
                                  return (
                                    <Message key={`assistant-${pending.id}`} role="assistant" content={responseContent}>
                                      {(assistantMsg) => {
                                        console.log(`[App] Assistant message created, saving and sending...`);
                                        console.log(`[App] handlerId=${chat.id()}, messageId=${pending.id}`);
                                        return (
                                          <>
                                            <SaveMessages
                                              memoryId={memoryId}
                                              currentMessages={existingMessages}
                                              newMessages={newMessages}
                                            />
                                            <SendResponse
                                              handlerId={chat.id()}
                                              messageId={pending.id}
                                              content={responseContent}
                                            />
                                          </>
                                        );
                                      }}
                                    </Message>
                                  );
                                }}
                              </Completion>
                            );
                          }}
                        </Message>
                      </ToolProvider>
                    );
                  }}
                </Memory>
              )}
            </Model>
          )}
        </Chat>
      )}
    </Server>
  );
}
