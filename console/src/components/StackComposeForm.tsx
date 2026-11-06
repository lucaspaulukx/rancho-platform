import { useI18n } from '../i18n/provider';
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
  const { t } = useI18n();
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
  const [validation, setValidation] = useState<Error | 'review' | null>(null);
  function update(change: Partial<StackComposeDraft>) {
    setDraft({ ...draft, ...change });
    setValidation(null);
    onDirtyChange(true);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    try {
      onSubmit(prepareStackCompose(schema, draft));
      setValidation(null);
    } catch (caught) {
      setValidation(caught instanceof Error ? caught : 'review');
    }
  }
  return (
    <form id="workspace-create-form" onSubmit={submit}>
      <fieldset className="form-fieldset" disabled={busy}>
        <Field label={t('composeEditor.stackName')} hint={t('composeEditor.nameHint')}>
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
        <Field label={t('composeEditor.description')}>
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
        <Field label={t('composeEditor.creationMode')}>
          {(id) => (
            <select
              id={id}
              value={draft.compose ? 'compose' : 'empty'}
              onChange={(event) =>
                update({ compose: event.target.value === 'compose', startOnCreate: false })
              }
            >
              <option value="empty">{t('composeEditor.empty')}</option>
              <option
                value="compose"
                disabled={
                  !schema.resourceFields.dockerCompose?.create ||
                  !schema.resourceFields.startOnCreate?.create
                }
              >
                {t('composeEditor.import')}
              </option>
            </select>
          )}
        </Field>
        {draft.compose ? (
          <>
            <Alert tone="info">{t('composeEditor.compatibility')}</Alert>
            <ComposeEditor
              label={t('composeEditor.docker')}
              value={draft.dockerCompose}
              onChange={(dockerCompose) => update({ dockerCompose })}
              required
            />
            {schema.resourceFields.rancherCompose?.create && (
              <ComposeEditor
                label={t('composeEditor.rancher')}
                value={draft.rancherCompose}
                onChange={(rancherCompose) => update({ rancherCompose })}
              />
            )}
            {schema.resourceFields.environment?.create && (
              <section>
                <h3>{t('composeEditor.variables')}</h3>
                <p className="muted">{t('composeEditor.variablesNote')}</p>
                {draft.variables.map((row, index) => (
                  <div className="compose-variable" key={row.id}>
                    <Field label={t('composeEditor.variableName', { index: String(index + 1) })}>
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
                    <Field label={t('composeEditor.variableValue', { index: String(index + 1) })}>
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
                      aria-label={t('composeEditor.removeVariable', { index: String(index + 1) })}
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
                  {t('composeEditor.addVariable')}
                </Button>
              </section>
            )}
            <CheckboxField
              label={t('composeEditor.start')}
              description={t('composeEditor.startDescription')}
              checked={draft.startOnCreate}
              onChange={(event) => update({ startOnCreate: event.target.checked })}
            />
            <Alert tone={draft.startOnCreate ? 'warning' : 'info'}>
              {draft.startOnCreate
                ? t('composeEditor.startWarning')
                : t('composeEditor.startManually')}
            </Alert>
          </>
        ) : (
          <p className="muted">{t('composeEditor.emptyHint')}</p>
        )}
        {(validation || error) && (
          <Alert tone="danger">
            {validation === 'review'
              ? t('composeEditor.review')
              : validation?.message || error?.message}
          </Alert>
        )}
      </fieldset>
    </form>
  );
}
