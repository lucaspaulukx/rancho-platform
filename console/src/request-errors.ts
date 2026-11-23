import { ptRequestErrors } from './i18n/domains/request-errors';
import type { createTranslator } from './i18n/messages';

export class ConsoleRequestError extends Error {
  constructor(readonly key: keyof typeof ptRequestErrors) {
    super(ptRequestErrors[key]);
  }
}

export function requestErrorText(error: Error, t: ReturnType<typeof createTranslator>['t']) {
  return error instanceof ConsoleRequestError ? t(error.key) : error.message;
}
