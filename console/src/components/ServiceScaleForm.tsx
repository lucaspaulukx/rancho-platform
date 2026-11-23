import { useState, type FormEvent } from 'react';
import type { Resource, Schema } from '../api';
import { prepareServiceScale } from '../service-scaling';
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
  const [value, setValue] = useState(String(resource.scale));
  const [zero, setZero] = useState(false);
  const [validation, setValidation] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    try {
      const payload = prepareServiceScale(resource, resource, schema, value);
      if (payload.scale === 0 && !zero)
        throw new Error('Confirme o encerramento dos containers antes de aplicar escala zero.');
      setValidation('');
      onSubmit(payload);
    } catch (caught) {
      setValidation(caught instanceof Error ? caught.message : 'Revise a escala.');
    }
  }
  return (
    <form id="workspace-resource-form" onSubmit={submit}>
      <fieldset className="form-fieldset" disabled={busy}>
        <p>
          Escala configurada atualmente: <strong>{String(resource.scale)}</strong>.
        </p>
        <Field label="Quantidade desejada de containers">
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
                setValidation('');
                onDirtyChange(event.target.value !== String(resource.scale));
              }}
            />
          )}
        </Field>
        <Alert tone={Number(value) === 0 ? 'warning' : 'info'}>
          O Rancher ajustará a escala efetiva do serviço. Reduzir a quantidade pode encerrar
          containers; aumentar depende da capacidade disponível. A contagem de containers em
          execução pode levar um tempo para acompanhar a escala configurada.
        </Alert>
        {value.trim() !== '' && Number(value) === 0 && (
          <label className="workload-system">
            <input
              type="checkbox"
              checked={zero}
              onChange={(event) => {
                setZero(event.target.checked);
                setValidation('');
              }}
            />
            Entendo que escala zero encerra os containers deste serviço
          </label>
        )}
        <p className="muted">Esta operação não altera as respostas de um template do catálogo.</p>
        {(validation || error) && <Alert tone="danger">{validation || error?.message}</Alert>}
      </fieldset>
    </form>
  );
}
