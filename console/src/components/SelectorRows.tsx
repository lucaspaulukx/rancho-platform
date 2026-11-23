import { Plus, Trash2 } from 'lucide-react';
import type { SelectorRow } from '../webhooks';
import { Button, Field } from './ui';
export function SelectorRows({
  rows,
  onChange,
  label = 'Labels do alvo',
}: {
  rows: SelectorRow[];
  onChange: (rows: SelectorRow[]) => void;
  label?: string;
}) {
  return (
    <fieldset className="nested-fields">
      <legend>{label}</legend>
      <p className="muted">
        Todas as labels informadas devem corresponder ao alvo. Não deixe o seletor vazio.
      </p>
      {rows.map((row, index) => (
        <section className="compose-editor" key={row.id}>
          <div className="form-grid">
            <Field label={`Label ${index + 1}: chave`}>
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
            <Field label={`Label ${index + 1}: valor`}>
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
            aria-label={`Remover label ${index + 1}`}
            onClick={() => onChange(rows.filter((v) => v.id !== row.id))}
          >
            <Trash2 size={16} />
            Remover
          </Button>
        </section>
      ))}
      <Button
        type="button"
        disabled={rows.length >= 64}
        onClick={() => onChange([...rows, { id: crypto.randomUUID(), key: '', value: '' }])}
      >
        <Plus size={16} />
        Adicionar label
      </Button>
    </fieldset>
  );
}
