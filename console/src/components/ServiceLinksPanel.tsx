import { useI18n } from '../i18n/provider';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import { useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { allPages, api, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { useSchemas } from '../hooks/useSchemas';
import { useActionScope } from '../hooks/useActionScope';
import {
  activeServiceLinks,
  assertServiceLinksUnchanged,
  canEditServiceLinks,
  editableServiceLinks,
  prepareServiceLinks,
  type ServiceLinkDraft,
} from '../service-links';
import {
  Alert,
  Button,
  CheckboxField,
  Confirm,
  ErrorState,
  Field,
  Loading,
  Modal,
  useToast,
} from './ui';

class ServiceEditorError extends Error {
  constructor(
    readonly key:
      | 'serviceEditors.reopen'
      | 'serviceEditors.contract'
      | 'serviceEditors.changed'
      | 'serviceEditors.confirmRemove'
      | 'serviceEditors.reviewLinks',
  ) {
    super(key);
  }
}

const metadata = (v: Resource): Resource =>
  Object.fromEntries(
    [
      'id',
      'type',
      'name',
      'state',
      'accountId',
      'stackId',
      'system',
      'removed',
      'links',
      'actions',
    ].map((key) => [key, v[key]]),
  ) as Resource;
export default function ServiceLinksPanel({
  resource,
  onClose,
  onSaved,
}: {
  resource: Resource;
  onClose: () => void;
  onSaved: (value: Resource) => void;
}) {
  const { t } = useI18n();
  const errorText = (error: Error) =>
    error instanceof ServiceEditorError ? t(error.key) : error.message;
  const app = useApp();
  const scope = useActionScope();
  const schemas = useSchemas(true);
  const client = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<ServiceLinkDraft[] | null>(null);
  const [review, setReview] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [removeAll, setRemoveAll] = useState(false);
  const [validation, setValidation] = useState<Error | null>(null);
  const [nextId, setNextId] = useState(1000);
  async function load(signal: AbortSignal) {
    const base = `projects/${scope.environment}/`;
    const [source, services, stacks, mappings] = await Promise.all([
      api<Resource>(resource.links.self, undefined, undefined, signal),
      allPages<Resource>(base + 'services?limit=100', signal),
      allPages<Resource>(base + 'stacks?limit=100', signal),
      allPages<Resource>(base + 'serviceConsumeMaps?limit=100', signal),
    ]);
    scope.resource(source, resource);
    return {
      source: metadata(source),
      services: services.map(metadata),
      stacks: stacks.map(metadata),
      mappings: activeServiceLinks(mappings, source, scope.environment!).map(
        (v) =>
          Object.fromEntries(
            [
              'id',
              'type',
              'accountId',
              'serviceId',
              'consumedServiceId',
              'consumedService',
              'name',
              'ports',
              'state',
              'removed',
              'links',
            ].map((key) => [key, v[key]]),
          ) as Resource,
      ),
    };
  }
  const query = useQuery({
    queryKey: [
      'data',
      app.identity,
      'project',
      app.project?.id,
      'service-links-editor',
      resource.id,
    ],
    queryFn: ({ signal }) => load(signal),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const baseline = useRef<Awaited<ReturnType<typeof load>> | null>(null);
  if (query.data && !query.isFetching && !baseline.current) baseline.current = query.data;
  const data = baseline.current;
  let unsupported = '';
  let original: ServiceLinkDraft[] = [];
  try {
    if (data) original = editableServiceLinks(data.mappings, data.services, scope.environment!);
  } catch (caught) {
    unsupported = caught instanceof Error ? caught.message : t('serviceEditors.unsupported');
  }
  const rows = draft || original;
  const allowed =
    !!data &&
    canEditServiceLinks(
      data.source,
      schemas.data?.service,
      app.config.modules.serviceLinksEditor,
    ) &&
    !unsupported;
  function change(value: ServiceLinkDraft[]) {
    setDraft(value);
    setRemoveAll(false);
    setReview(false);
    setValidation(null);
  }
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      if (!data || !draft || !app.config.modules.serviceLinksEditor)
        throw new ServiceEditorError('serviceEditors.reopen');
      const signal = scope.signal();
      const contracts = schemas.data;
      if (
        !contracts?.service.links.self ||
        !contracts.serviceLink?.links.self ||
        !contracts.setServiceLinksInput?.links.self
      )
        throw new ServiceEditorError('serviceEditors.contract');
      const [fresh, permission, linkSchema, inputSchema] = await Promise.all([
        load(signal),
        api<Schema>(contracts.service.links.self, undefined, undefined, signal),
        api<Schema>(contracts.serviceLink.links.self, undefined, undefined, signal),
        api<Schema>(contracts.setServiceLinksInput.links.self, undefined, undefined, signal),
      ]);
      scope.assertCurrent();
      assertServiceLinksUnchanged(data.mappings, fresh.mappings);
      editableServiceLinks(fresh.mappings, fresh.services, scope.environment!);
      if (
        inputSchema.id !== 'setServiceLinksInput' ||
        !inputSchema.resourceFields.serviceLinks?.create ||
        inputSchema.resourceFields.serviceLinks.type !== 'array[serviceLink]' ||
        linkSchema.id !== 'serviceLink' ||
        permission.id !== 'service'
      )
        throw new ServiceEditorError('serviceEditors.changed');
      const payload = prepareServiceLinks(
        fresh.source,
        permission,
        linkSchema,
        draft,
        fresh.services,
        fresh.stacks,
        scope.environment!,
      );
      if (!payload.serviceLinks.length && data.mappings.length && !removeAll)
        throw new ServiceEditorError('serviceEditors.confirmRemove');
      return api<Resource>(fresh.source.actions!.setservicelinks, payload, 'POST', signal);
    },
    onError: () => setReview(false),
    onSuccess: async (value) => {
      setDraft(null);
      setReview(false);
      await client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', app.project?.id],
      });
      toast(t('serviceEditors.sent'));
      onSaved(metadata(value));
    },
  });
  const dirty = draft !== null;
  const blocker = useBlocker(dirty || mutation.isPending);
  usePageLeaveGuard(dirty || mutation.isPending, app.config.modules.unsavedChangesGuard);
  function close() {
    if (mutation.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  function requestReview() {
    try {
      if (!data || !schemas.data || !draft) return;
      prepareServiceLinks(
        data.source,
        schemas.data.service,
        schemas.data.serviceLink,
        draft,
        data.services,
        data.stacks,
        scope.environment!,
      );
      if (!draft.length && data.mappings.length && !removeAll)
        throw new ServiceEditorError('serviceEditors.confirmRemove');
      setValidation(null);
      setReview(true);
    } catch (caught) {
      setValidation(
        caught instanceof Error ? caught : new ServiceEditorError('serviceEditors.reviewLinks'),
      );
    }
  }
  const targets =
    data?.services.filter(
      (v) =>
        v.accountId === scope.environment &&
        v.id !== resource.id &&
        v.type === 'service' &&
        !v.removed &&
        ['active', 'inactive'].includes(v.state || '') &&
        data.stacks.some(
          (s) => s.id === v.stackId && s.accountId === scope.environment && !s.removed && !s.system,
        ),
    ) || [];
  const display = (id: string) => {
    const target = data?.services.find((v) => v.id === id);
    const stack = data?.stacks.find((v) => v.id === target?.stackId);
    return target
      ? `${stack?.name || target.stackId} / ${target.name || target.id}`
      : t('serviceEditors.targetMissing', { id });
  };
  return (
    <>
      <Modal
        open
        drawer
        title={t('serviceEditors.title', { name: resource.name || resource.id })}
        description={t('serviceEditors.environment', { name: app.project?.name || '' })}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={mutation.isPending}>
              {t('serviceEditors.close')}
            </Button>
            <Button
              variant="primary"
              disabled={!allowed || !dirty || mutation.isPending}
              onClick={requestReview}
            >
              {t('serviceEditors.review')}
            </Button>
          </>
        }
      >
        {query.isPending || schemas.isPending ? (
          <Loading />
        ) : query.error || schemas.error ? (
          <ErrorState
            error={query.error || schemas.error}
            retry={() => {
              void query.refetch();
              void schemas.refetch();
            }}
          />
        ) : (
          <>
            <Alert tone="info">{t('serviceEditors.linkInfo')}</Alert>
            {unsupported && <Alert tone="warning">{unsupported}</Alert>}
            {!allowed && !unsupported && <Alert tone="warning">{t('serviceEditors.denied')}</Alert>}
            <fieldset className="form-fieldset" disabled={!allowed || mutation.isPending}>
              {!rows.length && <p className="muted">{t('serviceEditors.empty')}</p>}
              {rows.map((row, index) => (
                <section className="compose-editor" key={row.key}>
                  <div className="compose-editor-heading">
                    <strong>{t('serviceEditors.link', { index: index + 1 })}</strong>
                    <Button
                      aria-label={t('serviceEditors.remove', { index: index + 1 })}
                      onClick={() => change(rows.filter((v) => v.key !== row.key))}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <Field label={t('serviceEditors.target', { index: index + 1 })}>
                    {(id) => (
                      <select
                        id={id}
                        value={row.serviceId}
                        onChange={(event) =>
                          change(
                            rows.map((v) =>
                              v.key === row.key ? { ...v, serviceId: event.target.value } : v,
                            ),
                          )
                        }
                      >
                        <option value="">{t('serviceEditors.select')}</option>
                        {targets.map((target) => (
                          <option value={target.id} key={target.id}>
                            {display(target.id)}
                          </option>
                        ))}
                        {row.serviceId && !targets.some((v) => v.id === row.serviceId) && (
                          <option value={row.serviceId}>{display(row.serviceId)}</option>
                        )}
                      </select>
                    )}
                  </Field>
                  <Field
                    label={t('serviceEditors.alias', { index: index + 1 })}
                    hint={t('serviceEditors.aliasHint')}
                  >
                    {(id) => (
                      <input
                        id={id}
                        value={row.name}
                        maxLength={255}
                        autoComplete="off"
                        onChange={(event) =>
                          change(
                            rows.map((v) =>
                              v.key === row.key ? { ...v, name: event.target.value } : v,
                            ),
                          )
                        }
                      />
                    )}
                  </Field>
                </section>
              ))}
              <Button
                disabled={rows.length >= 100}
                onClick={() => {
                  change([...rows, { key: nextId, serviceId: '', name: '' }]);
                  setNextId(nextId + 1);
                }}
              >
                <Plus size={16} />
                {t('serviceEditors.add')}
              </Button>
              {!rows.length && !!original.length && (
                <CheckboxField
                  label={t('serviceEditors.acknowledge')}
                  checked={removeAll}
                  onChange={(event) => setRemoveAll(event.target.checked)}
                />
              )}
            </fieldset>
            {(validation || mutation.error) && (
              <Alert>
                {validation
                  ? errorText(validation)
                  : mutation.error
                    ? errorText(mutation.error)
                    : ''}
              </Alert>
            )}
          </>
        )}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={setReview}
        title={t('serviceEditors.apply')}
        description={t('serviceEditors.applyDescription', {
          name: resource.name || resource.id,
          count: rows.length,
          environment: app.project?.name || '',
        })}
        busy={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      >
        <h3>{t('serviceEditors.before', { count: original.length })}</h3>
        <ul>
          {original.map((row) => (
            <li key={row.key}>
              {t('serviceEditors.summary', {
                target: display(row.serviceId),
                alias: row.name || t('serviceEditors.serviceName'),
              })}
            </li>
          ))}
        </ul>
        <h3>{t('serviceEditors.after', { count: rows.length })}</h3>
        <ul>
          {rows.map((row) => (
            <li key={row.key}>
              {t('serviceEditors.summary', {
                target: display(row.serviceId),
                alias: row.name || t('serviceEditors.serviceName'),
              })}
            </li>
          ))}
        </ul>
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('serviceEditors.discard')}
        description={t('serviceEditors.discardDescription')}
        onConfirm={onClose}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('serviceEditors.context')}
        description={t('serviceEditors.contextDescription')}
        busy={mutation.isPending}
        onConfirm={() => {
          if (!mutation.isPending && blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}
