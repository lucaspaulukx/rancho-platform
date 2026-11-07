import { useI18n } from '../i18n/provider';
import { ptSchemaForm } from '../i18n/domains/schema-form';
import { localizedNavigation } from '../navigation';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Box, Layers3, Plus, RefreshCw, Server } from 'lucide-react';
import { allPages, api, ApiError, type Collection, type Resource } from '../api';
import { useApp, useDataKey } from '../state';
import { publicWorkload } from '../workload-privacy';
import type { NavItem } from '../navigation';
import {
  Alert,
  Badge,
  Button,
  Confirm,
  DataTable,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  useToast,
  type Column,
} from '../components/ui';
import { SchemaForm, fieldLabel } from '../components/SchemaForm';
import { useSchemas } from '../hooks/useSchemas';
import { ResourceStream } from '../components/ResourceStream';
import { ResourceDetails } from '../components/ResourceDetails';
import { WorkloadChildren, WorkloadList } from './Workloads';
import { isUserAction } from '../resource-actions';
import {
  dataEditorSchema,
  dataResourceMetadata,
  isDataKind,
  isNamedVolume,
  prepareDataPayload,
} from '../data-resources';
import { useDataReferences } from '../hooks/useDataReferences';
import { EnvironmentEditor, EnvironmentResources } from '../components/EnvironmentEditor';
const NetworkPolicies = lazy(() =>
  import('../components/NetworkPolicies').then((module) => ({ default: module.NetworkPolicies })),
);
const EnvironmentTemplates = lazy(() =>
  import('../components/EnvironmentTemplates').then((module) => ({
    default: module.EnvironmentTemplates,
  })),
);
import { metricsLink, serviceMetricsEnabled } from '../metrics';
const ResourceMetrics = lazy(() =>
  import('../components/ResourceMetrics').then((module) => ({ default: module.ResourceMetrics })),
);
import { certificateValidity, formatResourceDate, resourceDate } from '../resource-format';
const RegistryCredentials = lazy(() =>
  import('../components/RegistryCredentials').then((module) => ({
    default: module.RegistryCredentials,
  })),
);
const OperationsPage = lazy(() =>
  import('./Operations').then((module) => ({ default: module.OperationsPage })),
);

type ResourceErrorKey =
  | 'resourcesPage.permission'
  | 'resourcesPage.certificateUnavailable'
  | 'resourcesPage.operationUnavailable'
  | 'resourcesPage.invalidRelated';
