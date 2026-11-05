import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  decodeBinding,
  encodeBinding,
  type BindingDraft,
  type BindingKind,
} from '../workload-bindings';
import { Alert, Button, Field } from './ui';
export function WorkloadBindingsEditor({
  kind,
  value,
  onChange,
}: {
  kind: BindingKind;
  value: unknown;
  onChange: (value: string[]) => void;
}) {
  const valid =
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.every((v) => typeof v === 'string'));
  const [rows, setRows] = useState<BindingDraft[]>(() =>
    Array.isArray(value) ? value.map((v, i) => decodeBinding(kind, String(v), i)) : [],
  );
  const [nextId, setNextId] = useState(rows.length);
  function change(next: BindingDraft[]) {
    setRows(next);
    onChange(next.map(encodeBinding));
  }
  function update(key: number, patch: Record<string, string>) {
    change(
      rows.map((v) =>
        v.key === key && v.kind !== 'native'
          ? ({ ...v, ...patch, changed: true } as BindingDraft)
          : v,
      ),
    );
  }
  const title = kind === 'ports' ? 'Portas publicadas' : 'Volumes';
  return (
    <fieldset className="nested-fields">
      <legend>{title}</legend>
      {!valid ? (
        <Alert>
          Formato recebido não suportado. Use o formulário nativo para preservar a configuração.
        </Alert>
      ) : (
        <>
          <p className="muted">
            {kind === 'ports'
              ? 'Defina porta do container e, opcionalmente, porta e IP no host. A publicação será aplicada pelo Rancher.'
              : 'Monte um volume nomeado, caminho do host ou volume anônimo em um destino absoluto do container.'}
          </p>
          {rows.map((row, index) => (
            <section className="compose-editor" key={row.key}>
              <div className="compose-editor-heading">
                <strong>
                  {kind === 'ports' ? 'Porta' : 'Volume'} {index + 1}
                </strong>
                <Button
                  type="button"
                  aria-label={`Remover ${kind === 'ports' ? 'porta' : 'volume'} ${index + 1}`}
                  onClick={() => change(rows.filter((v) => v.key !== row.key))}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              {row.kind === 'native' ? (
                <>
                  <Alert tone="info">
                    Entrada nativa preservada. Edições nas outras linhas não convertem este valor.
                  </Alert>
                  <code className="binding-native">{row.original}</code>
                </>
              ) : row.kind === 'ports' ? (
                <>
                  <div className="form-grid">
                    <Field label={`Porta do container ${index + 1}`}>
                      {(id) => (
                        <input
                          id={id}
                          required
                          inputMode="numeric"
                          value={row.container}
                          onChange={(e) => update(row.key, { container: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field
                      label={`Porta no host ${index + 1}`}
                      hint="Opcional; segue a atribuição nativa do Rancher."
                    >
                      {(id) => (
                        <input
                          id={id}
                          inputMode="numeric"
                          value={row.host}
                          onChange={(e) => update(row.key, { host: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={`Protocolo da porta ${index + 1}`}>
                      {(id) => (
                        <select
                          id={id}
                          value={row.protocol}
                          onChange={(e) => update(row.key, { protocol: e.target.value })}
                        >
                          <option value="tcp">TCP</option>
                          <option value="udp">UDP</option>
                        </select>
                      )}
                    </Field>
                    <Field
                      label={`IP de publicação ${index + 1}`}
                      hint="Opcional. Exige porta no host; aceita IPv4 ou IPv6 sem colchetes."
                    >
                      {(id) => (
                        <input
                          id={id}
                          value={row.ip}
                          autoComplete="off"
                          onChange={(e) => update(row.key, { ip: e.target.value })}
                        />
                      )}
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <Field
                    label={`Origem do volume ${index + 1}`}
                    hint="Nome do volume, caminho absoluto no host ou vazio para volume anônimo."
                  >
                    {(id) => (
                      <input
                        id={id}
                        value={row.source}
                        autoComplete="off"
                        onChange={(e) => update(row.key, { source: e.target.value })}
                      />
                    )}
                  </Field>
                  <div className="form-grid">
                    <Field
                      label={`Destino do volume ${index + 1}`}
                      hint="Caminho absoluto no container, como /data."
                    >
                      {(id) => (
                        <input
                          id={id}
                          required
                          value={row.target}
                          autoComplete="off"
                          onChange={(e) => update(row.key, { target: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={`Acesso do volume ${index + 1}`}>
                      {(id) => (
                        <select
                          id={id}
                          value={row.mode}
                          onChange={(e) => update(row.key, { mode: e.target.value })}
                        >
                          <option value="rw">Leitura e escrita</option>
                          <option value="ro">Somente leitura</option>
                        </select>
                      )}
                    </Field>
                  </div>
                </>
              )}
            </section>
          ))}
          <Button
            type="button"
            disabled={rows.length >= 100}
            onClick={() => {
              change([
                ...rows,
                kind === 'ports'
                  ? {
                      kind,
                      key: nextId,
                      container: '',
                      host: '',
                      ip: '',
                      protocol: 'tcp',
                      changed: true,
                    }
                  : { kind, key: nextId, source: '', target: '', mode: 'rw', changed: true },
              ]);
              setNextId(nextId + 1);
            }}
          >
            <Plus size={16} />
            Adicionar {kind === 'ports' ? 'porta' : 'volume'}
          </Button>
        </>
      )}
    </fieldset>
  );
}
