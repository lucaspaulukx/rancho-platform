import { safeApiUrl, type Resource } from './api';
import { ptCatalogPage } from './i18n/domains/catalog-page';
import type { createTranslator } from './i18n/messages';

type CatalogValidationKey = Extract<keyof typeof ptCatalogPage, `catalogPage.validation.${string}`>;
type CatalogQuestionKey =
  | 'catalogPage.validation.required'
  | 'catalogPage.validation.boolean'
  | 'catalogPage.validation.number'
  | 'catalogPage.validation.range'
  | 'catalogPage.validation.string'
  | 'catalogPage.validation.enum'
  | 'catalogPage.validation.reference'
  | 'catalogPage.validation.date';
type CatalogQuestionTypeKey = 'catalogPage.validation.type';
type CatalogValidationDetail =
  | { key: Exclude<CatalogValidationKey, CatalogQuestionKey | CatalogQuestionTypeKey> }
  | { key: CatalogQuestionKey; label: string }
  | { key: CatalogQuestionTypeKey; label: string; type: string };
type Translate = ReturnType<typeof createTranslator>['t'];

export class CatalogValidationError extends Error {
  constructor(readonly detail: CatalogValidationDetail) {
    const message = ptCatalogPage[detail.key];
    super(
      message.replace(/\{(label|type)\}/g, (placeholder, key) => {
        if (key === 'label' && 'label' in detail) return detail.label;
        if (key === 'type' && detail.key === 'catalogPage.validation.type') return detail.type;
        return placeholder;
      }),
    );
  }

  format(t: Translate) {
    const { detail } = this;
    if (detail.key === 'catalogPage.validation.type')
      return t(detail.key, { label: detail.label, type: detail.type });
    if ('label' in detail) return t(detail.key, { label: detail.label });
    return t(detail.key);
  }
}

