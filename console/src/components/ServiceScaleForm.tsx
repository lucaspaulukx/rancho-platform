import { useI18n } from '../i18n/provider';
import { useState, type FormEvent } from 'react';
import type { Resource, Schema } from '../api';
import { prepareServiceScale, ServiceScaleValidationError } from '../service-scaling';
import { Alert, Field } from './ui';

export function ServiceScaleForm({
  resource,
  schema,
  onSubmit,
  onDirtyChange,
  busy,
  error,
}: {
  resource: Resource;
  schema: Schema;
  onSubmit: (payload: Record<string, unknown>) => void;
  onDirtyChange: (dirty: boolean) => void;
  busy: boolean;
  error: Error | null;
}) {
  const { t, formats } = useI18n();
  const errorText = (error: Error) =>
    error instanceof ServiceScaleValidationError ? t(error.key) : error.message;
  const [value, setValue] = useState(String(resource.scale));
  const [zero, setZero] = useState(false);
  const [validation, setValidation] = useState<Error | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    try {
      const payload = prepareServiceScale(resource, resource, schema, value);
      if (payload.scale === 0 && !zero)
        throw new ServiceScaleValidationError('serviceEditors.confirmZero');
      setValidation(null);
      onSubmit(payload);
    } catch (caught) {
      setValidation(
        caught instanceof Error
          ? caught
          : new ServiceScaleValidationError('serviceEditors.reviewScale'),
      );
    }
  }
  return (
    <form id="workspace-resource-form" onSubmit={submit}>
      <fieldset className="form-fieldset" disabled={busy}>
        <p>
          {t('serviceEditors.currentScale', {
            scale:
              typeof resource.scale === 'number'
                ? formats.number(resource.scale)
                : String(resource.scale),
          })}
        </p>
        <Field label={t('serviceEditors.quantity')}>
          {(id) => (
            <input
              id={id}
              type="number"
              min={Math.max(0, schema.resourceFields.scale.min ?? 0)}
              max={schema.resourceFields.scale.max}
              step={1}
              required
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setZero(false);
                setValidation(null);
                onDirtyChange(event.target.value !== String(resource.scale));
              }}
            />
          )}
        </Field>
        <Alert tone={Number(value) === 0 ? 'warning' : 'info'}>
          {t('serviceEditors.scaleInfo')}
        </Alert>
        {value.trim() !== '' && Number(value) === 0 && (
          <label className="workload-system">
            <input
              type="checkbox"
              checked={zero}
              onChange={(event) => {
                setZero(event.target.checked);
                setValidation(null);
              }}
            />
            {t('serviceEditors.acknowledgeZero')}
          </label>
        )}
        <p className="muted">{t('serviceEditors.templateHint')}</p>
        {(validation || error) && (
          <Alert tone="danger">
            {validation ? errorText(validation) : error ? errorText(error) : ''}
          </Alert>
        )}
      </fieldset>
    </form>
  );
}
