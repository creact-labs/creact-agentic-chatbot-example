import type { InstanceNode } from '@creact-labs/creact';
import express, { type Express, type Response } from 'express';
import path from 'path';
import { EventEmitter } from 'events';

// Runtime registries
const serverInstances = new Map<string, { app: Express; url: string }>();
const handlerInstances = new Map<string, { pending: string | null; waitingRes: Response | null }>();

export function handleHttpServer(node: InstanceNode): void {
  const id = node.id;
  const { port, staticDir } = node.props;
  console.log(`[Provider] HttpServer materialize: ${id}`);

  if (!serverInstances.has(id)) {
    const app = express();
    app.use(express.json());

    if (staticDir) {
      app.use(express.static(path.resolve(staticDir)));
    }

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });

    serverInstances.set(id, { app, url: `http://localhost:${port}` });
  }

  const server = serverInstances.get(id)!;
  node.setOutputs({ id, url: server.url });
}

export function handleChatHandler(node: InstanceNode, emitter: EventEmitter): void {
  const id = node.id;
  const { serverId, path: routePath } = node.props;
  console.log(`[Provider] ChatHandler materialize: ${id}, serverId=${serverId}`);

  const server = serverInstances.get(serverId);
  if (!server) {
    console.log(`[Provider] ChatHandler: server not found for ${serverId}`);
    return;
  }

  if (!handlerInstances.has(id)) {
    handlerInstances.set(id, { pending: null, waitingRes: null });
    console.log(`[Provider] ChatHandler: registering POST ${routePath}`);

    server.app.post(routePath, (req, res) => {
      console.log(`[Provider] POST ${routePath} received:`, req.body);
      const handler = handlerInstances.get(id)!;

      handler.pending = req.body.message;
      handler.waitingRes = res;

      console.log(`[Provider] Emitting outputsChanged for ${id}`);
      emitter.emit('outputsChanged', {
        resourceName: id,
        outputs: { id, pending: handler.pending },
        timestamp: Date.now(),
      });
    });
  }

  const handler = handlerInstances.get(id)!;
  node.setOutputs({ id, pending: handler.pending });
}

export function handleChatResponse(node: InstanceNode, emitter: EventEmitter): void {
  const { handlerId, content } = node.props;
  console.log(`[Provider] ChatResponse materialize: handlerId=${handlerId}, content=${content?.slice(0, 50)}`);
  if (!handlerId || !content) return;

  // Use node.id for idempotency - CReact ensures unique IDs
  if (node.outputs?.sent) {
    return;
  }

  const handler = handlerInstances.get(handlerId);
  if (!handler?.waitingRes) return;

  console.log(`[Provider] ChatResponse: sending response`);
  handler.waitingRes.json({ response: content });
  handler.waitingRes = null;
  handler.pending = null;

  node.setOutputs({ sent: true });

  emitter.emit('outputsChanged', {
    resourceName: handlerId,
    outputs: { id: handlerId, pending: null },
    timestamp: Date.now(),
  });
}
