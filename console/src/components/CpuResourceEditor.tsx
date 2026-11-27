import { useEffect, useRef, useState } from 'react';
import {
  cpuValidationMessage,
  parseCpuResource,
  CpuValidationError,
  type CpuErrorCode,
  type CpuField,
} from '../cpu-resources';
import { useI18n } from '../i18n/provider';
import { Field } from './ui';

export function CpuResourceEditor({
  name,
  value,
  onChange,
}: {
  name: CpuField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t, locale } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(String(value ?? ''));
  const [errorCode, setError] = useState<CpuErrorCode | null>(null);
  const label = t(`workloadControls.${name}.label`);
  const hint = t(`workloadControls.${name}.hint`);
  const error = errorCode
    ? cpuValidationMessage({ code: errorCode, issue: { field: name } }, t, locale)
    : '';
  useEffect(() => {
    input.current?.setCustomValidity(error);
  }, [error]);
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, description) => (
        <input
          ref={input}
          id={id}
          aria-describedby={description}
          aria-invalid={!!error}
          inputMode={name === 'cpuSet' ? 'text' : name === 'cpuQuota' ? 'text' : 'numeric'}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            try {
              const next = parseCpuResource(name, event.target.value);
              event.target.setCustomValidity('');
              setError(null);
              onChange(next);
            } catch (error) {
              setError(error instanceof CpuValidationError ? error.code : 'cpuReview');
              onChange(event.target.value);
            }
          }}
        />
      )}
    </Field>
  );
}
