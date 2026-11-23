import type { Resource } from './api';
import {
  catalogDefaults,
  CatalogValidationError,
  prepareCatalogStack,
  type CatalogQuestion,
  type CatalogReferences,
  type CatalogTemplate,
  type CatalogVersion,
} from './catalog';

export function catalogReference(value: unknown) {
  if (typeof value !== 'string' || !/^catalog:\/\/[a-zA-Z0-9_.*:-]+$/.test(value)) return null;
  const versionId = value.slice('catalog://'.length),
    parts = versionId.split(':');
  if (parts.length !== 3 || parts.some((part) => !part || part === '.' || part === '..'))
    return null;
  return { versionId, templateId: parts.slice(0, 2).join(':'), revision: parts[2] };
}
export function catalogUpgradeDefaults(
  questions: CatalogQuestion[],
  references: CatalogReferences,
  stack: Resource,
) {
  const answers = (stack.environment || stack.answers || {}) as Record<string, unknown>;
  return catalogDefaults(
    questions.map((question) => {
      const raw = answers[question.variable];
      if (!['string', 'number', 'boolean'].includes(typeof raw)) return question;
      if (
        question.type === 'boolean' &&
        ![true, false, 'true', 'false'].includes(raw as string | boolean)
      )
        return question;
      return { ...question, default: raw as CatalogQuestion['default'] };
    }),
    references,
  );
}
export function catalogStackSnapshot(stack: Resource) {
  function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, stable(item)]),
      );
    return value;
  }
  return JSON.stringify(
    stable(
      Object.fromEntries(
        ['externalId', 'environment', 'answers', 'dockerCompose', 'rancherCompose'].map((key) => [
          key,
          stack[key] ?? null,
        ]),
      ),
    ),
  );
}
export function prepareCatalogUpgrade(
  stack: Resource,
  template: CatalogTemplate,
  version: CatalogVersion,
  answers: Record<string, unknown>,
  references: CatalogReferences = {},
) {
  const source = catalogReference(stack.externalId);
  if (stack.type !== 'stack' || !source || source.templateId !== template.id)
    throw new CatalogValidationError({ key: 'catalogPage.validation.upgradeOrigin' });
  const creation = prepareCatalogStack(
    template,
    version,
    stack.name || stack.id,
    '',
    answers,
    false,
    references,
  );
  return {
    externalId: creation.externalId,
    environment: creation.environment,
    dockerCompose: creation.dockerCompose,
    ...(creation.rancherCompose !== undefined ? { rancherCompose: creation.rancherCompose } : {}),
  };
}