class ResourcePageError extends Error {
  constructor(readonly key: ResourceErrorKey) {
    super(key);
  }
}
class ResourceSaveError extends Error {
  constructor(readonly status: number) {
    super('resourcesPage.saveFailed');
  }
}
function useResourceLabels() {
  const { t } = useI18n();
  return (name: string) => {
    const exact = `schemaForm.label.${name}`;
    const lower = `schemaForm.label.${name.toLowerCase()}`;
    type Key = Extract<keyof typeof ptSchemaForm, `schemaForm.label.${string}`>;
    const key = Object.hasOwn(ptSchemaForm, exact)
      ? (exact as Key)
      : Object.hasOwn(ptSchemaForm, lower)
        ? (lower as Key)
        : undefined;
    return key ? t(key) : fieldLabel(name);
  };
}
export function ResourcePage({ item }: { item: NavItem }) {
  const app = useApp();
  const params = useParams();
  if (
    app.config.modules.contextActions &&
    !params.id &&
    ['stack', 'service', 'container'].includes(item.schema || '')
  ) {
    const initialView =
      item.schema === 'service'
        ? 'services'
        : item.schema === 'container'
          ? 'containers'
          : 'stacks';
    return (
      <Suspense fallback={<Loading />}>
        <OperationsPage
          key={`${app.identity}:${app.project?.id}:${item.path}`}
          initialView={initialView}
        />
      </Suspense>
    );
  }
  return <ResourceContext item={item} />;
}
function ResourceContext({ item }: { item: NavItem }) {
  const { t, locale } = useI18n();
  const label = useResourceLabels();
  const pageItem = localizedNavigation(t).find((entry) => entry.path === item.path) || item;
  const errorText = (error: Error) =>
    error instanceof ResourceSaveError
      ? t('resourcesPage.saveFailed', { status: error.status })
      : error instanceof ResourcePageError
        ? t(error.key)
        : error.message;
  const app = useApp();
  const client = useQueryClient();
  const toast = useToast();
  const params = useParams();
  const navigate = useNavigate();
  const [dirty, setDirty] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [externalPending, setExternalPending] = useState(false);
  const [showInternalVolumes, setShowInternalVolumes] = useState(false);
  const [replaceCertificate, setReplaceCertificate] = useState(false);
  const [certificateMode, setCertificateMode] = useState<boolean | null>(null);
  const [nextRoute, setNextRoute] = useState<string | null>(null);
  function closeForm() {
    if (pending) return;
    if (dirty) setDiscard(true);
    else {
      setEditor(null);
      setAction(null);
      save.reset();
      run.reset();
    }
  }
  const [editor, setEditor] = useState<'new' | 'edit' | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [stream, setStream] = useState<'logs' | 'execute' | 'metrics' | null>(null);
  useEffect(() => {
    setEditor(null);
    setTemplates(false);
    setAction(null);
    setStream(null);
    setDirty(false);
    setReplaceCertificate(false);
    setCertificateMode(null);
    setExternalPending(false);
    setShowInternalVolumes(false);
    setDiscard(false);
    save.reset();
    run.reset();
  }, [app.project?.id, item.path, params.id]);
  const scoped = !!item.scoped;
  const workloadKind = ['stacks', 'services', 'containers'].includes(item.collection || '')
    ? (item.collection as 'stacks' | 'services' | 'containers')
    : undefined;
  const schemas = useSchemas(scoped);
  const schema = schemas.data?.[item.schema || ''];
  const dataKind = isDataKind(item.schema) ? item.schema : undefined;
  const references = useDataReferences(
    dataKind === 'volume' && !!editor && !!schemas.data,
    schemas.data || {},
  );
  const collection = schema?.links.collection;
  const key = useDataKey(item.path, params.id || 'list');
  const query = useQuery<Collection<Resource> | Resource>({
    queryKey: key,
    queryFn: async ({ signal }) =>
      params.id
        ? await api<Resource>(
            `${collection}/${encodeURIComponent(params.id)}`,
            undefined,
            undefined,
            signal,
          ).then((value) => (dataKind ? dataResourceMetadata(value) : publicWorkload(value)))
        : allPages<Resource>(`${collection}?limit=100`, signal).then((data) => ({
            data: dataKind ? data.map(dataResourceMetadata) : data.map(publicWorkload),
          })),
    enabled: !!collection && (!!params.id || !workloadKind),
    refetchInterval: 15_000,
    retry: 1,
  });
  const resource = params.id ? (query.data as Resource | undefined) : undefined;
  const save = useMutation({
    gcTime: 0,
    mutationFn: async (payload: Record<string, unknown>) => {
      const body =
        dataKind && schema
          ? prepareDataPayload(dataKind, payload, schema, editor === 'edit', replaceCertificate)
          : payload;
      const current = await api<import('../api').Schema>(schema!.links.self);
      if (
        editor === 'edit'
          ? !current.resourceMethods?.includes('PUT')
          : !current.collectionMethods?.includes('POST')
      )
        throw new ResourcePageError('resourcesPage.permission');
      try {
        if (dataKind === 'certificate' && editor === 'edit' && !replaceCertificate) {
          const latest = await api<Resource>(resource!.links.self);
          if (typeof latest.cert !== 'string' || !latest.cert.includes('BEGIN CERTIFICATE'))
            throw new ResourcePageError('resourcesPage.certificateUnavailable');
          // Rancher 1.6 reparses certificate metadata on every PUT, including description edits.
          body.cert = latest.cert;
        }
        const output = await api<Resource>(
          editor === 'edit' ? resource!.links.self : current.links.collection,
          body,
          editor === 'edit' ? 'PUT' : 'POST',
        );
        return dataKind ? dataResourceMetadata(output) : output;
      } catch (error) {
        if (dataKind && error instanceof ApiError) throw new ResourceSaveError(error.status);
        throw error;
      }
    },
    onSuccess: async (output) => {
      const created = editor === 'new';
      setDirty(false);
      setEditor(null);
      await client.invalidateQueries({ queryKey: ['data', app.identity] });
      toast(t('resourcesPage.saved'));
      save.reset();
      if (created && (dataKind || item.schema === 'project'))
        setNextRoute(`${item.path}/${output.id}${scoped ? `?env=${app.project?.id}` : ''}`);
    },
  });
  const run = useMutation({
    gcTime: 0,
    mutationFn: async (payload: Record<string, unknown>) => {
      const current = await api<Resource>(resource!.links.self);
      const url = current.actions?.[action!];
      if (!url) throw new ResourcePageError('resourcesPage.operationUnavailable');
      const output = await api<Resource>(url, payload);
      return dataKind ? dataResourceMetadata(output) : output;
    },
    onSuccess: async () => {
      setDirty(false);
      setAction(null);
      await client.invalidateQueries({ queryKey: ['data', app.identity] });
      toast(t('resourcesPage.operationReceived'));
      run.reset();
    },
  });
  const pending = save.isPending || run.isPending || externalPending;
  const blocker = useBlocker(dirty || pending);
  usePageLeaveGuard(dirty || pending, !!app.config?.modules.unsavedChangesGuard);
  useEffect(() => {
    if (!pending && !dirty && blocker.state === 'blocked') blocker.reset();
  }, [pending, dirty, blocker]);
  useEffect(() => {
    if (nextRoute && !pending && !dirty && blocker.state !== 'blocked') {
      setNextRoute(null);
      navigate(nextRoute);
    }
  }, [nextRoute, pending, dirty, blocker.state, navigate]);
  if (scoped && !app.project)
    return (
      <Empty
        title={t('resourcesPage.selectEnvironment')}
        description={t('resourcesPage.selectDescription')}
      />
    );
  if (schemas.isPending || (query.isPending && !!collection && (!!params.id || !workloadKind)))
    return <Loading />;
  if (schemas.error || query.error)
    return (
      <ErrorState
        error={schemas.error || query.error}
        retry={() => {
          void schemas.refetch();
          void query.refetch();
        }}
      />
    );
  if (!schema || !collection)
    return (
      <Empty
        title={t('resourcesPage.unavailable')}
        description={t('resourcesPage.unavailableDescription')}
      />
    );
  const rows = !params.id ? (query.data as Collection<Resource> | undefined)?.data || [] : [];
  const actionSchema = action
    ? schemas.data?.[schema.resourceActions?.[action]?.input || '']
    : undefined;
  const createAllowed =
    schema.collectionMethods?.includes('POST') &&
    (item.schema !== 'project' || !app.server.effective.ENV_CREATION_ADMIN_ONLY || app.admin);
  return (
    <>
      <PageHeader
        title={resource?.name || resource?.id || pageItem.title}
        description={
          resource
            ? `${pageItem.title} · ${scoped ? app.project?.name || t('resourcesPage.instance') : t('resourcesPage.instance')}`
            : pageItem.description
        }
        eyebrow={scoped ? app.project?.name : undefined}
        action={
          <>
            {!resource &&
              item.schema === 'project' &&
              schemas.data?.projectTemplate?.collectionMethods?.includes('GET') && (
                <Button onClick={() => setTemplates(true)}>
                  <Layers3 size={16} />
                  {t('resourcesPage.templates')}
                </Button>
              )}
            {resource ? (
              <>
                <Button onClick={() => navigate(item.path)}>
                  <ArrowLeft size={16} />
                  {t('resourcesPage.back')}
                </Button>
                {item.schema === 'project' && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      app.setProject(resource.id);
                      navigate(`/?env=${resource.id}`);
                    }}
                  >
                    {t('resourcesPage.openEnvironment')}
                  </Button>
                )}
                {schema.resourceMethods?.includes('PUT') && (
                  <Button variant="primary" onClick={() => setEditor('edit')}>
                    {t('resourcesPage.edit')}
                  </Button>
                )}
              </>
            ) : (
              createAllowed && (
                <Button variant="primary" onClick={() => setEditor('new')}>
                  <Plus size={16} />
                  {t('resourcesPage.create', {
                    kind: label(item.schema || 'resource').toLocaleLowerCase(locale),
                  })}
                </Button>
              )
            )}
            <Button
              aria-label={t('resourcesPage.refreshData')}
              onClick={() => void query.refetch()}
            >
              <RefreshCw size={16} />
            </Button>
          </>
        }
      />
      {templates && schemas.data?.projectTemplate && (
        <Suspense fallback={<Loading />}>
          <EnvironmentTemplates
            key={`${app.identity}:${app.project?.id || ''}`}
            schema={schemas.data.projectTemplate}
            onClose={() => setTemplates(false)}
          />
        </Suspense>
      )}
      {resource ? (
        <>
          <div className="resource-summary panel">
            <Badge state={resource.state}>{resource.state || '—'}</Badge>
            <span className="muted">{resource.id}</span>
            <div className="resource-actions">
              {app.config.modules.observability &&
                app.config.modules.metrics &&
                metricsLink(resource, serviceMetricsEnabled(app.config.modules)) && (
                  <Button onClick={() => setStream('metrics')}>{t('resourcesPage.metrics')}</Button>
                )}
              {Object.keys(resource.actions || {})
                .filter(
                  (name) =>
                    isUserAction(name) &&
                    (!['logs', 'execute'].includes(name) || app.config.modules.observability),
                )
                .map((name) => (
                  <Button
                    key={name}
                    onClick={() => {
                      if (name === 'logs' || name === 'execute') setStream(name);
                      else setAction(name);
                    }}
                  >
                    {item.schema === 'project' && name === 'upgrade'
                      ? t('resourcesPage.upgradeInfrastructure')
                      : label(name)}
                  </Button>
                ))}
            </div>
          </div>
          {app.config.modules.workloads &&
            ['stack', 'service', 'loadBalancerService', 'externalService', 'dnsService'].includes(
              resource.type,
            ) && <WorkloadChildren resource={resource} />}
          <ResourceDetails key={resource.id} resource={resource} schema={schema} />
          {item.schema === 'project' && <EnvironmentResources project={resource} />}
          {item.schema === 'project' && app.config.modules.networkPolicies && (
            <Suspense fallback={<Loading />}>
              <NetworkPolicies key={`${app.identity}:${resource.id}`} project={resource} />
            </Suspense>
          )}
          {resource.type === 'registry' && (
            <Suspense fallback={<Loading />}>
              <RegistryCredentials
                key={resource.id}
                registry={resource}
                onDirty={setDirty}
                onPending={setExternalPending}
              />
            </Suspense>
          )}
          {item.schema !== 'project' &&
            Object.keys(resource.links || {}).filter(
              (name) => !['self', 'collection'].includes(name),
            ).length > 0 && (
              <section className="panel" style={{ marginTop: 20 }}>
                <h2>{t('resourcesPage.related')}</h2>
                <div className="related-links">
                  {Object.entries(resource.links)
                    .filter(
                      ([name]) => !['self', 'collection'].includes(name) && !/stats$/i.test(name),
                    )
                    .map(([name, url]) => (
                      <RelatedCollection key={name} name={name} url={url} />
                    ))}
                </div>
              </section>
            )}
        </>
      ) : workloadKind ? (
        <WorkloadList kind={workloadKind} />
      ) : (
        <>
          {dataKind === 'volume' && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={showInternalVolumes}
                onChange={(event) => setShowInternalVolumes(event.target.checked)}
              />
              {t('resourcesPage.showVolumes')}
            </label>
          )}
          <DataTable
            rows={dataKind === 'volume' && !showInternalVolumes ? rows.filter(isNamedVolume) : rows}
            rowKey={(r) => r.id}
            searchText={(r) =>
              `${r.name || ''} ${r.id} ${r.state || ''} ${r.description || ''} ${r.serverAddress || ''} ${r.CN || ''} ${r.driver || ''} ${r.hostId || ''}`
            }
            emptyTitle={t('resourcesPage.emptyTitle', {
              title: pageItem.title.toLocaleLowerCase(locale),
            })}
            emptyDescription={t('resourcesPage.emptyDescription')}
            columns={[
              {
                key: 'name',
                label: t('resourcesPage.name'),
                sortValue: (r) => r.name || r.id,
                render: (r) => (
                  <Link
                    className="row-title"
                    to={`${item.path}/${encodeURIComponent(r.id)}${scoped ? `?env=${app.project?.id}` : ''}`}
                  >
                    <span className="row-title-icon">
                      <item.icon size={18} />
                    </span>
                    <div>
                      <strong>{r.name || r.id}</strong>
                      <small>{r.id}</small>
                    </div>
                  </Link>
                ),
              },
              {
                key: 'state',
                label: t('resourcesPage.state'),
                sortValue: (r) => r.state || '',
                render: (r) => <Badge state={r.state}>{r.state || '—'}</Badge>,
              },
              {
                key: 'description',
                label: t('resourcesPage.description'),
                render: (r) => <span className="muted">{r.description || '—'}</span>,
              },
              ...dataColumns(dataKind, t, locale, label),
              {
                key: 'open',
                label: t('resourcesPage.details'),
                render: (r) => (
                  <Link
                    className="button ghost"
                    aria-label={t('resourcesPage.open', { name: r.name || r.id })}
                    to={`${item.path}/${encodeURIComponent(r.id)}${scoped ? `?env=${app.project?.id}` : ''}`}
                  >
                    <ArrowRight size={16} />
                  </Link>
                ),
              },
            ]}
          />
          {(query.data as Collection<Resource> | undefined)?.pagination?.next && (
            <Alert tone="info">
              {t('resourcesPage.moreInfo')}{' '}
              <Button
                onClick={async () => {
                  const page = await api<Collection<Resource>>(
                    (query.data as Collection<Resource>).pagination!.next!,
                  );
                  client.setQueryData(key, (old: Collection<Resource>) => ({
                    ...page,
                    data: [...old.data, ...page.data],
                  }));
                }}
              >
                {t('resourcesPage.loadMore')}
              </Button>
            </Alert>
          )}
        </>
      )}
      {stream &&
        resource &&
        (stream === 'metrics' ? (
          <Suspense fallback={<Loading />}>
            <ResourceMetrics resource={resource} onClose={() => setStream(null)} />
          </Suspense>
        ) : (
          <ResourceStream
            key={`${resource.id}-${stream}`}
            resource={resource}
            mode={stream}
            onClose={() => setStream(null)}
          />
        ))}
      <Modal
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !save.isPending) closeForm();
        }}
        drawer
        title={
          editor === 'edit'
            ? t('resourcesPage.editTitle', { name: resource?.name || resource?.id || '' })
            : t('resourcesPage.create', {
                kind: label(item.schema || 'resource').toLocaleLowerCase(locale),
              })
        }
        description={t('resourcesPage.context', {
          name: (scoped ? app.project?.name : t('resourcesPage.instanceLower')) || '',
        })}
        footer={
          <>
            <Button onClick={closeForm} disabled={save.isPending}>
              {t('resourcesPage.cancel')}
            </Button>
            <Button form="resource-form" type="submit" variant="primary" busy={save.isPending}>
              {t('resourcesPage.save')}
            </Button>
          </>
        }
      >
        {editor && (
          <>
            {dataKind === 'certificate' && editor === 'edit' && (
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={replaceCertificate}
                  disabled={save.isPending}
                  onChange={(event) => {
                    if (dirty) setCertificateMode(event.target.checked);
                    else setReplaceCertificate(event.target.checked);
                  }}
                />
                {t('resourcesPage.replaceCertificate')}
              </label>
            )}
            {dataKind === 'secret' && <Alert tone="info">{t('resourcesPage.secretInfo')}</Alert>}
            {dataKind === 'registry' && editor === 'new' && (
              <Alert tone="info">{t('resourcesPage.registryInfo')}</Alert>
            )}
            {references.error && dataKind === 'volume' && (
              <ErrorState error={references.error} retry={() => void references.refetch()} />
            )}
            {item.schema === 'project' ? (
              <EnvironmentEditor
                key={`${editor}-${resource?.id || 'new'}`}
                schema={schema}
                schemas={schemas.data || {}}
                original={editor === 'edit' ? resource : undefined}
                onSubmit={(payload) => save.mutate(payload)}
                busy={save.isPending}
                error={save.error ? new Error(errorText(save.error)) : null}
                onDirtyChange={setDirty}
              />
            ) : (
              <SchemaForm
                key={`${editor}-${resource?.id || 'new'}-${replaceCertificate}`}
                schema={
                  dataKind
                    ? dataEditorSchema(schema, editor === 'edit', replaceCertificate, {
                        label: t('resourcesPage.secretContent'),
                        description: t('resourcesPage.secretContentHint'),
                      })
                    : schema
                }
                schemas={schemas.data || {}}
                original={
                  editor === 'edit'
                    ? dataKind === 'certificate' && replaceCertificate
                      ? { ...resource!, cert: undefined, key: undefined, certChain: undefined }
                      : resource
                    : undefined
                }
                references={references.data}
                onSubmit={(payload) => save.mutate(payload)}
                busy={save.isPending}
                error={save.error ? new Error(errorText(save.error)) : null}
                onDirtyChange={setDirty}
              />
            )}
          </>
        )}
      </Modal>
      <Modal
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !run.isPending) closeForm();
        }}
        title={`${action ? label(action) : t('resourcesPage.operation')}: ${resource?.name || resource?.id}`}
        description={t('resourcesPage.operationContext', {
          name: app.project?.name || t('resourcesPage.instanceLower'),
        })}
        footer={
          <>
            <Button onClick={closeForm} disabled={run.isPending}>
              {t('resourcesPage.cancel')}
            </Button>
            <Button
              variant="primary"
              busy={run.isPending}
              type={actionSchema ? 'submit' : 'button'}
              form={actionSchema ? 'action-form' : undefined}
              onClick={actionSchema ? undefined : () => run.mutate({})}
            >
              {t('resourcesPage.confirmOperation')}
            </Button>
          </>
        }
      >
        {actionSchema ? (
          <SchemaForm
            id="action-form"
            key={action!}
            schema={actionSchema}
            schemas={schemas.data || {}}
            onSubmit={(payload) => run.mutate(payload)}
            busy={run.isPending}
            error={run.error ? new Error(errorText(run.error)) : null}
            onDirtyChange={setDirty}
          />
        ) : (
          <>
            <Alert tone="warning">{t('resourcesPage.operationInfo')}</Alert>
            {run.error && <Alert>{errorText(run.error)}</Alert>}
          </>
        )}
      </Modal>
      <Confirm
        open={certificateMode !== null}
        onOpenChange={(open) => {
          if (!open) setCertificateMode(null);
        }}
        title={t('resourcesPage.editMode')}
        description={t('resourcesPage.editModeDescription')}
        onConfirm={() => {
          setReplaceCertificate(certificateMode!);
          setCertificateMode(null);
          setDirty(false);
          save.reset();
        }}
      />
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('resourcesPage.discard')}
        description={t('resourcesPage.discardDescription')}
        onConfirm={() => {
          setDiscard(false);
          setDirty(false);
          setEditor(null);
          setAction(null);
          save.reset();
          run.reset();
        }}
      />
      <Confirm
        open={blocker.state === 'blocked' && !pending}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('resourcesPage.leave')}
        description={t('resourcesPage.leaveDescription')}
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
      <Modal
        open={blocker.state === 'blocked' && pending}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('resourcesPage.pending')}
        description={t('resourcesPage.pendingDescription')}
        footer={
          <Button
            onClick={() => {
              if (blocker.state === 'blocked') blocker.reset();
            }}
          >
            {t('resourcesPage.stay')}
          </Button>
        }
      >
        {null}
      </Modal>
    </>
  );
}
function dataColumns(
  kind: string | undefined,
  t: ReturnType<typeof useI18n>['t'],
  locale: ReturnType<typeof useI18n>['locale'],
  label: (name: string) => string,
): Column<Resource>[] {
  if (kind === 'certificate')
    return [
      {
        key: 'CN',
        label: t('resourcesPage.commonName'),
        sortValue: (r) => String(r.CN || ''),
        render: (r) => String(r.CN || '—'),
      },
      {
        key: 'expiresAt',
        label: t('resourcesPage.validity'),
        sortValue: (r) => resourceDate(r.expiresAt) || 0,
        render: (r) => (
          <>
            <span>{formatResourceDate(r.expiresAt, locale)}</span>{' '}
            <Badge state={certificateValidity(r.expiresAt, Date.now(), t).state}>
              {certificateValidity(r.expiresAt, Date.now(), t).label}
            </Badge>
          </>
        ),
      },
    ];
  if (kind === 'registry')
    return [
      {
        key: 'address',
        label: t('resourcesPage.server'),
        sortValue: (r) => String(r.serverAddress || ''),
        render: (r) => String(r.serverAddress || '—'),
      },
    ];
  if (kind === 'volume')
    return [
      { key: 'driver', label: t('resourcesPage.driver'), render: (r) => String(r.driver || '—') },
      { key: 'host', label: t('resourcesPage.host'), render: (r) => String(r.hostId || '—') },
    ];
  if (kind === 'secret')
    return [
      {
        key: 'created',
        label: t('resourcesPage.created'),
        sortValue: (r) => resourceDate(r.created) || 0,
        render: (r) => formatResourceDate(r.created, locale),
      },
    ];
  return [
    {
      key: 'type',
      label: t('resourcesPage.type'),
      render: (r) => <span className="muted">{label(r.type)}</span>,
    },
  ];
}
function RelatedCollection({ name, url }: { name: string; url: string }) {
  const { t } = useI18n();
  const label = useResourceLabels();
  const errorText = (error: Error) =>
    error instanceof ResourcePageError ? t(error.key) : error.message;
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: useDataKey('related', url),
    queryFn: async ({ signal }) => {
      const result = await api<Collection<Resource> | Resource>(url, undefined, undefined, signal);
      if (Array.isArray(result.data)) return { data: result.data.map(dataResourceMetadata) };
      if ('id' in result && typeof result.id === 'string')
        return { data: [dataResourceMetadata(result as Resource)] };
      throw new ResourcePageError('resourcesPage.invalidRelated');
    },
    enabled: open,
    retry: 1,
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        {label(name)}
        <ArrowRight size={15} />
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={label(name)}
        description={t('resourcesPage.relatedDescription')}
      >
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={new Error(errorText(query.error))} />
        ) : Array.isArray(query.data?.data) ? (
          <DataTable
            rows={query.data.data}
            rowKey={(r) => r.id}
            columns={[
              { key: 'name', label: t('resourcesPage.name'), render: (r) => r.name || r.id },
              {
                key: 'state',
                label: t('resourcesPage.state'),
                render: (r) => <Badge state={r.state}>{r.state || '—'}</Badge>,
              },
            ]}
          />
        ) : (
          <Alert tone="info">{t('resourcesPage.notCollection')}</Alert>
        )}
      </Modal>
    </>
  );
}
export function Overview() {
  const app = useApp();
  return app.config.modules.workloads ? (
    <Suspense fallback={<Loading />}>
      <OperationsPage key={`${app.identity}-${app.project?.id}`} />
    </Suspense>
  ) : (
    <EnvironmentSummary />
  );
}
function EnvironmentSummary() {
  const { t, formats } = useI18n();
  const app = useApp();
  const types = [
    ['hosts', t('resourcesPage.hosts'), Server],
    ['containers', t('resourcesPage.containers'), Box],
    ['stacks', t('resourcesPage.stacks'), Layers3],
  ] as const;
  const query = useQuery({
    queryKey: useDataKey('overview', app.config.modules.hosts, app.config.modules.workloads),
    queryFn: async ({ signal }) => {
      const result = await Promise.allSettled(
        types.map(([type]) =>
          (type === 'hosts' ? app.config.modules.hosts : app.config.modules.workloads)
            ? allPages<Resource>(`projects/${app.project!.id}/${type}?limit=100`, signal)
            : Promise.resolve(null),
        ),
      );
      return result.map((value) =>
        value.status === 'fulfilled'
          ? { rows: value.value || [], disabled: value.value === null, error: null }
          : { rows: [], disabled: false, error: value.reason as Error },
      );
    },
    enabled: !!app.project,
    refetchInterval: 30_000,
  });
  if (!app.project)
    return (
      <>
        <PageHeader
          title={t('resourcesPage.console')}
          description={t('resourcesPage.startDescription')}
        />
        <Empty
          title={t('resourcesPage.noEnvironment')}
          description={t('resourcesPage.noEnvironmentDescription')}
          action={
            <Link className="button primary" to="/environments">
              {t('resourcesPage.viewEnvironments')}
            </Link>
          }
        />
      </>
    );
  if (query.isPending) return <Loading />;
  return (
    <>
      <PageHeader
        title={app.project.name}
        description={t('resourcesPage.overviewDescription')}
        eyebrow={t('resourcesPage.overview')}
        action={
          <Button onClick={() => void query.refetch()}>
            <RefreshCw size={16} />
            {t('resourcesPage.refresh')}
          </Button>
        }
      />
      <div className="metric-grid">
        {types.map(([type, label, Icon], index) => (
          <div className="metric" key={type}>
            <div>
              <p>{label}</p>
              <strong>
                {query.data?.[index].disabled || query.data?.[index].error
                  ? '—'
                  : query.data?.[index]
                    ? formats.number(query.data[index].rows.length)
                    : '—'}
              </strong>
              <small>
                {query.data?.[index].disabled
                  ? t('resourcesPage.moduleDisabled')
                  : query.data?.[index].error
                    ? t('resourcesPage.queryFailed')
                    : t('resourcesPage.environmentResources')}
              </small>
            </div>
            <div className="metric-icon">
              <Icon size={22} />
            </div>
          </div>
        ))}
        <div className="metric">
          <div>
            <p>{t('resourcesPage.environmentState')}</p>
            <strong style={{ fontSize: 21 }}>{app.project.state}</strong>
            <small>{app.project.orchestration || 'Rancher'}</small>
          </div>
          <div className="metric-icon">
            <Layers3 size={22} />
          </div>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>{t('resourcesPage.environmentContext')}</h2>
          <Badge state={app.project.state}>{app.project.state}</Badge>
        </div>
        <dl className="details-grid">
          <div>
            <dt>{t('resourcesPage.name')}</dt>
            <dd>{app.project.name}</dd>
          </div>
          <div>
            <dt>{t('resourcesPage.id')}</dt>
            <dd>{app.project.id}</dd>
          </div>
          <div>
            <dt>{t('resourcesPage.profile')}</dt>
            <dd>{app.admin ? t('resourcesPage.admin') : t('resourcesPage.user')}</dd>
          </div>
          <div>
            <dt>{t('resourcesPage.permissionSource')}</dt>
            <dd>{t('resourcesPage.permissionRules')}</dd>
          </div>
        </dl>
        <Alert tone="info">{t('resourcesPage.environmentHint')}</Alert>
      </section>
      {query.error && <ErrorState error={query.error} />}
    </>
  );
}
