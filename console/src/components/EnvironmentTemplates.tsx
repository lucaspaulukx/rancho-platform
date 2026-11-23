import { useI18n } from '../i18n/provider';
import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { allPages, api, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  Confirm,
  DataTable,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
} from './ui';
import { environmentTemplateMetadata, prepareEnvironmentTemplate } from './EnvironmentEditor';
import {
  catalogDefaults,
  catalogPath,
  catalogQuestions,
  prepareCatalogStack,
  type CatalogTemplate,
  type CatalogVersion,
} from '../catalog';
import { QuestionField } from '../pages/Catalog';

type Stack = Record<string, unknown>;
interface Draft {
  original?: Resource;
  name: string;
  description: string;
  isPublic: boolean;
  stacks: Stack[];
}
function revision(value: Resource) {
  return JSON.stringify([
    value.name,
    value.description,
    value.isPublic,
    value.stacks,
    value.externalId,
  ]);
}
class EnvironmentTemplateError extends Error {
  constructor(
    readonly key:
      | 'environmentTemplates.error.failed'
      | 'environmentTemplates.error.scope'
      | 'environmentTemplates.error.permission'
      | 'environmentTemplates.error.edit'
      | 'environmentTemplates.error.changed'
      | 'environmentTemplates.error.fields'
      | 'environmentTemplates.error.remove'
      | 'environmentTemplates.error.version'
      | 'environmentTemplates.error.review',
  ) {
    super(key);
  }
}
function failure() {
  return new EnvironmentTemplateError('environmentTemplates.error.failed');
}

