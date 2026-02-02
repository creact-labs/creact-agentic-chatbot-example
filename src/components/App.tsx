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
                            const validMessages = existingMessages.filter(
                              (m: any) => m && m.role && m.content
                            );
                            const allMessages = [
                              { role: 'system', content: 'You are a helpful assistant. Always respond using valid Markdown formatting. Use bullet points, numbered lists, headers, bold, italic, and code blocks where appropriate.' },
                              ...validMessages,
                              { role: 'user', content: pending.content }
                            ];

                            return (
                              <Completion
                                requestId={pending.id}
                                model={modelName}
                                messages={allMessages}
                              >
                                {(responseContent) => {
                                  console.log(`[App] Got response, creating assistant message...`);
                                  return (
                                    <Message key={`assistant-${pending.id}`} role="assistant" content={responseContent}>
                                      {(assistantMsg) => {
                                        console.log(`[App] Assistant message created, saving and sending...`);
                                        console.log(`[App] handlerId=${chat.id()}, messageId=${pending.id}`);
                                        return (
                                          <>
                                            <SaveMessages
                                              memoryId={memory.id()}
                                              currentMessages={existingMessages}
                                              newMessages={[
                                                { role: 'user', content: pending.content },
                                                { role: 'assistant', content: responseContent }
                                              ]}
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
