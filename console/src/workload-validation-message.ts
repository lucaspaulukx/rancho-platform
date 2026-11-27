import { cpuValidationMessage, CpuValidationError } from './cpu-resources';
import type { Locale } from './i18n/locales';
import { requestErrorText } from './request-errors';
import type { createTranslator } from './i18n/messages';
import { BindingValidationError } from './workload-bindings';
import { HealthCheckValidationError } from './workload-healthchecks';
import { WorkloadPolicyValidationError } from './workload-scheduling';
import { SidecarValidationError } from './workload-sidecars';

export function workloadValidationMessage(
  error: Error | null | undefined,
  t: ReturnType<typeof createTranslator>['t'],
  locale: Locale,
) {
  if (error instanceof CpuValidationError) return cpuValidationMessage(error, t, locale);
  if (error instanceof SidecarValidationError) return error.format(t);
  if (error instanceof WorkloadPolicyValidationError || error instanceof BindingValidationError)
    return t(error.key);
  if (error instanceof HealthCheckValidationError) {
    const detail = error.detail;
    if (detail.key === 'healthCheckValidation.field') return t(detail.key, { name: detail.name });
    if (detail.key === 'healthCheckValidation.integer')
      return t(detail.key, { label: t(detail.labelKey), min: detail.min, max: detail.max });
    return t(detail.key);
  }
  return error ? requestErrorText(error, t) : undefined;
}
