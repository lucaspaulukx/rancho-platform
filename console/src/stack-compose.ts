import { ptComposeValidation } from './i18n/domains/compose-validation';
import type { Schema } from './api';
import { preparePayload } from './components/SchemaForm';

type ValidationDetail =
  | [
      key:
        | 'composeValidation.createUnavailable'
        | 'composeValidation.nameRequired'
        | 'composeValidation.dockerRequired'
        | 'composeValidation.variableName'
        | 'composeValidation.createChanged',
    ]
  | [key: 'composeValidation.fileTooLarge' | 'composeValidation.nullCharacter', label: string]
  | [key: 'composeValidation.duplicateVariable' | 'composeValidation.fieldChanged', name: string];

export class StackComposeValidationError extends Error {
  readonly detail: ValidationDetail;

  constructor(...detail: ValidationDetail) {
    const [key, value] = detail;
    super(ptComposeValidation[key].replace(/\{(?:label|name)\}/g, () => value ?? ''));
    this.detail = detail;
  }
}

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
    throw new StackComposeValidationError('composeValidation.createUnavailable');
  const values: Record<string, unknown> = {
    name: draft.name.trim(),
    description: draft.description,
  };
  if (!values.name) throw new StackComposeValidationError('composeValidation.nameRequired');
  if (draft.compose) {
    if (!draft.dockerCompose.trim())
      throw new StackComposeValidationError('composeValidation.dockerRequired');
    for (const [label, value] of [
      ['Docker Compose', draft.dockerCompose],
      ['Rancher Compose', draft.rancherCompose],
    ]) {
      if (new TextEncoder().encode(value).byteLength > composeByteLimit)
        throw new StackComposeValidationError('composeValidation.fileTooLarge', label);
      if (value.includes('\0'))
        throw new StackComposeValidationError('composeValidation.nullCharacter', label);
    }
    values.dockerCompose = draft.dockerCompose;
    if (draft.rancherCompose.trim()) values.rancherCompose = draft.rancherCompose;
    values.startOnCreate = draft.startOnCreate;
    const environment: Record<string, string> = Object.create(null);
    for (const row of draft.variables) {
      const name = row.name.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
        throw new StackComposeValidationError('composeValidation.variableName');
      if (Object.hasOwn(environment, name))
        throw new StackComposeValidationError('composeValidation.duplicateVariable', name);
      environment[name] = row.value;
    }
    if (draft.variables.length) values.environment = environment;
  }
  return validateStackCreation(schema, values);
}
export function validateStackCreation(schema: Schema, values: Record<string, unknown>) {
  if (schema.id !== 'stack' || !schema.collectionMethods?.includes('POST'))
    throw new StackComposeValidationError('composeValidation.createChanged');
  for (const name of Object.keys(values)) {
    if (!schema.resourceFields[name]?.create)
      throw new StackComposeValidationError('composeValidation.fieldChanged', name);
  }
  return preparePayload(schema, values);
}
