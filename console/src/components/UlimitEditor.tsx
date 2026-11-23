import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/provider';
import { normalizeUlimits, ulimitNames } from '../workload-ulimits';
import { Alert, Button, Field } from './ui';

export function UlimitEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const rows = value == null ? [] : value;
  const editable =
    Array.isArray(rows) &&
    rows.length <= 32 &&
    rows.every(
      (row) =>
        row &&
        typeof row === 'object' &&
        !Array.isArray(row) &&
        Object.keys(row).every((key) => ['name', 'soft', 'hard'].includes(key)) &&
        [row.name, row.soft, row.hard].every(
          (field) => field == null || typeof field === 'string' || typeof field === 'number',
        ),
    );
  let error = '';
  if (value != null) {
    try {
      normalizeUlimits(value);
    } catch (caught) {
      error = (caught as Error).message;
    }
  }
  return (
    <section aria-label={t('resourceLimits.process.title')}>
      <p className="muted">{t('resourceLimits.process.description')}</p>
      {error && <Alert>{error}</Alert>}
      {!editable ? (
        <Alert>{t('resourceLimits.process.legacy')}</Alert>
      ) : (
        <>
          {rows.map((row: Record<string, unknown>, index: number) => {
            const update = (key: string, next: string) =>
              onChange(
                rows.map((entry, position) =>
                  position === index ? { ...entry, [key]: next } : entry,
                ),
              );
            return (
              <fieldset className="nested-fields" key={index}>
                <legend>{t('resourceLimits.process.row', { index: index + 1 })}</legend>
                <Field label={t('resourceLimits.process.resource', { index: index + 1 })}>
                  {(id, description) => (
                    <select
                      id={id}
                      aria-describedby={description}
                      value={String(row.name ?? '')}
                      required
                      onChange={(event) => update('name', event.target.value)}
                    >
                      <option value="">{t('resourceLimits.process.select')}</option>
                      {!!row.name &&
                        !ulimitNames.includes(row.name as (typeof ulimitNames)[number]) && (
                          <option value={String(row.name)}>
                            {t('resourceLimits.process.unrecognized', { name: String(row.name) })}
                          </option>
                        )}
                      {ulimitNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                {(['soft', 'hard'] as const).map((key) => (
                  <Field
                    key={key}
                    label={t(
                      key === 'soft'
                        ? 'resourceLimits.process.soft'
                        : 'resourceLimits.process.hard',
                      { index: index + 1 },
                    )}
                    hint={t('resourceLimits.process.integerHint')}
                  >
                    {(id, description) => (
                      <input
                        id={id}
                        aria-describedby={description}
                        required
                        type="text"
                        inputMode="text"
                        pattern="(-1|0|[1-9][0-9]*)"
                        value={String(row[key] ?? '')}
                        onChange={(event) => update(key, event.target.value)}
                      />
                    )}
                  </Field>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t('resourceLimits.process.removeRow', { index: index + 1 })}
                  onClick={() => onChange(rows.filter((_, position) => position !== index))}
                >
                  <Trash2 size={15} /> {t('resourceLimits.process.remove')}
                </Button>
              </fieldset>
            );
          })}
          <Button
            type="button"
            disabled={rows.length >= 32}
            onClick={() => onChange([...rows, { name: '', soft: '', hard: '' }])}
          >
            <Plus size={15} />
            {t('resourceLimits.process.add')}
          </Button>
        </>
      )}
    </section>
  );
}
