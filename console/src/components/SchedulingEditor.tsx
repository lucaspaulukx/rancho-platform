import { useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  decodeScheduling,
  encodeScheduling,
  globalLabel,
  schedulingKinds,
  schedulingModes,
  type SchedulingRule,
} from '../workload-scheduling';
import { Alert, Button, Field } from './ui';

export function SchedulingEditor({
  value,
  onChange,
  renderLabels,
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  renderLabels: (
    value: Record<string, string>,
    onChange: (value: Record<string, string>) => void,
  ) => ReactNode;
}) {
  const [initial] = useState(() => {
    try {
      return { ...decodeScheduling(value), error: '' };
    } catch {
      return {
        rules: [] as SchedulingRule[],
        other: value,
        error:
          'Há regras legadas que este editor não consegue interpretar. Edite as labels nativas ou desative o editor estruturado; nada foi convertido.',
      };
    }
  });
  const [rules, setRules] = useState(initial.rules),
    [other, setOther] = useState(initial.other);
  function update(next: SchedulingRule[], labels = other) {
    setRules(next);
    setOther(labels);
    onChange(encodeScheduling(next, labels, false));
  }
  const global = other[globalLabel] === 'true';
  return (
    <section aria-label="Afinidades de agendamento">
      <p className="muted">
        Combine regras para posicionar o workload. Preferências podem não ser atendidas; regras
        obrigatórias podem impedir o agendamento.
      </p>
      {global && (
        <Alert tone="info">
          Serviço global: use somente labels de host com regras obrigatórias ou de negação. A escala
          global é preservada.
        </Alert>
      )}
      {initial.error ? (
        <>
          <Alert>{initial.error}</Alert>
          {renderLabels(other, (labels) => update([], labels))}
        </>
      ) : (
        <>
          {rules.map((rule, index) => {
            function patch(patch: Partial<SchedulingRule>) {
              update(rules.map((v) => (v.id === rule.id ? { ...v, ...patch } : v)));
            }
            return (
              <fieldset className="nested-fields" key={rule.id}>
                <legend>Afinidade {index + 1}</legend>
                <Field label="Alvo da afinidade">
                  {(id) => (
                    <select
                      id={id}
                      value={rule.kind}
                      onChange={(e) => patch({ kind: e.target.value as SchedulingRule['kind'] })}
                    >
                      {Object.entries(schedulingKinds).map(([key, label]) => (
                        <option key={key} value={key} disabled={global && key !== 'host_label'}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Condição da afinidade">
                  {(id) => (
                    <select
                      id={id}
                      value={rule.mode}
                      onChange={(e) => patch({ mode: e.target.value as SchedulingRule['mode'] })}
                    >
                      {Object.entries(schedulingModes).map(([key, label]) => (
                        <option key={key} value={key} disabled={global && key.includes('_soft')}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                {rule.kind !== 'container' && (
                  <Field
                    label="Chave da label"
                    hint={
                      rule.kind === 'container_label'
                        ? 'Para um serviço: io.rancher.stack_service.name; valor: stack/serviço.'
                        : undefined
                    }
                  >
                    {(id) => (
                      <input
                        id={id}
                        value={rule.key}
                        onChange={(e) => patch({ key: e.target.value })}
                        autoComplete="off"
                      />
                    )}
                  </Field>
                )}
                <Field
                  label={
                    rule.kind === 'container' ? 'Nome do container de referência' : 'Valor da label'
                  }
                >
                  {(id) => (
                    <input
                      id={id}
                      value={rule.value}
                      onChange={(e) => patch({ value: e.target.value })}
                      autoComplete="off"
                    />
                  )}
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Remover afinidade ${index + 1}`}
                  onClick={() => update(rules.filter((v) => v.id !== rule.id))}
                >
                  <Trash2 size={15} /> Remover regra
                </Button>
              </fieldset>
            );
          })}
          <Button
            type="button"
            disabled={rules.length >= 100}
            onClick={() =>
              update([
                ...rules,
                { id: crypto.randomUUID(), kind: 'host_label', mode: '', key: '', value: '' },
              ])
            }
          >
            <Plus size={15} /> Adicionar afinidade
          </Button>
          <details className="advanced-fields">
            <summary>Outras labels e regras nativas</summary>
            <div>{renderLabels(other, (labels) => update(rules, labels))}</div>
          </details>
        </>
      )}
    </section>
  );
}
