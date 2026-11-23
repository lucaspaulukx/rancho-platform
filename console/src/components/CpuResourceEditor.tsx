import { useState } from 'react';
import { cpuFields, parseCpuResource, type CpuField } from '../cpu-resources';
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
  const [text, setText] = useState(String(value ?? ''));
  const [error, setError] = useState('');
  const definition = cpuFields[name];
  return (
    <Field label={definition.label} hint={definition.hint} error={error}>
      {(id, description) => (
        <input
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
              setError('');
              onChange(next);
            } catch (error) {
              const message = (error as Error).message;
              event.target.setCustomValidity(message);
              setError(message);
              onChange(event.target.value);
            }
          }}
        />
      )}
    </Field>
  );
}
