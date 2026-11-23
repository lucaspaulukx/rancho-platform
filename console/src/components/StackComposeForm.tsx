import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Schema } from '../api';
import { prepareStackCompose, type StackComposeDraft } from '../stack-compose';
import { Alert, Button, CheckboxField, Field } from './ui';
import { ComposeEditor } from './ComposeEditor';

export function StackComposeForm({
  schema,
  onSubmit,
  onDirtyChange,
  busy,
  error,
}: {
  schema: Schema;
  onSubmit: (payload: Record<string, unknown>) => void;
  onDirtyChange: (dirty: boolean) => void;
  busy: boolean;
  error: Error | null;
}) {
  const [draft, setDraft] = useState<StackComposeDraft>({
    name: '',
    description: '',
    compose: false,
    dockerCompose: '',
    rancherCompose: '',
    startOnCreate: false,
    variables: [],
  });
  const [nextId, setNextId] = useState(1);
  const [validation, setValidation] = useState('');
  function update(change: Partial<StackComposeDraft>) {
    setDraft({ ...draft, ...change });
    setValidation('');
    onDirtyChange(true);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    try {
      onSubmit(prepareStackCompose(schema, draft));
      setValidation('');
    } catch (caught) {
      setValidation(caught instanceof Error ? caught.message : 'Revise a stack.');
    }
  }
  return (
    <form id="workspace-create-form" onSubmit={submit}>
      <fieldset className="form-fieldset" disabled={busy}>
        <Field label="Nome da stack" hint="Letras, números e hífen. Até 63 caracteres.">
          {(id) => (
            <input
              id={id}
              required
              maxLength={schema.resourceFields.name?.maxLength ?? 63}
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Descrição">
          {(id) => (
            <textarea
              id={id}
              rows={2}
              maxLength={schema.resourceFields.description?.maxLength ?? 1024}
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
            />
          )}
        </Field>
        <Field label="Como criar a stack">
          {(id) => (
            <select
              id={id}
              value={draft.compose ? 'compose' : 'empty'}
              onChange={(event) =>
                update({ compose: event.target.value === 'compose', startOnCreate: false })
              }
            >
              <option value="empty">Stack vazia</option>
              <option
                value="compose"
                disabled={
                  !schema.resourceFields.dockerCompose?.create ||
                  !schema.resourceFields.startOnCreate?.create
                }
              >
                Importar Compose
              </option>
            </select>
          )}
        </Field>
        {draft.compose ? (
          <>
            <Alert tone="info">
              Use o formato compatível com Rancher 1.6. O servidor valida os arquivos e processa a
              importação; acompanhe o resultado na stack.
            </Alert>
            <ComposeEditor
              label="Docker Compose"
              value={draft.dockerCompose}
              onChange={(dockerCompose) => update({ dockerCompose })}
              required
            />
            {schema.resourceFields.rancherCompose?.create && (
              <ComposeEditor
                label="Rancher Compose (opcional)"
                value={draft.rancherCompose}
                onChange={(rancherCompose) => update({ rancherCompose })}
              />
            )}
            {schema.resourceFields.environment?.create && (
              <section>
                <h3>Variáveis de interpolação</h3>
                <p className="muted">
                  Valores usados pelo Rancher ao importar os arquivos. Não são guardados nas
                  preferências da console.
                </p>
                {draft.variables.map((row, index) => (
                  <div className="compose-variable" key={row.id}>
                    <Field label={`Nome da variável ${index + 1}`}>
                      {(id) => (
                        <input
                          id={id}
                          value={row.name}
                          autoComplete="off"
                          onChange={(event) =>
                            update({
                              variables: draft.variables.map((v) =>
                                v.id === row.id ? { ...v, name: event.target.value } : v,
                              ),
                            })
                          }
                        />
                      )}
                    </Field>
                    <Field label={`Valor da variável ${index + 1}`}>
                      {(id) => (
                        <input
                          id={id}
                          type="password"
                          value={row.value}
                          autoComplete="new-password"
                          onChange={(event) =>
                            update({
                              variables: draft.variables.map((v) =>
                                v.id === row.id ? { ...v, value: event.target.value } : v,
                              ),
                            })
                          }
                        />
                      )}
                    </Field>
                    <Button
                      type="button"
                      aria-label={`Remover variável ${index + 1}`}
                      onClick={() =>
                        update({ variables: draft.variables.filter((v) => v.id !== row.id) })
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={() => {
                    update({
                      variables: [...draft.variables, { id: nextId, name: '', value: '' }],
                    });
                    setNextId(nextId + 1);
                  }}
                >
                  <Plus size={16} />
                  Adicionar variável
                </Button>
              </section>
            )}
            <CheckboxField
              label="Iniciar os serviços após importar"
              description="Cria containers no environment selecionado. Deixe desmarcado para revisar os serviços antes de iniciar."
              checked={draft.startOnCreate}
              onChange={(event) => update({ startOnCreate: event.target.checked })}
            />
            <Alert tone={draft.startOnCreate ? 'warning' : 'info'}>
              {draft.startOnCreate
                ? 'A importação pode criar containers e consumir recursos no environment selecionado.'
                : 'Os serviços serão importados sem início automático. Você poderá iniciá-los pela operação.'}
            </Alert>
          </>
        ) : (
          <p className="muted">Crie a stack e adicione serviços pelo menu da própria linha.</p>
        )}
        {(validation || error) && <Alert tone="danger">{validation || error?.message}</Alert>}
      </fieldset>
    </form>
  );
}
