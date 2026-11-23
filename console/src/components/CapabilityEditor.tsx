import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/provider';
import { Alert, Button, Field } from './ui';
export function CapabilityEditor({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: unknown;
  options: string[];
  onChange: (value: string[]) => void;
}) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState(() =>
    Array.isArray(value) ? value.map((v) => ({ id: crypto.randomUUID(), value: String(v) })) : [],
  );
  function update(next: typeof rows) {
    setRows(next);
    onChange(next.map((v) => v.value));
  }
  return (
    <fieldset className="nested-fields">
      <legend>{label}</legend>
      <p className="muted">{t('workloadControls.capabilityHint')}</p>
      {rows.map((row, index) => (
        <div key={row.id}>
          {!options.includes(row.value) && row.value && (
            <Alert>{t('workloadControls.unknownCapability', { value: row.value })}</Alert>
          )}
          <Field label={t('workloadControls.capabilityLabel', { label, index: index + 1 })}>
            {(id) => (
              <select
                id={id}
                value={row.value}
                required
                onChange={(e) =>
                  update(rows.map((v) => (v.id === row.id ? { ...v, value: e.target.value } : v)))
                }
              >
                <option value="">Selecionarâ€¦</option>
                {row.value && !options.includes(row.value) && <option>{row.value}</option>}
                {options.map((v) => (
                  <option key={v} disabled={v !== row.value && rows.some((r) => r.value === v)}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Button
            type="button"
            variant="ghost"
            aria-label={t('workloadControls.removeLabel', { label, index: index + 1 })}
            onClick={() => update(rows.filter((v) => v.id !== row.id))}
          >
            <Trash2 size={15} /> {t('workloadControls.removeCapability')}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        disabled={rows.length >= options.length}
        onClick={() => update([...rows, { id: crypto.randomUUID(), value: '' }])}
      >
        <Plus size={15} />{' '}
        {t('workloadControls.addLabel', { label: label.toLocaleLowerCase(locale) })}
      </Button>
    </fieldset>
  );
}
