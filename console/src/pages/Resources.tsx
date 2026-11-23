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
        throw new Error('Sua permissão de alteração não está mais disponível.');
      try {
        if (dataKind === 'certificate' && editor === 'edit' && !replaceCertificate) {
          const latest = await api<Resource>(resource!.links.self);
          if (typeof latest.cert !== 'string' || !latest.cert.includes('BEGIN CERTIFICATE'))
            throw new Error(
              'O certificado atual não está disponível. Recarregue o recurso antes de editar.',
            );
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
        if (dataKind && error instanceof ApiError)
          throw new ApiError(
            error.status,
            `Não foi possível salvar o recurso (HTTP ${error.status}). Confira os campos e suas permissões.`,
          );
        throw error;
      }
    },
    onSuccess: async (output) => {
      const created = editor === 'new';
      setDirty(false);
      setEditor(null);
      await client.invalidateQueries({ queryKey: ['data', app.identity] });
      toast('Alteração recebida pelo Rancher. Acompanhe o estado do recurso.');
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
      if (!url) throw new Error('A operação não está mais disponível para este recurso.');
      const output = await api<Resource>(url, payload);
      return dataKind ? dataResourceMetadata(output) : output;
    },
    onSuccess: async () => {
      setDirty(false);
      setAction(null);
      await client.invalidateQueries({ queryKey: ['data', app.identity] });
      toast('Operação recebida. O estado será atualizado pelo servidor.');
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
        title="Selecione um environment"
        description="Escolha um ambiente autorizado para consultar seus recursos."
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
        title="Recurso indisponível"
        description="A API não disponibilizou este recurso para sua conta neste contexto."
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
        title={resource?.name || resource?.id || item.title}
        description={
          resource
            ? `${item.title} · ${scoped ? app.project?.name || 'Instância' : 'Instância'}`
            : item.description
        }
        eyebrow={scoped ? app.project?.name : undefined}
        action={
          <>
            {!resource &&
              item.schema === 'project' &&
              schemas.data?.projectTemplate?.collectionMethods?.includes('GET') && (
                <Button onClick={() => setTemplates(true)}>
                  <Layers3 size={16} />
                  Templates
                </Button>
              )}
            {resource ? (
              <>
                <Button onClick={() => navigate(item.path)}>
                  <ArrowLeft size={16} />
                  Voltar
                </Button>
                {item.schema === 'project' && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      app.setProject(resource.id);
                      navigate(`/?env=${resource.id}`);
                    }}
                  >
                    Abrir environment
                  </Button>
                )}
                {schema.resourceMethods?.includes('PUT') && (
                  <Button variant="primary" onClick={() => setEditor('edit')}>
                    Editar
                  </Button>
                )}
              </>
            ) : (
              createAllowed && (
                <Button variant="primary" onClick={() => setEditor('new')}>
                  <Plus size={16} />
                  Criar {fieldLabel(item.schema || 'recurso').toLocaleLowerCase()}
                </Button>
              )
            )}
            <Button aria-label="Atualizar dados" onClick={() => void query.refetch()}>
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
                  <Button onClick={() => setStream('metrics')}>Métricas</Button>
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
                      ? 'Atualizar infraestrutura'
                      : fieldLabel(name)}
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
                <h2>Recursos relacionados</h2>
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
              Mostrar também discos dos containers e bind mounts
            </label>
          )}
          <DataTable
            rows={dataKind === 'volume' && !showInternalVolumes ? rows.filter(isNamedVolume) : rows}
            rowKey={(r) => r.id}
            searchText={(r) =>
              `${r.name || ''} ${r.id} ${r.state || ''} ${r.description || ''} ${r.serverAddress || ''} ${r.CN || ''} ${r.driver || ''} ${r.hostId || ''}`
            }
            emptyTitle={`Nenhum registro em ${item.title.toLocaleLowerCase()}`}
            emptyDescription="Os dados aparecerão aqui quando houver recursos disponíveis neste contexto."
            columns={[
              {
                key: 'name',
                label: 'Nome',
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
                label: 'Estado',
                sortValue: (r) => r.state || '',
                render: (r) => <Badge state={r.state}>{r.state || '—'}</Badge>,
              },
              {
                key: 'description',
                label: 'Descrição',
                render: (r) => <span className="muted">{r.description || '—'}</span>,
              },
              ...dataColumns(dataKind),
              {
                key: 'open',
                label: 'Detalhes',
                render: (r) => (
                  <Link
                    className="button ghost"
                    aria-label={`Abrir ${r.name || r.id}`}
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
              Esta coleção possui mais resultados no servidor. A busca atual se limita aos registros
              carregados.{' '}
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
                Carregar mais
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
            ? `Editar ${resource?.name || resource?.id}`
            : `Criar ${fieldLabel(item.schema || 'recurso').toLocaleLowerCase()}`
        }
        description={`Contexto: ${scoped ? app.project?.name : 'instância'}. Revise os campos antes de salvar.`}
        footer={
          <>
            <Button onClick={closeForm} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button form="resource-form" type="submit" variant="primary" busy={save.isPending}>
              Salvar
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
                Substituir certificado e chave privada
              </label>
            )}
            {dataKind === 'secret' && (
              <Alert tone="info">
                O valor do secret é definido somente na criação. Para substituí-lo, crie outro
                secret e atualize os vínculos nos serviços.
              </Alert>
            )}
            {dataKind === 'registry' && editor === 'new' && (
              <Alert tone="info">
                Após salvar o endereço, você poderá cadastrar as credenciais de acesso no painel do
                registry.
              </Alert>
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
                error={save.error}
                onDirtyChange={setDirty}
              />
            ) : (
              <SchemaForm
                key={`${editor}-${resource?.id || 'new'}-${replaceCertificate}`}
                schema={
                  dataKind
                    ? dataEditorSchema(schema, editor === 'edit', replaceCertificate)
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
                error={save.error}
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
        title={`${fieldLabel(action || 'Operação')}: ${resource?.name || resource?.id}`}
        description={`Confira o alvo e o impacto. Contexto: ${app.project?.name || 'instância'}.`}
        footer={
          <>
            <Button onClick={closeForm} disabled={run.isPending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              busy={run.isPending}
              type={actionSchema ? 'submit' : 'button'}
              form={actionSchema ? 'action-form' : undefined}
              onClick={actionSchema ? undefined : () => run.mutate({})}
            >
              Confirmar operação
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
            error={run.error}
            onDirtyChange={setDirty}
          />
        ) : (
          <>
            <Alert tone="warning">
              A operação será executada pelo Rancher sobre este recurso. O resultado deve ser
              acompanhado pelo estado retornado.
            </Alert>
            {run.error && <Alert>{run.error.message}</Alert>}
          </>
        )}
      </Modal>
      <Confirm
        open={certificateMode !== null}
        onOpenChange={(open) => {
          if (!open) setCertificateMode(null);
        }}
        title="Trocar o modo de edição?"
        description="As alterações ainda não salvas deste formulário serão descartadas."
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
        title="Descartar rascunho?"
        description="Há alterações que ainda não foram salvas."
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
        title="Sair sem salvar?"
        description="As alterações deste formulário serão descartadas."
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
      <Modal
        open={blocker.state === 'blocked' && pending}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Operação em andamento"
        description="Aguarde a resposta do Rancher antes de trocar de contexto."
        footer={
          <Button
            onClick={() => {
              if (blocker.state === 'blocked') blocker.reset();
            }}
          >
            Permanecer nesta tela
          </Button>
        }
      >
        {null}
      </Modal>
    </>
  );
}
function dataColumns(kind?: string): Column<Resource>[] {
  if (kind === 'certificate')
    return [
      {
        key: 'CN',
        label: 'Nome comum',
        sortValue: (r) => String(r.CN || ''),
        render: (r) => String(r.CN || '—'),
      },
      {
        key: 'expiresAt',
        label: 'Validade',
        sortValue: (r) => resourceDate(r.expiresAt) || 0,
        render: (r) => (
          <>
            <span>{formatResourceDate(r.expiresAt)}</span>{' '}
            <Badge state={certificateValidity(r.expiresAt).state}>
              {certificateValidity(r.expiresAt).label}
            </Badge>
          </>
        ),
      },
    ];
  if (kind === 'registry')
    return [
      {
        key: 'address',
        label: 'Servidor',
        sortValue: (r) => String(r.serverAddress || ''),
        render: (r) => String(r.serverAddress || '—'),
      },
    ];
  if (kind === 'volume')
    return [
      { key: 'driver', label: 'Driver', render: (r) => String(r.driver || '—') },
      { key: 'host', label: 'Host', render: (r) => String(r.hostId || '—') },
    ];
  if (kind === 'secret')
    return [
      {
        key: 'created',
        label: 'Criado em',
        sortValue: (r) => resourceDate(r.created) || 0,
        render: (r) => formatResourceDate(r.created),
      },
    ];
  return [
    {
      key: 'type',
      label: 'Tipo',
      render: (r) => <span className="muted">{fieldLabel(r.type)}</span>,
    },
  ];
}
function RelatedCollection({ name, url }: { name: string; url: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: useDataKey('related', url),
    queryFn: async ({ signal }) => {
      const result = await api<Collection<Resource> | Resource>(url, undefined, undefined, signal);
      if (Array.isArray(result.data)) return { data: result.data.map(dataResourceMetadata) };
      if ('id' in result && typeof result.id === 'string')
        return { data: [dataResourceMetadata(result as Resource)] };
      throw new Error('O Rancher não retornou um recurso ou uma coleção válida.');
    },
    enabled: open,
    retry: 1,
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        {fieldLabel(name)}
        <ArrowRight size={15} />
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={fieldLabel(name)}
        description="Recursos relacionados retornados pelo servidor."
      >
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} />
        ) : Array.isArray(query.data?.data) ? (
          <DataTable
            rows={query.data.data}
            rowKey={(r) => r.id}
            columns={[
              { key: 'name', label: 'Nome', render: (r) => r.name || r.id },
              {
                key: 'state',
                label: 'Estado',
                render: (r) => <Badge state={r.state}>{r.state || '—'}</Badge>,
              },
            ]}
          />
        ) : (
          <Alert tone="info">Este vínculo não retorna uma coleção navegável.</Alert>
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
  const app = useApp();
  const types = [
    ['hosts', 'Hosts', Server],
    ['containers', 'Containers', Box],
    ['stacks', 'Stacks', Layers3],
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
          title="Sua console"
          description="Selecione ou crie um environment para começar."
        />
        <Empty
          title="Nenhum environment disponível"
          description="Os recursos serão apresentados conforme seus ambientes e permissões."
          action={
            <Link className="button primary" to="/environments">
              Ver environments
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
        description="Uma visão dos recursos disponíveis no environment selecionado."
        eyebrow="VISÃO GERAL"
        action={
          <Button onClick={() => void query.refetch()}>
            <RefreshCw size={16} />
            Atualizar
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
                  : (query.data?.[index].rows.length ?? '—')}
              </strong>
              <small>
                {query.data?.[index].disabled
                  ? 'Módulo desativado'
                  : query.data?.[index].error
                    ? 'Não foi possível consultar'
                    : 'Recursos neste environment'}
              </small>
            </div>
            <div className="metric-icon">
              <Icon size={22} />
            </div>
          </div>
        ))}
        <div className="metric">
          <div>
            <p>Estado do environment</p>
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
          <h2>Contexto do ambiente</h2>
          <Badge state={app.project.state}>{app.project.state}</Badge>
        </div>
        <dl className="details-grid">
          <div>
            <dt>Nome</dt>
            <dd>{app.project.name}</dd>
          </div>
          <div>
            <dt>ID</dt>
            <dd>{app.project.id}</dd>
          </div>
          <div>
            <dt>Seu perfil</dt>
            <dd>{app.admin ? 'Administrador' : 'Usuário'}</dd>
          </div>
          <div>
            <dt>Origem das permissões</dt>
            <dd>Regras do Rancher e grupos locais</dd>
          </div>
        </dl>
        <Alert tone="info">
          Alterar o environment atualiza os recursos apresentados nas telas da console.
        </Alert>
      </section>
      {query.error && <ErrorState error={query.error} />}
    </>
  );
}
