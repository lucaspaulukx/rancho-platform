import { useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { useSchemas } from '../hooks/useSchemas';
import { useRequestScope } from '../hooks/useRequestScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
  repositoryDocument,
  repositoryMetadata,
  repositoryPayload,
  type RepositoryDocument,
  type RepositoryDraft,
} from '../catalog-repositories';
import {
  Alert,
  Button,
  CheckboxField,
  Confirm,
  DataTable,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  useToast,
} from '../components/ui';
async function request<T>(path: string, body?: unknown, method?: string, signal?: AbortSignal) {
  try {
    return await api<T>(path, body, method, signal);
  } catch (e) {
    throw new Error(
      e instanceof ApiError
        ? `Operação de catálogo não concluída (HTTP ${e.status}).`
        : 'Não foi possível concluir a operação de catálogo.',
    );
  }
}
export function CatalogRepositories() {
  const app = useApp();
  return <RepositoryScope key={app.identity} />;
}
function RepositoryScope() {
  const app = useApp(),
    scope = useRequestScope(app.identity + ':catalog-repositories'),
    schemas = useSchemas(false),
    client = useQueryClient(),
    toast = useToast(),
    enabled = app.admin && app.config.modules.catalogRepositories;
  const [editor, setEditor] = useState<RepositoryDocument | null>(null),
    [rows, setRows] = useState<RepositoryDraft[]>([]),
    [revealed, setRevealed] = useState(false),
    [review, setReview] = useState(false),
    [discard, setDiscard] = useState(false),
    [empty, setEmpty] = useState(false),
    [opening, setOpening] = useState(false),
    [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['data', app.identity, 'catalog-repositories'],
    enabled,
    gcTime: 0,
    queryFn: async ({ signal }) =>
      repositoryMetadata(
        repositoryDocument(
          await request<Resource>('settings/catalog.url', undefined, undefined, signal),
        ),
      ),
  });
  const dirty = !!editor && JSON.stringify(rows) !== JSON.stringify(editor.entries);
  async function open() {
    setOpening(true);
    setError('');
    try {
      const snapshot = repositoryDocument(
        await request<Resource>('settings/catalog.url', undefined, undefined, scope.signal()),
      );
      scope.assertCurrent();
      setEditor(snapshot);
      setRows(snapshot.entries.map((v) => ({ ...v })));
      setRevealed(false);
      setEmpty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Configuração indisponível.');
    } finally {
      setOpening(false);
    }
  }
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!enabled || !editor) throw new Error('Reabra o editor.');
      const signal = scope.signal(),
        schema = await request<Schema>('schemas/setting', undefined, undefined, signal);
      scope.assertCurrent();
      const fresh = repositoryDocument(
        await request<Resource>('settings/catalog.url', undefined, undefined, signal),
      );
      scope.assertCurrent();
      const payload = repositoryPayload(schema, editor, fresh, rows, empty);
      await request<unknown>('settings/catalog.url', payload, 'PUT', signal);
      scope.assertCurrent();
    },
    onSuccess: () => {
      clear();
      void client.invalidateQueries({ queryKey: ['data', app.identity] });
      toast(
        'Configuração salva. O clone e a sincronização dos repositórios são executados pelo serviço de catálogo.',
      );
    },
  });
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  function clear() {
    setEditor(null);
    setRows([]);
    setRevealed(false);
    setReview(false);
    setEmpty(false);
    write.reset();
  }
  function close() {
    if (write.isPending) return;
    if (dirty) setDiscard(true);
    else clear();
  }
  function change(key: string, field: 'name' | 'url' | 'branch', value: string) {
    setRows((v) => v.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }
  if (!enabled) return <Alert>Repositórios indisponíveis neste acesso.</Alert>;
  return (
    <>
      <PageHeader
        title="Repositórios de catálogo"
        description="Configuração global de fontes Git. Alterações podem afetar todos os environments."
        action={
          <>
            <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
              Atualizar listagem
            </Button>
            <Button
              onClick={() => void open()}
              disabled={opening || !schemas.data?.setting?.resourceFields.value?.update}
            >
              Configurar repositórios
            </Button>
          </>
        }
      />
      <Alert tone="info">
        A lista mostra a configuração do servidor, sem comprovar clone, commit ou sincronização. Os
        catálogos próprios de cada environment não são alterados aqui.
      </Alert>
      {error && <Alert>{error}</Alert>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="muted">
            Origem: {query.data.source}.{' '}
            {query.data.inDb ? 'Override no banco de dados.' : 'Sem override no banco de dados.'}
          </p>
          <DataTable
            label="Repositórios globais configurados"
            rows={query.data.entries}
            rowKey={(v) => v.name}
            searchText={(v) => `${v.name} ${v.branch}`}
            columns={[
              { key: 'name', label: 'Repositório', render: (v) => v.name },
              { key: 'branch', label: 'Branch configurada', render: (v) => v.branch },
            ]}
            emptyTitle="Nenhum repositório global configurado"
            emptyDescription="Fontes específicas de environments podem continuar disponíveis."
          />
        </>
      )}
      <Modal
        open={!!editor}
        drawer
        title="Configurar repositórios globais"
        description="As entradas deste formulário afetam a instância inteira. URLs ficam protegidas por padrão."
        onOpenChange={(o) => {
          if (!o) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={write.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setRevealed(false);
                setReview(true);
              }}
              disabled={!dirty}
            >
              Revisar repositórios
            </Button>
          </>
        }
      >
        <CheckboxField
          label="Mostrar URLs dos repositórios"
          checked={revealed}
          onChange={(e) => setRevealed(e.target.checked)}
        />
        {rows.map((row, index) => (
          <fieldset key={row.key} className="form-fieldset nested-fields">
            <legend>Repositório {index + 1}</legend>
            <Field label={`Nome do repositório ${index + 1}`}>
              {(id) => (
                <input
                  id={id}
                  value={row.name}
                  autoComplete="off"
                  onChange={(e) => change(row.key, 'name', e.target.value)}
                />
              )}
            </Field>
            <Field
              label={`URL do repositório ${index + 1}`}
              hint="Git, SSH, HTTP ou HTTPS. Credenciais não devem ser incluídas em URLs HTTP."
            >
              {(id, description) => (
                <input
                  id={id}
                  aria-describedby={description}
                  type={revealed ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={row.url}
                  onChange={(e) => change(row.key, 'url', e.target.value)}
                />
              )}
            </Field>
            <Field
              label={`Branch do repositório ${index + 1}`}
              hint="Em branco mantém o padrão do servidor."
            >
              {(id, description) => (
                <input
                  id={id}
                  aria-describedby={description}
                  value={row.branch}
                  autoComplete="off"
                  onChange={(e) => change(row.key, 'branch', e.target.value)}
                />
              )}
            </Field>
            <Button
              onClick={() => setRows((v) => v.filter((r) => r.key !== row.key))}
              aria-label={`Remover repositório ${index + 1}`}
            >
              Remover repositório
            </Button>
          </fieldset>
        ))}
        <Button
          onClick={() =>
            setRows((v) => [
              ...v,
              { key: crypto.randomUUID(), original: null, name: '', url: '', branch: 'master' },
            ])
          }
        >
          Adicionar repositório
        </Button>
        {!rows.length && (
          <CheckboxField
            label="Confirmo remover todos os repositórios globais"
            checked={empty}
            onChange={(e) => setEmpty(e.target.checked)}
          />
        )}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={(o) => {
          if (!write.isPending) setReview(o);
        }}
        title="Salvar repositórios globais?"
        description={`Serão configurados ${rows.length} repositórios globais. O servidor poderá acessar essas URLs e executar clones Git; salvar não comprova sincronização. URLs ficam protegidas nesta revisão.`}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{write.error.message}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar alterações dos repositórios?"
        description="As alterações ainda não foram enviadas ao servidor."
        onConfirm={() => {
          setDiscard(false);
          clear();
        }}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset();
        }}
        title="Sair com alteração pendente?"
        description="Os repositórios ainda não foram salvos. Aguarde qualquer envio em andamento."
        busy={write.isPending}
        onConfirm={() => {
          if (!write.isPending && blocker.state === 'blocked') {
            clear();
            blocker.proceed();
          }
        }}
      />
    </>
  );
}
