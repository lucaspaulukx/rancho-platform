import { ptResourceValidation } from './i18n/domains/resource-validation';
export class ResourceValidationError extends Error {
  constructor(public readonly key: keyof typeof ptResourceValidation) {
    super(ptResourceValidation[key]);
    this.name = 'ResourceValidationError';
  }
}
