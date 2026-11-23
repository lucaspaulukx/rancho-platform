import { Plus, Trash2 } from 'lucide-react';
import type { SelectorRow } from '../webhooks';
import { useI18n } from '../i18n/provider';
import { Button, Field } from './ui';
export function SelectorRows({
  rows,
  onChange,
  label,
}: {
  rows: SelectorRow[];
  onChange: (rows: SelectorRow[]) => void;
  label?: string;
}) {
  const { t, formats } = useI18n();
  return (
    <fieldset className="nested-fields">
      <legend>{label ?? t('selectorRows.target')}</legend>
      <p className="muted">{t('selectorRows.guidance')}</p>
      {rows.map((row, index) => (
        <section className="compose-editor" key={row.id}>
          <div className="form-grid">
            <Field label={t('selectorRows.key', { index: formats.number(index + 1) })}>
              {(id) => (
                <input
                  id={id}
                  value={row.key}
                  onChange={(e) =>
                    onChange(rows.map((v) => (v.id === row.id ? { ...v, key: e.target.value } : v)))
                  }
                />
              )}
            </Field>
            <Field label={t('selectorRows.value', { index: formats.number(index + 1) })}>
              {(id) => (
                <input
                  id={id}
                  value={row.value}
                  onChange={(e) =>
                    onChange(
                      rows.map((v) => (v.id === row.id ? { ...v, value: e.target.value } : v)),
                    )
                  }
                />
              )}
            </Field>
          </div>
          <Button
            type="button"
            aria-label={t('selectorRows.removeRow', { index: formats.number(index + 1) })}
            onClick={() => onChange(rows.filter((v) => v.id !== row.id))}
          >
            <Trash2 size={16} />
            {t('selectorRows.remove')}
          </Button>
        </section>
      ))}
      <Button
        type="button"
        disabled={rows.length >= 64}
        onClick={() => onChange([...rows, { id: crypto.randomUUID(), key: '', value: '' }])}
      >
        <Plus size={16} />
        {t('selectorRows.add')}
      </Button>
    </fieldset>
  );
}
