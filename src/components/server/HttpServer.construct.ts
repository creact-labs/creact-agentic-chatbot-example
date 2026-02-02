export interface HttpServerProps {
  port: number;
  staticDir?: string;
}

export interface HttpServerOutputs {
  id: string;
  url: string;
}

export class HttpServer {
  constructor(public props: HttpServerProps) {}
}
