import 'dotenv/config';
import { EventEmitter } from 'events';
import type { Provider as IProvider, InstanceNode } from '@creact-labs/creact';
import {
  handleHttpServer,
  handleChatHandler,
  handleChatResponse,
  handleCompletion,
  handleMemory,
  handleAddMessages,
  handleChatModel,
  handleTool,
  handleMessage,
  handleProject,
  handleAgent,
  handleUpdateProject,
  handleUpdateAgent,
} from './handlers';

export class Provider extends EventEmitter implements IProvider {
  async materialize(nodes: InstanceNode[]): Promise<void> {
    for (const node of nodes) {
      switch (node.constructType) {
        case 'HttpServer':
          handleHttpServer(node);
          break;
        case 'ChatHandler':
          handleChatHandler(node, this);
          break;
        case 'ChatResponse':
          handleChatResponse(node, this);
          break;
        case 'Completion':
          handleCompletion(node, this);
          break;
        case 'Memory':
          handleMemory(node);
          break;
        case 'AddMessages':
          handleAddMessages(node, this);
          break;
        case 'ChatModel':
          handleChatModel(node);
          break;
        case 'Tool':
          handleTool(node);
          break;
        case 'Message':
          handleMessage(node);
          break;
        case 'Project':
          handleProject(node);
          break;
        case 'Agent':
          handleAgent(node);
          break;
        case 'UpdateProject':
          handleUpdateProject(node, this);
          break;
        case 'UpdateAgent':
          handleUpdateAgent(node, this);
          break;
      }
    }
  }

  async destroy(): Promise<void> {}
  stop(): void {}
}
