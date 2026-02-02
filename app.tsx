import { CReact, renderCloudDOM } from '@creact-labs/creact';
import { App } from './src/components/App';
import { Provider } from './src/providers/Provider';
import { FileBackend } from './src/providers/FileBackend';

CReact.provider = new Provider();
CReact.backend = new FileBackend({
  directory: './.creact-state',
});

export default async function main() {
  await renderCloudDOM(<App />, 'agent');
}