export function EnvironmentTemplates({ schema, onClose }: { schema: Schema; onClose: () => void }) {
  const { t, formats } = useI18n();
  const app = useApp();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [stackKeys, setStackKeys] = useState<number[]>([]);
  const nextStackKey = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [discard, setDiscard] = useState(false);
  const [removing, setRemoving] = useState<Resource | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const scope = `${app.identity}:${app.project?.id || ''}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function requireScope() {
    if (!mounted.current || currentScope.current !== scope)
      throw new EnvironmentTemplateError('environmentTemplates.error.scope');
  }
  const key = ['data', app.identity, 'environment-templates-management'];
  const query = useQuery<Resource[]>({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (await allPages<Resource>(schema.links.collection, signal))
        .filter((value) => !value.removed)
        .map((value) => ({
          ...environmentTemplateMetadata(value),
          isPublic: value.isPublic === true,
        })),
    enabled: schema.collectionMethods?.includes('GET'),
    refetchInterval: 30_000,
  });
  async function open(value?: Resource, copy = false) {
    if (reading || save.isPending || remove.isPending) return;
    setError(null);
    if (!value) {
      setDraft({ name: '', description: '', isPublic: false, stacks: [] });
      setStackKeys([]);
      setDirty(false);
      return;
    }
    setReading(true);
    try {
      const full = await api<Resource>(
        `${schema.links.collection}/${encodeURIComponent(value.id)}`,
      );
      requireScope();
      if (full.id !== value.id || full.removed || !Array.isArray(full.stacks)) throw failure();
      setStackKeys(full.stacks.map(() => nextStackKey.current++));
      setDraft({
        original: copy ? undefined : full,
        name: `${full.name || ''}${copy ? '-copia' : ''}`,
        description: typeof full.description === 'string' ? full.description : '',
        isPublic: copy ? false : full.isPublic === true,
        stacks: structuredClone(full.stacks),
      });
      setDirty(copy);
    } catch {
      setError(failure());
    } finally {
      setReading(false);
    }
  }
  const save = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      if (!draft) throw failure();
      const current = await api<Schema>(schema.links.self);
      requireScope();
      const editing = !!draft.original;
      if (
        !(editing
          ? current.resourceMethods?.includes('PUT')
          : current.collectionMethods?.includes('POST'))
      )
        throw new EnvironmentTemplateError('environmentTemplates.error.permission');
      let target = current.links.collection;
      if (draft.original) {
        const latest = await api<Resource>(`${target}/${encodeURIComponent(draft.original.id)}`);
        requireScope();
        if (latest.removed || latest.state !== 'active' || latest.id !== draft.original.id)
          throw new EnvironmentTemplateError('environmentTemplates.error.edit');
        if (revision(latest) !== revision(draft.original))
          throw new EnvironmentTemplateError('environmentTemplates.error.changed');
        target = latest.links.self;
      }
      const mode = editing ? 'update' : 'create';
      for (const name of ['name', 'description', 'stacks'])
        if (!current.resourceFields[name]?.[mode])
          throw new EnvironmentTemplateError('environmentTemplates.error.fields');
      const body = prepareEnvironmentTemplate(
        draft.name,
        draft.description,
        draft.stacks,
        current.resourceFields.isPublic?.[mode] ? draft.isPublic : undefined,
      );
      try {
        requireScope();
        await api<Resource>(target, body, editing ? 'PUT' : 'POST');
      } catch {
        throw failure();
      }
    },
    onSuccess: async () => {
      setDraft(null);
      setDirty(false);
      await client.invalidateQueries({ queryKey: ['data'] });
    },
    onError: (value) => setError(value),
  });
  const remove = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      if (!removing) throw failure();
      const current = await api<Schema>(schema.links.self);
      requireScope();
      const latest = await api<Resource>(
        `${current.links.collection}/${encodeURIComponent(removing.id)}`,
      );
      requireScope();
      if (
        latest.id !== removing.id ||
        latest.removed ||
        !current.resourceActions?.remove ||
        !latest.actions?.remove
      )
        throw new EnvironmentTemplateError('environmentTemplates.error.remove');
      try {
        await api(latest.actions.remove, {});
      } catch {
        throw failure();
      }
    },
    onSuccess: async () => {
      setRemoving(null);
      await client.invalidateQueries({ queryKey: ['data'] });
    },
    onError: () => {
      setRemoving(null);
      setError(failure());
    },
  });
  const pending = reading || save.isPending || remove.isPending;
  const blocker = useBlocker(dirty || pending);
  useEffect(() => {
    if (!dirty && !pending) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, pending]);
  function closeDraft() {
    if (pending) return;
    if (dirty) setDiscard(true);
    else {
      setDraft(null);
      setError(null);
    }
  }
  function update(patch: Partial<Draft>) {
    setDraft((value) => value && { ...value, ...patch });
    setDirty(true);
    setError(null);
  }
  const writable = draft?.original
    ? schema.resourceMethods?.includes('PUT')
    : schema.collectionMethods?.includes('POST');
  return (
    <>
      <Modal
        open
        drawer
        title={t('environmentTemplates.title')}
        onOpenChange={(value) => {
          if (!value && !pending && !draft) onClose();
        }}
        footer={
          <Button disabled={pending || !!draft} onClick={onClose}>
            {t('environmentTemplates.close')}
          </Button>
        }
      >
        <div className="page-actions">
          {schema.collectionMethods?.includes('POST') && (
            <Button disabled={pending} onClick={() => void open()}>
              <Plus size={16} />
              {t('environmentTemplates.create')}
            </Button>
          )}
          <Button
            aria-label={t('environmentTemplates.refresh')}
            disabled={pending}
            onClick={() => void query.refetch()}
          >
            <RefreshCw size={16} />
          </Button>
        </div>
        {error && !draft && (
          <Alert>{error instanceof EnvironmentTemplateError ? t(error.key) : error.message}</Alert>
        )}
        {reading && <Loading label={t('environmentTemplates.opening')} />}
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : !schema.collectionMethods?.includes('GET') ? (
          <Empty
            title={t('environmentTemplates.unavailable')}
            description={t('environmentTemplates.unavailableDescription')}
          />
        ) : (
          <DataTable
            rows={query.data || []}
            rowKey={(value) => value.id}
            searchText={(value) => `${value.name} ${value.description || ''}`}
            columns={[
              {
                key: 'name',
                label: t('environmentTemplates.name'),
                sortValue: (value) => value.name || value.id,
                render: (value) => value.name || value.id,
              },
              {
                key: 'state',
                label: t('environmentTemplates.state'),
                render: (value) => <Badge state={value.state}>{value.state}</Badge>,
              },
              {
                key: 'stacks',
                label: t('environmentTemplates.stacks'),
                render: (value) =>
                  formats.number(Array.isArray(value.stacks) ? value.stacks.length : 0),
              },
              {
                key: 'access',
                label: t('environmentTemplates.visibility'),
                render: (value) =>
                  value.isPublic
                    ? t('environmentTemplates.public')
                    : t('environmentTemplates.private'),
              },
              {
                key: 'actions',
                label: t('environmentTemplates.actions'),
                render: (value) => (
                  <div className="page-actions">
                    <Button
                      aria-label={t('environmentTemplates.openLabel', {
                        name: value.name || value.id,
                      })}
                      title={t('environmentTemplates.open')}
                      disabled={pending}
                      onClick={() => void open(value)}
                    >
                      <Pencil size={16} />
                    </Button>
                    {schema.collectionMethods?.includes('POST') && (
                      <Button
                        aria-label={t('environmentTemplates.copyLabel', {
                          name: value.name || value.id,
                        })}
                        title={t('environmentTemplates.copy')}
                        disabled={pending}
                        onClick={() => void open(value, true)}
                      >
                        <Copy size={16} />
                      </Button>
                    )}
                    {schema.resourceActions?.remove && (
                      <Button
                        variant="danger"
                        aria-label={t('environmentTemplates.removeLabel', {
                          name: value.name || value.id,
                        })}
                        title={t('environmentTemplates.remove')}
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setRemoving(value);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>
      {draft && (
        <Modal
          open
          drawer
          title={
            draft.original
              ? t('environmentTemplates.editorTitle', {
                  name: draft.original.name || draft.original.id,
                })
              : t('environmentTemplates.new')
          }
          onOpenChange={(value) => {
            if (!value) closeDraft();
          }}
          footer={
            <>
              <Button disabled={pending} onClick={closeDraft}>
                {t('environmentTemplates.cancel')}
              </Button>
              {writable && (
                <Button
                  variant="primary"
                  type="submit"
                  form="environment-template-form"
                  busy={save.isPending}
                >
                  {t('environmentTemplates.save')}
                </Button>
              )}
            </>
          }
        >
          {error && (
            <Alert>
              {error instanceof EnvironmentTemplateError ? t(error.key) : error.message}
            </Alert>
          )}
          <form
            id="environment-template-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!pending && writable) {
                setError(null);
                if (draft.isPublic && !draft.original?.isPublic) setPublishing(true);
                else save.mutate();
              }
            }}
          >
            <fieldset
              disabled={pending || !writable}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <Field label={t('environmentTemplates.templateName')}>
                {(id) => (
                  <input
                    id={id}
                    required
                    maxLength={255}
                    value={draft.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                )}
              </Field>
              <Field label={t('environmentTemplates.description')}>
                {(id) => (
                  <textarea
                    id={id}
                    maxLength={1024}
                    value={draft.description}
                    onChange={(event) => update({ description: event.target.value })}
                  />
                )}
              </Field>
              {schema.resourceFields.isPublic?.[draft.original ? 'update' : 'create'] && (
                <Field label={t('environmentTemplates.templateVisibility')}>
                  {(id) => (
                    <label className="checkbox-field">
                      <input
                        id={id}
                        type="checkbox"
                        checked={draft.isPublic}
                        onChange={(event) => update({ isPublic: event.target.checked })}
                      />
                      {t('environmentTemplates.publicAccounts')}
                    </label>
                  )}
                </Field>
              )}
              <h3>{t('environmentTemplates.infrastructureStacks')}</h3>
              {draft.stacks.map((stack, index) => (
                <TemplateStack
                  key={stackKeys[index]}
                  stack={stack}
                  index={index}
                  onChange={(next) =>
                    update({
                      stacks: draft.stacks.map((value, position) =>
                        position === index ? next : value,
                      ),
                    })
                  }
                  onRemove={() => {
                    setStackKeys((keys) => keys.filter((_, position) => position !== index));
                    update({ stacks: draft.stacks.filter((_, position) => position !== index) });
                  }}
                />
              ))}
              <Button
                type="button"
                disabled={draft.stacks.length >= 100}
                onClick={() => {
                  const key = nextStackKey.current++;
                  setStackKeys((keys) => [...keys, key]);
                  update({
                    stacks: [...draft.stacks, { name: '', dockerCompose: '', rancherCompose: '' }],
                  });
                }}
              >
                <Plus size={16} />
                {t('environmentTemplates.addCompose')}
              </Button>
              {app.config?.modules.catalog && (
                <Button
                  type="button"
                  disabled={!app.project || draft.stacks.length >= 100}
                  onClick={() => setCatalogOpen(true)}
                >
                  <Plus size={16} />
                  {t('environmentTemplates.addCatalog')}
                </Button>
              )}
            </fieldset>
          </form>
        </Modal>
      )}
      {catalogOpen && draft && (
        <CatalogStackPicker
          onClose={() => setCatalogOpen(false)}
          onAdd={(stack) => {
            update({ stacks: [...draft.stacks, stack] });
            const key = nextStackKey.current++;
            setStackKeys((keys) => [...keys, key]);
            setCatalogOpen(false);
          }}
        />
      )}
      <Confirm
        open={publishing}
        onOpenChange={(value) => {
          if (!pending) setPublishing(value);
        }}
        title={t('environmentTemplates.publish')}
        description={t('environmentTemplates.publishDescription')}
        busy={save.isPending}
        onConfirm={() => {
          if (!pending) {
            setPublishing(false);
            save.mutate();
          }
        }}
      />
      <Confirm
        open={!!removing}
        onOpenChange={(value) => {
          if (!value && !pending) setRemoving(null);
        }}
        title={t('environmentTemplates.removeTitle')}
        description={t('environmentTemplates.removeDescription', {
          name: removing?.name || removing?.id || '',
        })}
        busy={remove.isPending}
        onConfirm={() => {
          if (!pending) remove.mutate();
        }}
      />
      <Confirm
        open={discard || blocker.state === 'blocked'}
        onOpenChange={(value) => {
          if (!value) {
            setDiscard(false);
            if (blocker.state === 'blocked') blocker.reset();
          }
        }}
        title={t('environmentTemplates.discard')}
        description={t('environmentTemplates.discardDescription')}
        busy={pending}
        onConfirm={() => {
          if (pending) return;
          setDraft(null);
          setDirty(false);
          setDiscard(false);
          setError(null);
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}

function CatalogStackPicker({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (stack: Stack) => void;
}) {
  const { t } = useI18n();
  const app = useApp();
  const [templateId, setTemplateId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<Error | null>(null);
  const headers = { 'X-Api-Project-Id': app.project!.id };
  const templates = useQuery({
    queryKey: ['data', app.identity, app.project?.id, 'environment-catalog-templates'],
    queryFn: async ({ signal }) =>
      (
        await allPages<CatalogTemplate>(
          '/v1-catalog/templates?rancherVersion=v1.6.30',
          signal,
          headers,
        )
      ).filter((value) => value.templateBase === 'infra'),
  });
  const selected = templates.data?.find((value) => value.id === templateId);
  const detail = useQuery({
    queryKey: ['data', app.identity, app.project?.id, 'environment-catalog-template', templateId],
    queryFn: ({ signal }) =>
      api<CatalogTemplate>(
        catalogPath(selected!.links.self),
        undefined,
        undefined,
        signal,
        headers,
      ),
    enabled: !!selected,
  });
  const links = detail.data?.versionLinks || {};
  const versionName =
    selectedVersion ||
    (detail.data?.defaultVersion && links[detail.data.defaultVersion]
      ? detail.data.defaultVersion
      : Object.keys(links)[0] || '');
  const url = links[versionName];
  const version = useQuery({
    queryKey: ['data', app.identity, app.project?.id, 'environment-catalog-version', url],
    queryFn: async ({ signal }) => {
      const value = await api<CatalogVersion>(
        catalogPath(url),
        undefined,
        undefined,
        signal,
        headers,
      );
      catalogQuestions(value);
      if (value.templateId !== templateId)
        throw new EnvironmentTemplateError('environmentTemplates.error.version');
      return value;
    },
    enabled: !!url,
    gcTime: 0,
  });
  useEffect(() => {
    if (version.data) setAnswers(catalogDefaults(catalogQuestions(version.data), {}));
  }, [version.data]);
  const questions = version.data ? catalogQuestions(version.data) : [];
  const unsupported = questions.some((question) =>
    ['service', 'certificate', 'secret'].includes(question.type),
  );
  function submit() {
    try {
      if (!detail.data || !version.data || unsupported) return;
      const prepared = prepareCatalogStack(detail.data, version.data, name, '', answers, false);
      onAdd({
        name: prepared.name,
        templateId: detail.data.id,
        templateVersionId: version.data.id,
        answers: prepared.environment,
      });
    } catch (value) {
      setError(
        value instanceof Error
          ? value
          : new EnvironmentTemplateError('environmentTemplates.error.review'),
      );
    }
  }
  return (
    <Modal
      open
      drawer
      title={t('environmentTemplates.catalogStack')}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      footer={
        <>
          <Button onClick={onClose}>{t('environmentTemplates.cancel')}</Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={!version.data || version.isFetching || unsupported}
          >
            {t('environmentTemplates.addStack')}
          </Button>
        </>
      }
    >
      {error && (
        <Alert>{error instanceof EnvironmentTemplateError ? t(error.key) : error.message}</Alert>
      )}
      {templates.isPending ? (
        <Loading />
      ) : templates.error ? (
        <ErrorState error={templates.error} retry={() => void templates.refetch()} />
      ) : (
        <>
          <Field label={t('environmentTemplates.infraTemplate')}>
            {(id) => (
              <select
                id={id}
                value={templateId}
                onChange={(event) => {
                  setTemplateId(event.target.value);
                  setSelectedVersion('');
                  setAnswers({});
                  setError(null);
                  const next = templates.data.find((value) => value.id === event.target.value);
                  setName(
                    String(next?.defaultName || next?.name || '')
                      .toLowerCase()
                      .replace(/[^a-z0-9_.-]+/g, '-'),
                  );
                }}
              >
                <option value="">{t('environmentTemplates.select')}</option>
                {templates.data.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name || value.id}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {detail.isFetching && <Loading />}
          {detail.error && <ErrorState error={detail.error} retry={() => void detail.refetch()} />}
          {detail.data && (
            <>
              <Field label={t('environmentTemplates.infraVersion')}>
                {(id) => (
                  <select
                    id={id}
                    value={versionName}
                    onChange={(event) => {
                      setSelectedVersion(event.target.value);
                      setAnswers({});
                      setError(null);
                    }}
                  >
                    {Object.keys(links).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t('environmentTemplates.catalogStackName')}>
                {(id) => (
                  <input
                    id={id}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                )}
              </Field>
              {version.isFetching && <Loading />}
              {version.error && (
                <ErrorState
                  error={
                    version.error instanceof EnvironmentTemplateError
                      ? new Error(t(version.error.key))
                      : version.error
                  }
                  retry={() => void version.refetch()}
                />
              )}
              {unsupported ? (
                <Alert tone="warning">{t('environmentTemplates.unsupported')}</Alert>
              ) : (
                questions.map((question) => (
                  <QuestionField
                    key={`${version.data?.id}:${question.variable}`}
                    question={question}
                    value={answers[question.variable]}
                    onChange={(value) =>
                      setAnswers((current) => ({ ...current, [question.variable]: value }))
                    }
                  />
                ))
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function NumericTemplateAnswer({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      id={id}
      type="number"
      required
      step="any"
      value={text}
      autoComplete="off"
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        if (next.trim() && Number.isFinite(Number(next))) onChange(Number(next));
      }}
    />
  );
}

function TemplateStack({
  stack,
  index,
  onChange,
  onRemove,
}: {
  stack: Stack;
  index: number;
  onChange: (value: Stack) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  function field(name: string, label: string, multiline = false) {
    return (
      <Field label={label}>
        {(id) =>
          multiline ? (
            <textarea
              id={id}
              rows={6}
              value={typeof stack[name] === 'string' ? (stack[name] as string) : ''}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onChange({ ...stack, [name]: event.target.value })}
            />
          ) : (
            <input
              id={id}
              value={typeof stack[name] === 'string' ? (stack[name] as string) : ''}
              autoComplete="off"
              onChange={(event) => onChange({ ...stack, [name]: event.target.value })}
            />
          )
        }
      </Field>
    );
  }
  return (
    <section
      aria-label={t('environmentTemplates.stackIndex', { index: index + 1 })}
      style={{
        borderTop: '1px solid var(--border)',
        paddingTop: 16,
        marginTop: 16,
        marginBottom: 24,
      }}
    >
      <div className="page-actions">
        <h4>{t('environmentTemplates.stackIndex', { index: index + 1 })}</h4>
        <Button
          type="button"
          variant="danger"
          title={t('environmentTemplates.removeStack')}
          aria-label={t('environmentTemplates.removeStackLabel', { index: index + 1 })}
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      {field('name', t('environmentTemplates.stackName', { index: index + 1 }))}
      {typeof stack.templateId === 'string' && stack.templateId && (
        <>
          <Field label={t('environmentTemplates.catalogTemplate')}>
            {(id) => <input id={id} readOnly value={stack.templateId as string} />}
          </Field>
          <Field label={t('environmentTemplates.catalogVersion')}>
            {(id) => (
              <input
                id={id}
                readOnly
                value={
                  typeof stack.templateVersionId === 'string' && stack.templateVersionId
                    ? stack.templateVersionId
                    : t('environmentTemplates.defaultVersion')
                }
              />
            )}
          </Field>
        </>
      )}
      {(!stack.templateId || stack.dockerCompose !== undefined) &&
        field('dockerCompose', t('environmentTemplates.dockerCompose', { index: index + 1 }), true)}
      {(!stack.templateId || stack.rancherCompose !== undefined) &&
        field(
          'rancherCompose',
          t('environmentTemplates.rancherCompose', { index: index + 1 }),
          true,
        )}
      {!!stack.binding && typeof stack.binding === 'object' && (
        <Field label={t('environmentTemplates.bindings')}>
          {(id) => (
            <input id={id} readOnly value={Object.keys(stack.binding as object).join(', ')} />
          )}
        </Field>
      )}
      {stack.answers && typeof stack.answers === 'object' && !Array.isArray(stack.answers)
        ? Object.entries(stack.answers as Record<string, unknown>).map(([name, value]) =>
            typeof value === 'boolean' ? (
              <CheckboxField
                key={name}
                label={t('environmentTemplates.parameter', { name, index: index + 1 })}
                checked={value}
                onChange={(event) =>
                  onChange({
                    ...stack,
                    answers: { ...(stack.answers as object), [name]: event.target.checked },
                  })
                }
              />
            ) : (
              <Field
                key={name}
                label={t('environmentTemplates.parameter', { name, index: index + 1 })}
              >
                {(id) =>
                  typeof value === 'number' ? (
                    <NumericTemplateAnswer
                      id={id}
                      value={value}
                      onChange={(next) =>
                        onChange({
                          ...stack,
                          answers: { ...(stack.answers as object), [name]: next },
                        })
                      }
                    />
                  ) : value !== null && typeof value === 'object' ? (
                    <input id={id} readOnly value={t('environmentTemplates.compound')} />
                  ) : (
                    <input
                      id={id}
                      type="password"
                      autoComplete="new-password"
                      value={String(value ?? '')}
                      onChange={(event) =>
                        onChange({
                          ...stack,
                          answers: {
                            ...(stack.answers as object),
                            [name]: event.target.value,
                          },
                        })
                      }
                    />
                  )
                }
              </Field>
            ),
          )
        : null}
    </section>
  );
}
