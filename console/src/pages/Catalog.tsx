import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, RefreshCw } from 'lucide-react';
import { allPages, api, type Resource, type Schema } from '../api';
import {
  catalogDefaults,
  catalogPath,
  catalogQuestions,
  categories,
  prepareCatalogStack,
  type CatalogChoice,
  type CatalogQuestion,
  type CatalogReferences,
  type CatalogTemplate,
  type CatalogVersion,
} from '../catalog';
import { useApp, useDataKey } from '../state';
import { canManageResource, useSchemas } from '../hooks/useSchemas';
import { useActionScope } from '../hooks/useActionScope';
import {
  catalogReference,
  catalogStackSnapshot,
  catalogUpgradeDefaults,
  prepareCatalogUpgrade,
} from '../catalog-upgrade';
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
  PageHeader,
  Tabs,
  useToast,
} from '../components/ui';
import { ResourcePanel } from '../components/ResourcePanel';
import { sensitiveField } from '../components/SchemaForm';
import { EnvironmentCatalogs } from '../components/EnvironmentCatalogs';
import { environmentRepositoryMetadata } from '../environment-catalogs';
import { useEnvironmentCatalogAccess } from '../hooks/useEnvironmentCatalogAccess';

export function CatalogPage() {
  const app = useApp();
  return <CatalogContext key={`${app.identity}-${app.project?.id}`} />;
}
function CatalogContext() {
  const app = useApp();
  const repositoryAccess = useEnvironmentCatalogAccess();
  const [params, setParams] = useSearchParams();
  const [opened, setOpened] = useState<CatalogTemplate | null>(null);
  const [created, setCreated] = useState<Resource | null>(null);
  const [repositories, setRepositories] = useState(false);
  const source = params.get('catalog') || '';
  const category = params.get('category') || '';
  const includeInfra = params.get('infra') === 'true';
  const query = useQuery({
    queryKey: useDataKey('catalog-list'),
    queryFn: async ({ signal }) => {
      const headers = { 'X-Api-Project-Id': app.project!.id };
      const [catalogs, templates] = await Promise.all([
        allPages<Resource>('/v1-catalog/catalogs', signal, headers),
        allPages<CatalogTemplate>('/v1-catalog/templates?rancherVersion=v1.6.30', signal, headers),
      ]);
      return { catalogs: catalogs.map(environmentRepositoryMetadata), templates };
    },
    enabled: !!app.project,
    staleTime: 60_000,
  });
  const cattle = !app.project?.orchestration || app.project.orchestration === 'cattle';
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  if (!app.project)
    return (
      <Empty
        title="Selecione um environment"
        description="Escolha o environment no qual deseja consultar o catálogo."
      />
    );
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const templates = query.data.templates.filter(
    (template) =>
      (!source || template.catalogId === source) &&
      (!category || categories(template).includes(category)) &&
      (!template.templateBase || (includeInfra && template.templateBase === 'infra')),
  );
  const categoryOptions = [...new Set(query.data.templates.flatMap(categories))].sort();
  return (
    <>
      <PageHeader
        title="Catálogo"
        eyebrow={app.project.name}
        description="Escolha uma aplicação, revise a versão e configure sua stack."
        action={
          <>
            {repositoryAccess.allowed && (
              <Button onClick={() => setRepositories(true)}>Fontes do environment</Button>
            )}
            <Button busy={query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCw size={16} />
              Atualizar listagem
            </Button>
          </>
        }
      />
      {!cattle && (
        <Alert tone="info">
          O lançamento de templates nesta console está disponível para environments Cattle. Você
          pode consultar as versões e seus arquivos.
        </Alert>
      )}
      <div className="catalog-filters">
        <Field label="Catálogo">
          {(id) => (
            <select
              id={id}
              value={source}
              onChange={(event) => filter('catalog', event.target.value)}
            >
              <option value="">Todos os catálogos</option>
              {query.data.catalogs.map((catalog) => (
                <option key={catalog.id} value={catalog.id}>
                  {catalog.name || catalog.id}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Categoria">
          {(id) => (
            <select
              id={id}
              value={category}
              onChange={(event) => filter('category', event.target.value)}
            >
              <option value="">Todas as categorias</option>
              {categoryOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          )}
        </Field>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={includeInfra}
            onChange={(event) => filter('infra', event.target.checked ? 'true' : '')}
          />
          Incluir templates de infraestrutura
        </label>
      </div>
      <DataTable
        rows={templates}
        rowKey={(template) => template.id}
        searchText={(template) =>
          `${template.name || ''} ${template.id} ${template.description || ''} ${categories(template).join(' ')}`
        }
        emptyTitle="Nenhum template disponível"
        emptyDescription="Confira os filtros e a disponibilidade dos catálogos neste environment."
        columns={[
          {
            key: 'name',
            label: 'Aplicação',
            sortValue: (template) => template.name || template.id,
            render: (template) => (
              <button className="catalog-title" onClick={() => setOpened(template)}>
                <BookOpen size={22} />
                <span>
                  <strong>{template.name || template.id}</strong>
                  <small>{template.description || template.id}</small>
                </span>
              </button>
            ),
          },
          {
            key: 'catalog',
            label: 'Catálogo',
            sortValue: (template) => template.catalogId || '',
            render: (template) => template.catalogId || '—',
          },
          {
            key: 'categories',
            label: 'Categorias',
            render: (template) => (
              <div className="badge-row">
                {categories(template).map((value) => (
                  <Badge key={value}>{value}</Badge>
                ))}
              </div>
            ),
          },
          {
            key: 'version',
            label: 'Versão padrão',
            render: (template) => template.defaultVersion || '—',
          },
          {
            key: 'open',
            label: 'Configuração',
            render: (template) => <Button onClick={() => setOpened(template)}>Ver versões</Button>,
          },
        ]}
      />
      {opened && (
        <CatalogLaunch
          template={opened}
          cattle={cattle}
          onClose={() => setOpened(null)}
          onCreated={(resource) => {
            setOpened(null);
            setCreated(resource);
          }}
        />
      )}
      {repositories && repositoryAccess.allowed && (
        <EnvironmentCatalogs onClose={() => setRepositories(false)} />
      )}
      {created && (
        <ResourcePanel
          key={created.id}
          selection={{ resource: created, mode: 'detail' }}
          onClose={() => setCreated(null)}
        />
      )}
    </>
  );
}
export function CatalogUpgrade({
  stack,
  onClose,
  onUpdated,
}: {
  stack: Resource;
  onClose: () => void;
  onUpdated: (resource: Resource) => void;
}) {
  const app = useApp(),
    scope = useActionScope();
  const [current, setCurrent] = useState<Resource | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setCurrent(null);
    setError(null);
    void api<Resource>(stack.links.self, undefined, undefined, scope.signal())
      .then((resource) => {
        scope.resource(resource, stack);
        if (!catalogReference(resource.externalId) || !resource.actions?.upgrade)
          throw new Error('A atualização pelo catálogo não está disponível neste estado.');
        if (active) setCurrent(resource);
      })
      .catch((caught) => {
        if (active)
          setError(caught instanceof Error ? caught : new Error('Não foi possível ler a stack.'));
      });
    return () => {
      active = false;
    };
  }, [stack.id, app.identity, app.project?.id, attempt]);
  const source = current && catalogReference(current.externalId);
  if (current && source)
    return (
      <CatalogLaunch
        template={{
          id: source.templateId,
          type: 'template',
          links: { self: `/v1-catalog/templates/${encodeURIComponent(source.templateId)}` },
        }}
        cattle={!app.project?.orchestration || app.project.orchestration === 'cattle'}
        upgradeStack={current}
        onClose={onClose}
        onCreated={onUpdated}
      />
    );
  return (
    <Modal
      open
      drawer
      title={`Atualizar stack · ${stack.name || stack.id}`}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      {error ? (
        <ErrorState error={error} retry={() => setAttempt((value) => value + 1)} />
      ) : (
        <Loading />
      )}
    </Modal>
  );
}
function CatalogLaunch({
  template,
  cattle,
  onClose,
  onCreated,
  upgradeStack,
}: {
  template: CatalogTemplate;
  cattle: boolean;
  onClose: () => void;
  onCreated: (resource: Resource) => void;
  upgradeStack?: Resource;
}) {
  const app = useApp();
  const schemas = useSchemas(true);
  const [selected, setSelected] = useState('');
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [discard, setDiscard] = useState<'close' | { version: string } | null>(null);
  const blocker = useBlocker(dirty || pending);
  usePageLeaveGuard(dirty || pending, !!app.config?.modules.unsavedChangesGuard);
  const headers = { 'X-Api-Project-Id': app.project!.id };
  const detail = useQuery({
    queryKey: useDataKey('catalog-template', template.id),
    queryFn: ({ signal }) =>
      api<CatalogTemplate>(catalogPath(template.links.self), undefined, undefined, signal, headers),
  });
  const links = detail.data?.versionLinks || {};
  const currentVersion = upgradeStack && catalogReference(upgradeStack.externalId)?.versionId;
  const currentChoice =
    currentVersion &&
    Object.keys(links).find(
      (key) =>
        decodeURIComponent(catalogPath(links[key]).split('?')[0].split('/').pop() || '') ===
        currentVersion,
    );
  const selectedVersion =
    selected ||
    currentChoice ||
    (detail.data?.defaultVersion && links[detail.data.defaultVersion]
      ? detail.data.defaultVersion
      : Object.keys(links)[0] || '');
  const url = links[selectedVersion];
  const version = useQuery({
    queryKey: useDataKey('catalog-version', url),
    queryFn: ({ signal }) =>
      api<CatalogVersion>(catalogPath(url), undefined, undefined, signal, headers),
    enabled: !!url,
  });
  function close() {
    if (pending) return;
    if (dirty) setDiscard('close');
    else onClose();
  }
  function change(value: string) {
    if (pending) return;
    if (dirty) setDiscard({ version: value });
    else setSelected(value);
  }
  const allowed =
    cattle &&
    (upgradeStack
      ? !!upgradeStack.actions?.upgrade &&
        canManageResource(schemas.data?.stack) &&
        schemas.data?.stack?.resourceActions?.upgrade?.input === 'stackUpgrade'
      : !!schemas.data?.stack?.collectionMethods?.includes('POST'));
  return (
    <>
      <Modal
        open
        drawer
        title={
          upgradeStack
            ? `Atualizar stack · ${upgradeStack.name || upgradeStack.id}`
            : detail.data?.name || template.name || template.id
        }
        description={`Environment: ${app.project?.name} · ${detail.data?.description || 'Versões e configuração da aplicação.'}`}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={pending}>
              Fechar
            </Button>
            {allowed && (
              <Button
                variant="primary"
                type="submit"
                form="catalog-launch-form"
                busy={pending}
                disabled={!ready}
              >
                {upgradeStack ? 'Atualizar stack' : 'Criar stack'}
              </Button>
            )}
          </>
        }
      >
        {detail.isPending || schemas.isPending ? (
          <Loading />
        ) : detail.error || schemas.error ? (
          <ErrorState error={detail.error || schemas.error} />
        ) : !url ? (
          <Empty
            title="Nenhuma versão disponível"
            description="O catálogo não retornou uma versão compatível com esta instância."
          />
        ) : (
          <>
            {upgradeStack && (
              <Alert>
                Stack existente: {upgradeStack.name || upgradeStack.id} · referência atual:{' '}
                {currentVersion}. Revise a versão, os parâmetros e os arquivos antes de enviar. A
                atualização pode recriar serviços e containers.
              </Alert>
            )}
            <Field label="Versão do template">
              {(id) => (
                <select
                  id={id}
                  disabled={pending}
                  value={selectedVersion}
                  onChange={(event) => change(event.target.value)}
                >
                  {Object.keys(links).map((value) => (
                    <option key={value} value={value}>
                      {value}
                      {value === detail.data?.defaultVersion ? ' · padrão' : ''}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {!allowed && (
              <Alert tone="info">
                Você pode consultar os arquivos. O lançamento não está disponível para sua conta ou
                para este tipo de environment.
              </Alert>
            )}
            {version.isPending ? (
              <Loading />
            ) : version.error ? (
              <ErrorState error={version.error} retry={() => void version.refetch()} />
            ) : (
              version.data &&
              detail.data && (
                <>
                  {allowed && (
                    <CatalogVersionForm
                      key={`form:${version.data.id}`}
                      template={detail.data}
                      version={version.data}
                      schema={schemas.data?.stack}
                      upgradeStack={upgradeStack}
                      onDirty={setDirty}
                      onPending={setPending}
                      onReady={setReady}
                      onCreated={onCreated}
                    />
                  )}
                  <CatalogFiles key={`files:${version.data.id}`} files={version.data.files} />
                </>
              )
            )}
          </>
        )}
      </Modal>
      <Confirm
        open={!!discard}
        onOpenChange={(open) => {
          if (!open) setDiscard(null);
        }}
        title="Descartar configuração?"
        description="Os parâmetros preenchidos ainda não foram salvos."
        onConfirm={() => {
          if (discard === 'close') onClose();
          else if (discard) setSelected(discard.version);
          setDirty(false);
          setDiscard(null);
        }}
      />
      {pending ? (
        <Modal
          open={blocker.state === 'blocked'}
          title="Criação em andamento"
          description="Aguarde a resposta do Rancher antes de trocar de contexto."
          onOpenChange={(open) => {
            if (!open && blocker.state === 'blocked') blocker.reset();
          }}
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
      ) : (
        <Confirm
          open={blocker.state === 'blocked'}
          title="Sair sem salvar?"
          description="Os parâmetros do template serão descartados."
          onOpenChange={(open) => {
            if (!open && blocker.state === 'blocked') blocker.reset();
          }}
          onConfirm={() => {
            if (blocker.state === 'blocked') blocker.proceed();
          }}
        />
      )}
    </>
  );
}
interface FormProps {
  template: CatalogTemplate;
  version: CatalogVersion;
  schema?: Schema;
  onDirty: (value: boolean) => void;
  onPending: (value: boolean) => void;
  onReady: (value: boolean) => void;
  onCreated: (resource: Resource) => void;
  upgradeStack?: Resource;
}
function CatalogVersionForm(props: FormProps) {
  const app = useApp();
  let questions: CatalogQuestion[] = [];
  let invalid = '';
  try {
    questions = catalogQuestions(props.version);
  } catch (error) {
    invalid = error instanceof Error ? error.message : 'O template é inválido.';
  }
  const query = useQuery({
    queryKey: useDataKey('catalog-references', props.version.id),
    enabled: !invalid,
    queryFn: async ({ signal }): Promise<CatalogReferences> => {
      const types = new Set(questions.map((question) => question.type));
      const base = `projects/${app.project!.id}/`;
      const metadata = async (collection: string) =>
        (await allPages<Resource>(base + collection, signal))
          .filter(
            (resource) =>
              !resource.removed && !['removed', 'purged'].includes(resource.state || ''),
          )
          .map((resource) => ({
            id: resource.id,
            name: resource.name || resource.id,
            stackId: resource.stackId,
          }));
      const result: CatalogReferences = {};
      const work: Promise<void>[] = [];
      if (types.has('service'))
        work.push(
          Promise.all([metadata('services'), metadata('stacks')]).then(([services, stacks]) => {
            result.service = services.flatMap((service) => {
              const stack = stacks.find((stack) => stack.id === service.stackId);
              return stack
                ? [
                    {
                      value: `${stack.name}/${service.name}`,
                      label: `${stack.name} / ${service.name}`,
                    },
                  ]
                : [];
            });
          }),
        );
      for (const type of ['certificate', 'secret'])
        if (types.has(type))
          work.push(
            metadata(type === 'certificate' ? 'certificates' : 'secrets').then((rows) => {
              result[type] = rows.map((row) => ({ value: row.name, label: row.name }));
            }),
          );
      await Promise.all(work);
      return result;
    },
  });
  if (invalid) return <Alert>{invalid}</Alert>;
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  return <CatalogParameters {...props} questions={questions} references={query.data} />;
}
function CatalogParameters({
  template,
  version,
  questions,
  references,
  schema,
  onDirty,
  onPending,
  onReady,
  onCreated,
  upgradeStack,
}: FormProps & { questions: CatalogQuestion[]; references: CatalogReferences }) {
  const app = useApp();
  const scope = useActionScope();
  const client = useQueryClient();
  const toast = useToast();
  const defaultName = template.id
    .replace(/^[^:]+:/, '')
    .replace(/^[^*]+\*/, '')
    .replace(/[^a-zA-Z0-9-]/g, '');
  const defaults = useMemo(
    () =>
      upgradeStack
        ? catalogUpgradeDefaults(questions, references, upgradeStack)
        : catalogDefaults(questions, references),
    [version.id, upgradeStack?.id],
  );
  const [answers, setAnswers] = useState(defaults);
  const [name, setName] = useState(upgradeStack?.name || defaultName);
  const [description, setDescription] = useState('');
  const [start, setStart] = useState(true);
  const [acceptedImpact, setAcceptedImpact] = useState(false);
  const [validation, setValidation] = useState('');
  const dirty =
    (!!upgradeStack && acceptedImpact) ||
    name !== (upgradeStack?.name || defaultName) ||
    (!!upgradeStack && upgradeStack.externalId !== `catalog://${version.id}`) ||
    !!description ||
    !start ||
    JSON.stringify(answers) !== JSON.stringify(defaults);
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!schema?.links.collection) throw new Error('O lançamento não está disponível.');
      const signal = scope.signal();
      const current = await api<Schema>(
        `projects/${app.project!.id}/schemas/stack`,
        undefined,
        undefined,
        signal,
      );
      scope.assertCurrent();
      if (upgradeStack) {
        if (
          !canManageResource(current) ||
          current.resourceActions?.upgrade?.input !== 'stackUpgrade'
        )
          throw new Error('Sua permissão de atualizar não está mais disponível.');
        const fresh = await api<Resource>(upgradeStack.links.self, undefined, undefined, signal);
        scope.resource(fresh, upgradeStack);
        if (catalogStackSnapshot(fresh) !== catalogStackSnapshot(upgradeStack))
          throw new Error('A stack foi alterada por outro cliente. Feche e reabra o painel.');
        if (!fresh.actions?.upgrade)
          throw new Error('A atualização não está disponível neste estado.');
        if (!version.links.self) throw new Error('A versão não pode ser revalidada.');
        const release = await api<CatalogVersion>(
          catalogPath(version.links.self),
          undefined,
          undefined,
          signal,
          { 'X-Api-Project-Id': scope.environment! },
        );
        scope.assertCurrent();
        if (
          release.id !== version.id ||
          release.templateId !== template.id ||
          JSON.stringify([release.files, release.questions]) !==
            JSON.stringify([version.files, version.questions])
        )
          throw new Error('A versão do catálogo mudou. Reabra o painel para revisar.');
        return api<Resource>(fresh.actions.upgrade, payload, 'POST', signal);
      }
      if (!current.collectionMethods?.includes('POST'))
        throw new Error('Sua permissão de criação não está mais disponível.');
      return api<Resource>(current.links.collection, payload, 'POST', signal);
    },
    onSuccess: (resource) => {
      onDirty(false);
      void client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', app.project!.id],
      });
      toast(
        upgradeStack
          ? 'Atualização recebida. Acompanhe a stack e seus serviços na operação.'
          : 'Stack criada. Acompanhe os serviços e seus estados na operação.',
      );
      onCreated(resource);
    },
  });
  useEffect(() => {
    onReady(!upgradeStack || acceptedImpact);
    return () => onReady(false);
  }, [onReady, !!upgradeStack, acceptedImpact]);
  useEffect(() => setAcceptedImpact(false), [answers, version.id]);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    onPending(mutation.isPending);
    return () => onPending(false);
  }, [mutation.isPending, onPending]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty || mutation.isPending) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, mutation.isPending]);
  function submit(event: FormEvent) {
    event.preventDefault();
    setValidation('');
    try {
      if (upgradeStack && !acceptedImpact)
        throw new Error('Confirme o impacto da atualização antes de enviar.');
      mutation.mutate(
        upgradeStack
          ? prepareCatalogUpgrade(upgradeStack, template, version, answers, references)
          : prepareCatalogStack(template, version, name, description, answers, start, references),
      );
    } catch (error) {
      setValidation(error instanceof Error ? error.message : 'Revise a configuração.');
    }
  }
  return (
    <form id="catalog-launch-form" onSubmit={submit}>
      <fieldset disabled={mutation.isPending} className="catalog-parameters">
        {upgradeStack && (
          <Alert tone="warning">
            O upgrade nativo pode iniciar serviços que estão parados, além de recriar containers e
            alterar recursos definidos pelo template. Confira os parâmetros e a escala antes de
            autorizar. Alterar um parâmetro de escala do template não garante mudar a escala
            efetiva: confira e ajuste os serviços na operação antes do upgrade.
          </Alert>
        )}
        <h3>Configuração da stack</h3>
        <Field label="Nome da stack *">
          {(id) => (
            <input
              id={id}
              required
              value={name}
              maxLength={schema?.resourceFields.name?.maxLength}
              disabled={!!upgradeStack}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        {!upgradeStack && (
          <Field label="Descrição">
            {(id) => (
              <textarea
                id={id}
                value={description}
                rows={2}
                onChange={(event) => setDescription(event.target.value)}
              />
            )}
          </Field>
        )}
        {questions.length > 0 && <h3>Parâmetros da aplicação</h3>}
        {questions.map((question) => (
          <QuestionField
            key={question.variable}
            question={question}
            value={answers[question.variable]}
            choices={references[question.type]}
            onChange={(value) =>
              setAnswers((current) => ({ ...current, [question.variable]: value }))
            }
          />
        ))}
        {upgradeStack && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={acceptedImpact}
              onChange={(event) => setAcceptedImpact(event.target.checked)}
            />
            Autorizo recriar containers e iniciar serviços conforme esta configuração
          </label>
        )}
        {!upgradeStack && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={start}
              onChange={(event) => setStart(event.target.checked)}
            />
            Iniciar serviços após criar a stack
          </label>
        )}
        {!upgradeStack && (
          <p className="muted">
            {start
              ? 'O Rancher poderá criar containers e recursos descritos pelo template.'
              : 'A stack será criada sem iniciar seus serviços. Você poderá iniciá-los pela operação.'}
          </p>
        )}
      </fieldset>
      {(validation || mutation.error) && <Alert>{validation || mutation.error?.message}</Alert>}
    </form>
  );
}
export function QuestionField({
  question,
  value,
  choices,
  onChange,
}: {
  question: CatalogQuestion;
  value: unknown;
  choices?: CatalogChoice[];
  onChange: (value: unknown) => void;
}) {
  const secret =
    ['password', 'masked'].includes(question.type) ||
    sensitiveField(question.variable) ||
    /(^|_)(key|password|secret|token)(_|$)/i.test(question.variable);
  const [revealed, setRevealed] = useState(false);
  if (question.type === 'boolean')
    return (
      <CheckboxField
        label={question.label || question.variable}
        description={question.description}
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  return (
    <Field
      label={`${question.label || question.variable}${question.required ? ' *' : ''}`}
      hint={question.description}
    >
      {(id, description) => {
        const common = { id, 'aria-describedby': description, required: !!question.required };
        if (question.type === 'enum' || choices)
          return (
            <select
              {...common}
              value={String(value ?? '')}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">Selecionar…</option>
              {(choices || question.options?.map((value) => ({ value, label: value })) || []).map(
                (choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ),
              )}
            </select>
          );
        if (question.type === 'multiline' && secret)
          return (
            <div>
              <Button type="button" variant="ghost" onClick={() => setRevealed((value) => !value)}>
                {revealed ? 'Ocultar conteúdo' : 'Mostrar para editar'}
              </Button>
              {revealed ? (
                <textarea
                  {...common}
                  rows={4}
                  value={String(value ?? '')}
                  onChange={(event) => onChange(event.target.value)}
                  autoComplete="off"
                />
              ) : (
                <input
                  id={id}
                  type="password"
                  readOnly
                  value={value ? '••••••••' : ''}
                  placeholder="Conteúdo oculto"
                  aria-describedby={description}
                />
              )}
            </div>
          );
        if (question.type === 'multiline')
          return (
            <textarea
              {...common}
              rows={4}
              value={String(value ?? '')}
              onChange={(event) => onChange(event.target.value)}
              autoComplete="off"
            />
          );
        const numeric = ['int', 'float'].includes(question.type);
        return (
          <input
            {...common}
            type={
              secret ? 'password' : numeric ? 'number' : question.type === 'date' ? 'date' : 'text'
            }
            value={String(value ?? '')}
            step={numeric ? (question.type === 'int' ? 1 : 'any') : undefined}
            min={numeric && question.min ? question.min : undefined}
            max={numeric && question.max ? question.max : undefined}
            autoComplete={secret ? 'new-password' : 'off'}
            onChange={(event) => onChange(event.target.value)}
          />
        );
      }}
    </Field>
  );
}
function CatalogFiles({ files }: { files: Record<string, string> }) {
  const [tab, setTab] = useState(0);
  const names = Object.keys(files || {}).filter((name) => typeof files[name] === 'string');
  if (!names.length) return null;
  return (
    <section className="catalog-files">
      <h3>Arquivos do template</h3>
      <p className="muted">
        Conteúdo original da versão selecionada. Os parâmetros serão processados pelo Rancher.
      </p>
      <div className="catalog-file-tabs">
        <Tabs
          labels={names}
          selected={Math.min(tab, names.length - 1)}
          onChange={setTab}
          idPrefix="catalog-file"
          panelId="catalog-file-content"
          label="Arquivos da versão"
        />
      </div>
      <pre
        id="catalog-file-content"
        role="tabpanel"
        aria-labelledby={`catalog-file-${Math.min(tab, names.length - 1)}`}
        className="configuration-viewer"
      >
        {files[names[Math.min(tab, names.length - 1)]]}
      </pre>
    </section>
  );
}
