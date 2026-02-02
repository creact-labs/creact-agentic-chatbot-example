import { useInstance, type OutputAccessors } from '@creact-labs/creact';
import { HttpServer, type HttpServerOutputs } from './HttpServer.construct';

export function Server({ port, staticDir, children }: {
  port: number;
  staticDir: string;
  children: (outputs: OutputAccessors<HttpServerOutputs>) => any;
}) {
  const outputs = useInstance<HttpServerOutputs>(HttpServer, { port, staticDir });
  return children(outputs);
}
