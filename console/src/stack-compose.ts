import type { Schema } from './api';
import { preparePayload } from './components/SchemaForm';

export const composeByteLimit = 512 * 1024;
export interface StackComposeDraft {
  name: string;
  description: string;
  compose: boolean;
  dockerCompose: string;
  rancherCompose: string;
  startOnCreate: boolean;
  variables: { id: number; name: string; value: string }[];
}
export function prepareStackCompose(schema: Schema, draft: StackComposeDraft) {
  if (schema.id !== 'stack' || !schema.collectionMethods?.includes('POST'))
    throw new Error('A criação de stacks não está disponível.');
  const values: Record<string, unknown> = {
    name: draft.name.trim(),
    description: draft.description,
  };
  if (!values.name) throw new Error('Preencha o nome da stack.');
  if (draft.compose) {
    if (!draft.dockerCompose.trim()) throw new Error('Preencha Docker Compose.');
    for (const [label, value] of [
      ['Docker Compose', draft.dockerCompose],
      ['Rancher Compose', draft.rancherCompose],
    ]) {
      if (new TextEncoder().encode(value).byteLength > composeByteLimit)
        throw new Error(`${label} aceita até 512 KiB em UTF-8.`);
      if (value.includes('\0')) throw new Error(`${label} contém um caractere nulo.`);
    }
    values.dockerCompose = draft.dockerCompose;
    if (draft.rancherCompose.trim()) values.rancherCompose = draft.rancherCompose;
    values.startOnCreate = draft.startOnCreate;
    const environment: Record<string, string> = Object.create(null);
    for (const row of draft.variables) {
      const name = row.name.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
        throw new Error('Cada variável precisa de um nome válido, como APP_PORT.');
      if (Object.hasOwn(environment, name)) throw new Error(`Variável duplicada: ${name}.`);
      environment[name] = row.value;
    }
    if (draft.variables.length) values.environment = environment;
  }
  return validateStackCreation(schema, values);
}
export function validateStackCreation(schema: Schema, values: Record<string, unknown>) {
  if (schema.id !== 'stack' || !schema.collectionMethods?.includes('POST'))
    throw new Error('A criação de stacks não está mais disponível.');
  for (const name of Object.keys(values)) {
    if (!schema.resourceFields[name]?.create)
      throw new Error(`O Rancher não permite mais preencher ${name}. Reabra o painel.`);
  }
  return preparePayload(schema, values);
}
