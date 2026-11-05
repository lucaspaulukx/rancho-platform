import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
      <p className="muted">
        Escolha somente as capabilities necessárias. ALL representa todas as opções; a configuração
        será aplicada pelo Docker.
      </p>
      {rows.map((row, index) => (
        <div key={row.id}>
          {!options.includes(row.value) && row.value && (
            <Alert>Valor fora do contrato atual: {row.value}. Revise antes de criar.</Alert>
          )}
          <Field label={`${label}: capability ${index + 1}`}>
            {(id) => (
              <select
                id={id}
                value={row.value}
                required
                onChange={(e) =>
                  update(rows.map((v) => (v.id === row.id ? { ...v, value: e.target.value } : v)))
                }
              >
                <option value="">Selecionar…</option>
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
            aria-label={`Remover ${label} ${index + 1}`}
            onClick={() => update(rows.filter((v) => v.id !== row.id))}
          >
            <Trash2 size={15} /> Remover capability
          </Button>
        </div>
      ))}
      <Button
        type="button"
        disabled={rows.length >= options.length}
        onClick={() => update([...rows, { id: crypto.randomUUID(), value: '' }])}
      >
        <Plus size={15} /> Adicionar {label.toLocaleLowerCase()}
      </Button>
    </fieldset>
  );
}