export function localizedCatalogError<T extends Error | null | undefined>(error: T, t: Translate) {
  return error instanceof CatalogValidationError ? new Error(error.format(t)) : error;
}
export interface CatalogTemplate extends Resource {
  catalogId?: string;
  templateBase?: string;
  categories?: string[];
  category?: string;
  defaultVersion?: string;
  versionLinks?: Record<string, string>;
}
export interface CatalogQuestion {
  variable: string;
  label?: string;
  description?: string;
  type: string;
  required?: boolean;
  default?: string | number | boolean | null;
  options?: string[];
  min?: number;
  max?: number;
}
export interface CatalogVersion extends Resource {
  templateId: string;
  version: string;
  files: Record<string, string>;
  questions?: CatalogQuestion[];
}
export interface CatalogChoice {
  value: string;
  label: string;
}
export type CatalogReferences = Record<string, CatalogChoice[]>;
const supported = new Set([
  'boolean',
  'certificate',
  'date',
  'enum',
  'float',
  'int',
  'multiline',
  'password',
  'service',
  'string',
  'masked',
  'secret',
]);
export function catalogPath(url: string | undefined) {
  try {
    const path = safeApiUrl(url ?? '');
    if (path.startsWith('/v1-catalog/')) return path;
  } catch {
    // Report the invalid route without including the URL.
  }
  throw new CatalogValidationError({ key: 'catalogPage.validation.route' });
}
export function categories(template: CatalogTemplate) {
  return Array.isArray(template.categories)
    ? template.categories.filter((value) => typeof value === 'string')
    : template.category
      ? [template.category]
      : [];
}
export function catalogQuestions(version: CatalogVersion) {
  if (version.questions !== undefined && !Array.isArray(version.questions))
    throw new CatalogValidationError({ key: 'catalogPage.validation.questions' });
  const questions = version.questions || [];
  const variables = new Set<string>();
  for (const question of questions) {
    if (
      !question ||
      typeof question.variable !== 'string' ||
      !/^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/.test(question.variable) ||
      ['__proto__', 'constructor', 'prototype'].includes(question.variable) ||
      variables.has(question.variable)
    )
      throw new CatalogValidationError({ key: 'catalogPage.validation.variables' });
    variables.add(question.variable);
    if (!supported.has(question.type))
      throw new CatalogValidationError({
        key: 'catalogPage.validation.type',
        label: String(question.label || question.variable),
        type: String(question.type),
      });
    if (
      question.type === 'enum' &&
      (!Array.isArray(question.options) ||
        question.options.some((value) => typeof value !== 'string'))
    )
      throw new CatalogValidationError({ key: 'catalogPage.validation.options' });
  }
  return questions;
}
export function catalogDefaults(questions: CatalogQuestion[], references: CatalogReferences) {
  return Object.fromEntries(
    questions.map((question) => {
      let value: unknown =
        question.type === 'boolean'
          ? question.default === true || question.default === 'true'
          : (question.default ?? '');
      const choices = references[question.type];
      if (choices) {
        const matches = choices.filter(
          (choice) =>
            choice.value === value ||
            (question.type === 'service' && choice.value.split('/').pop() === value),
        );
        value = matches.length === 1 ? matches[0].value : '';
      }
      return [question.variable, value];
    }),
  );
}
export function prepareCatalogStack(
  template: CatalogTemplate,
  version: CatalogVersion,
  name: string,
  description: string,
  answers: Record<string, unknown>,
  startOnCreate: boolean,
  references: CatalogReferences = {},
) {
  if (!name.trim()) throw new CatalogValidationError({ key: 'catalogPage.validation.stackName' });
  if (version.templateId !== template.id)
    throw new CatalogValidationError({ key: 'catalogPage.validation.otherTemplate' });
  if (!version.id || !version.files || typeof version.files !== 'object')
    throw new CatalogValidationError({ key: 'catalogPage.validation.missingFiles' });
  const dockerCompose =
    version.files['docker-compose.yml.tpl'] || version.files['docker-compose.yml'];
  const rancherCompose =
    version.files['rancher-compose.yml.tpl'] || version.files['rancher-compose.yml'];
  if (typeof dockerCompose !== 'string' || !dockerCompose.trim())
    throw new CatalogValidationError({ key: 'catalogPage.validation.dockerCompose' });
  const environment = Object.fromEntries(
    catalogQuestions(version).flatMap((question) => {
      const raw = answers[question.variable];
      const label = String(question.label || question.variable);
      if (raw === '' || raw === null || raw === undefined) {
        if (question.required && question.type !== 'boolean')
          throw new CatalogValidationError({ key: 'catalogPage.validation.required', label });
        return question.type === 'boolean' ? [[question.variable, false]] : [];
      }
      let value: unknown = raw;
      if (question.type === 'boolean') {
        if (typeof raw !== 'boolean')
          throw new CatalogValidationError({ key: 'catalogPage.validation.boolean', label });
      } else if (['int', 'float'].includes(question.type)) {
        const number = Number(raw);
        if (
          (typeof raw !== 'string' && typeof raw !== 'number') ||
          !String(raw).trim() ||
          !Number.isFinite(number) ||
          (question.type === 'int' && !Number.isSafeInteger(number))
        )
          throw new CatalogValidationError({ key: 'catalogPage.validation.number', label });
        // The catalog API uses 0/0 for unspecified numeric limits.
        if (
          (question.min && number < question.min) ||
          (question.max && number > question.max) ||
          (question.max && question.min === 0 && number < 0)
        )
          throw new CatalogValidationError({ key: 'catalogPage.validation.range', label });
        value = number;
      } else {
        if (typeof raw !== 'string')
          throw new CatalogValidationError({ key: 'catalogPage.validation.string', label });
        if (question.type === 'enum' && !question.options?.includes(raw))
          throw new CatalogValidationError({ key: 'catalogPage.validation.enum', label });
        if (
          ['service', 'certificate', 'secret'].includes(question.type) &&
          !references[question.type]?.some((choice) => choice.value === raw)
        )
          throw new CatalogValidationError({ key: 'catalogPage.validation.reference', label });
        if (
          question.type === 'date' &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
            !Number.isFinite(Date.parse(raw)) ||
            new Date(raw).toISOString().slice(0, 10) !== raw)
        )
          throw new CatalogValidationError({ key: 'catalogPage.validation.date', label });
      }
      return [[question.variable, value]];
    }),
  );
  return {
    name: name.trim(),
    description: description.trim(),
    environment,
    externalId: `catalog://${version.id}`,
    dockerCompose,
    ...(typeof rancherCompose === 'string' ? { rancherCompose } : {}),
    startOnCreate,
    system: template.templateBase === 'infra',
  };
}
