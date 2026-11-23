import { Plus, Trash2 } from 'lucide-react';
import { normalizeUlimits, ulimitNames } from '../workload-ulimits';
import { Alert, Button, Field } from './ui';

export function UlimitEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
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
    <section aria-label="Limites de processo">
      <p className="muted">
        Sem linhas, os limites são herdados do Docker. As unidades dependem do recurso; -1 significa
        ilimitado. Alterações valem para novos containers.
      </p>
      {error && <Alert>{error}</Alert>}
      {!editable ? (
        <Alert>
          Formato legado incompatível. Reabra com o editor nativo para preservar a configuração.
        </Alert>
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
                <legend>Limite {index + 1}</legend>
                <Field label={`Recurso do limite ${index + 1}`}>
                  {(id, description) => (
                    <select
                      id={id}
                      aria-describedby={description}
                      value={String(row.name ?? '')}
                      required
                      onChange={(event) => update('name', event.target.value)}
                    >
                      <option value="">Selecionar…</option>
                      {!!row.name &&
                        !ulimitNames.includes(row.name as (typeof ulimitNames)[number]) && (
                          <option value={String(row.name)}>
                            Não reconhecido: {String(row.name)}
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
                    label={`${key === 'soft' ? 'Limite inicial' : 'Limite máximo'} ${index + 1}`}
                    hint="Inteiro de -1 a 2147483647."
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
                  aria-label={`Remover limite ${index + 1}`}
                  onClick={() => onChange(rows.filter((_, position) => position !== index))}
                >
                  <Trash2 size={15} /> Remover
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
            Adicionar limite de processo
          </Button>
        </>
      )}
    </section>
  );
}
