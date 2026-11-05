import { safeApiUrl, type Resource } from './api';
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
export function catalogPath(url: string) {
  const path = safeApiUrl(url);
  if (!path.startsWith('/v1-catalog/')) throw new Error('O catálogo retornou uma rota inválida.');
  return path;
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
    throw new Error('As perguntas do template são inválidas.');
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
      throw new Error('O template possui variáveis inválidas ou duplicadas.');
    variables.add(question.variable);
    if (!supported.has(question.type))
      throw new Error(
        `O campo ${question.label || question.variable} usa um tipo ainda não suportado: ${question.type}.`,
      );
    if (
      question.type === 'enum' &&
      (!Array.isArray(question.options) ||
        question.options.some((value) => typeof value !== 'string'))
    )
      throw new Error('O template possui uma lista de opções inválida.');
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
  if (!name.trim()) throw new Error('Informe um nome para a stack.');
  if (version.templateId !== template.id)
    throw new Error('A versão selecionada pertence a outro template.');
  if (!version.id || !version.files || typeof version.files !== 'object')
    throw new Error('A versão não disponibilizou os arquivos de configuração.');
  const dockerCompose =
    version.files['docker-compose.yml.tpl'] || version.files['docker-compose.yml'];
  const rancherCompose =
    version.files['rancher-compose.yml.tpl'] || version.files['rancher-compose.yml'];
  if (typeof dockerCompose !== 'string' || !dockerCompose.trim())
    throw new Error('Esta versão não possui um Docker Compose utilizável.');
  const environment = Object.fromEntries(
    catalogQuestions(version).flatMap((question) => {
      const raw = answers[question.variable];
      const label = question.label || question.variable;
      if (raw === '' || raw === null || raw === undefined) {
        if (question.required && question.type !== 'boolean') throw new Error(`Preencha ${label}.`);
        return question.type === 'boolean' ? [[question.variable, false]] : [];
      }
      let value: unknown = raw;
      if (question.type === 'boolean') {
        if (typeof raw !== 'boolean') throw new Error(`Escolha um valor válido para ${label}.`);
      } else if (['int', 'float'].includes(question.type)) {
        const number = Number(raw);
        if (
          (typeof raw !== 'string' && typeof raw !== 'number') ||
          !String(raw).trim() ||
          !Number.isFinite(number) ||
          (question.type === 'int' && !Number.isSafeInteger(number))
        )
          throw new Error(`Informe um número válido para ${label}.`);
        // The catalog API uses 0/0 for unspecified numeric limits.
        if (
          (question.min && number < question.min) ||
          (question.max && number > question.max) ||
          (question.max && question.min === 0 && number < 0)
        )
          throw new Error(`${label} está fora dos limites permitidos.`);
        value = number;
      } else {
        if (typeof raw !== 'string') throw new Error(`Revise ${label}.`);
        if (question.type === 'enum' && !question.options?.includes(raw))
          throw new Error(`Escolha uma opção válida em ${label}.`);
        if (
          ['service', 'certificate', 'secret'].includes(question.type) &&
          !references[question.type]?.some((choice) => choice.value === raw)
        )
          throw new Error(`Selecione um recurso disponível em ${label}.`);
        if (
          question.type === 'date' &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
            !Number.isFinite(Date.parse(raw)) ||
            new Date(raw).toISOString().slice(0, 10) !== raw)
        )
          throw new Error(`Informe uma data válida em ${label}.`);
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
