import { ptRequestErrors } from './i18n/domains/request-errors';
import type { createTranslator } from './i18n/messages';

export class ConsoleRequestError extends Error {
  constructor(readonly key: keyof typeof ptRequestErrors) {
    super(ptRequestErrors[key]);
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    readonly detail?: string,
  ) {
    super(detail ?? ptRequestErrors['requestError.failed']);
  }
}

export function requestErrorText(error: Error, t: ReturnType<typeof createTranslator>['t']) {
  if (error instanceof ConsoleRequestError) return t(error.key);
  if (error instanceof ApiError && error.detail === undefined) return t('requestError.failed');
  return error.message;
}
