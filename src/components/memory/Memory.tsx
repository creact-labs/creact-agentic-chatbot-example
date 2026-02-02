import { useInstance, type OutputAccessors } from '@creact-labs/creact';
import { Memory as MemoryConstruct, type MemoryOutputs } from './Memory.construct';

export function Memory({ children }: {
  children: (outputs: OutputAccessors<MemoryOutputs>) => any;
}) {
  const outputs = useInstance<MemoryOutputs>(MemoryConstruct, {});
  return children(outputs);
}
