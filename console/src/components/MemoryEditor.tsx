import { useState } from 'react';
import { useI18n } from '../i18n/provider';
import { memoryBytes, memoryUnits } from '../workload-resources';
import { Field } from './ui';
export function MemoryEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const [unit, setUnit] = useState<keyof typeof memoryUnits>('Bytes');
  const [text, setText] = useState(String(value ?? ''));
  const [error, setError] = useState('');
  return (
    <fieldset className="nested-fields">
      <legend>{label}</legend>
      <Field
        label={t('resourceLimits.memory.value', { label })}
        error={error}
        hint={t('resourceLimits.memory.hint')}
      >
        {(id, description) => (
          <input
            id={id}
            aria-describedby={description}
            inputMode="decimal"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              try {
                const bytes = memoryBytes(e.target.value, unit);
                setError('');
                e.target.setCustomValidity('');
                onChange(bytes);
              } catch (error) {
                const message = (error as Error).message;
                setError(message);
                e.target.setCustomValidity(message);
                onChange(e.target.value);
              }
            }}
          />
        )}
      </Field>
      <Field label={t('resourceLimits.memory.unit', { label })}>
        {(id) => (
          <select
            id={id}
            value={unit}
            disabled={!!error}
            onChange={(e) => {
              const next = e.target.value as keyof typeof memoryUnits;
              setUnit(next);
              setText(value == null ? '' : String(Number(value) / memoryUnits[next]));
            }}
          >
            {Object.keys(memoryUnits).map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        )}
      </Field>
    </fieldset>
  );
}
