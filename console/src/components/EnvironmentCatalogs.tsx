import { useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allPages, api, ApiError, type Resource } from '../api';
import { useApp, useDataKey } from '../state';
import { useActionScope } from '../hooks/useActionScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import { useEnvironmentCatalogAccess } from '../hooks/useEnvironmentCatalogAccess';
import {
  environmentRepositoryMetadata,
  environmentRepositoryPath,
  prepareEnvironmentRepository,
  repositoryDraft,
  type EnvironmentRepository,
  type EnvironmentRepositoryDraft,
} from '../environment-catalogs';
import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  Confirm,
  DataTable,
  ErrorState,
  Field,
  Loading,
  Modal,
  useToast,
} from './ui';

const emptyDraft = (): EnvironmentRepositoryDraft => ({
  name: '',
  url: '',
  branch: 'master',
  kind: 'native',
});
export function EnvironmentCatalogs({ onClose }: { onClose: () => void }) {
  const app = useApp(),
    scope = useActionScope(),
    client = useQueryClient(),
    toast = useToast();
  const environment = app.project!.id;
  const access = useEnvironmentCatalogAccess();
  const enabled = access.allowed;
  const headers = { 'X-Api-Project-Id': environment };
  const [before, setBefore] = useState<Resource | undefined>();
  const [draft, setDraft] = useState<EnvironmentRepositoryDraft | null>(null);
  const [revealed, setRevealed] = useState(false),
    [opening, setOpening] = useState(false);
  const [review, setReview] = useState<'save' | 'remove' | null>(null);
  const [discard, setDiscard] = useState(false),
    [discardCloses, setDiscardCloses] = useState(false),
    [error, setError] = useState('');
  async function request<T>(
    path: string,
    body?: unknown,
    method?: string,
    signal = scope.signal(),
  ) {
    try {
      return await api<T>(path, body, method, signal, headers);
    } catch (e) {
      throw new Error(
        e instanceof ApiError
          ? `Operação de catálogo não concluída (HTTP ${e.status}).`
          : 'Não foi possível concluir a operação de catálogo.',
      );
    }
  }
  async function rows(signal = scope.signal()) {
    try {
      return await allPages<Resource>('/v1-catalog/catalogs', signal, headers);
    } catch {
      throw new Error('Não foi possível consultar os repositórios deste environment.');
    }
  }
  const query = useQuery({
    queryKey: useDataKey('environment-catalogs'),
    enabled,
    gcTime: 0,
    queryFn: async ({ signal }) => (await rows(signal)).map(environmentRepositoryMetadata),
  });
  const dirty =
    !!draft &&
    JSON.stringify(draft) !== JSON.stringify(before ? repositoryDraft(before) : emptyDraft());
  async function open(row: EnvironmentRepository, remove = false) {
    setOpening(true);
    setError('');
    try {
      await access.check(scope.signal());
      scope.assertCurrent();
      const fresh = (await rows()).find(
        (v) => v.id === row.id && v.name === row.name && v.environmentId === environment,
      );
      scope.assertCurrent();
      if (!fresh || fresh.kind !== 'native')
        throw new Error('Repositório indisponível neste environment.');
      setBefore(fresh);
      setDraft(repositoryDraft(fresh));
      setRevealed(false);
      if (remove) setReview('remove');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  }
  function clear() {
    setDraft(null);
    setBefore(undefined);
    setRevealed(false);
    setReview(null);
    setError('');
    write.reset();
  }
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!enabled || !draft || !review) throw new Error('Reabra o editor.');
      await access.check(scope.signal());
      scope.assertCurrent();
      await request<Resource>('projects/' + environment);
      scope.assertCurrent();
      const fresh = await rows();
      scope.assertCurrent();
      const payload = prepareEnvironmentRepository(
        environment,
        draft,
        fresh,
        before,
        review === 'remove',
      );
      const path = before ? environmentRepositoryPath(draft.name) : '/v1-catalog/catalogs';
      await request<unknown>(
        path,
        payload,
        review === 'remove' ? 'DELETE' : before ? 'PUT' : 'POST',
      );
      scope.assertCurrent();
    },
    onSuccess: () => {
      const removed = review === 'remove';
      clear();
      void client.invalidateQueries({ queryKey: ['data', app.identity] });
      toast(
        removed
          ? 'Repositório removido deste environment.'
          : 'Repositório salvo. Aguarde a sincronização do serviço de catálogo.',
      );
    },
  });
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  function close() {
    if (write.isPending) return;
    if (dirty) {
      setDiscardCloses(true);
      setDiscard(true);
    } else {
      clear();
      onClose();
    }
  }
  if (!enabled) return null;
  return (
    <>
      <Modal
        open
        drawer
        title="Repositórios do environment"
        description={`Fontes de ${app.project!.name}. Repositórios globais aparecem somente para consulta.`}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        footer={
          <Button onClick={close} disabled={write.isPending}>
            Fechar
          </Button>
        }
      >
        <Alert tone="info">
          A configuração é exclusiva deste environment. Salvar pode iniciar clone Git pelo servidor;
          a listagem não comprova sincronização. Templates e stacks existentes não são executados
          por este formulário.
        </Alert>
        {error && <Alert>{error}</Alert>}
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : (
          <DataTable
            label="Fontes de catálogo do environment"
            rows={query.data || []}
            rowKey={(v) => v.id}
            searchText={(v) => `${v.name} ${v.branch}`}
            columns={[
              { key: 'name', label: 'Repositório', render: (v) => v.name },
              {
                key: 'scope',
                label: 'Escopo',
                render: (v) => (
                  <Badge>{v.environmentId === environment ? 'Este environment' : 'Global'}</Badge>
                ),
              },
              { key: 'branch', label: 'Branch', render: (v) => v.branch || 'Padrão do servidor' },
              {
                key: 'actions',
                label: 'Ações',
                render: (v) =>
                  v.environmentId === environment && v.kind === 'native' ? (
                    <div className="row-actions">
                      <Button disabled={opening || !!draft} onClick={() => void open(v)}>
                        Editar {v.name}
                      </Button>
                      <Button disabled={opening || !!draft} onClick={() => void open(v, true)}>
                        Remover {v.name}
                      </Button>
                    </div>
                  ) : (
                    'Somente consulta'
                  ),
              },
            ]}
            emptyTitle="Nenhum repositório disponível"
            emptyDescription="Adicione uma fonte nativa para este environment."
          />
        )}
        {!draft && (
          <Button
            disabled={opening}
            onClick={() => {
              setBefore(undefined);
              setDraft(emptyDraft());
              setError('');
            }}
          >
            Adicionar repositório do environment
          </Button>
        )}
        {draft && (
          <fieldset className="form-fieldset nested-fields" disabled={write.isPending}>
            <legend>{before ? 'Editar fonte do environment' : 'Nova fonte do environment'}</legend>
            <Field label="Nome do repositório">
              {(id) => (
                <input
                  id={id}
                  value={draft.name}
                  disabled={!!before}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  autoComplete="off"
                />
              )}
            </Field>
            <CheckboxField
              label="Mostrar URL do repositório"
              checked={revealed}
              onChange={(e) => setRevealed(e.target.checked)}
            />
            <Field
              label="URL Git"
              hint="HTTP, HTTPS, Git ou SSH; sem senha na URL. O servidor acessará este endereço."
            >
              {(id, description) => (
                <input
                  id={id}
                  aria-describedby={description}
                  type={revealed ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                />
              )}
            </Field>
            <Field label="Branch do repositório">
              {(id) => (
                <input
                  id={id}
                  value={draft.branch}
                  onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
                  autoComplete="off"
                />
              )}
            </Field>
            <p className="muted">
              Tipo: catálogo nativo Cattle. O nome permanece fixo após a criação.
            </p>
            <div className="row-actions">
              <Button
                onClick={() => {
                  if (dirty) {
                    setDiscardCloses(false);
                    setDiscard(true);
                  } else clear();
                }}
              >
                Cancelar edição
              </Button>
              <Button
                disabled={!dirty}
                onClick={() => {
                  setRevealed(false);
                  setReview('save');
                }}
              >
                Revisar fonte do environment
              </Button>
            </div>
          </fieldset>
        )}
      </Modal>
      <Confirm
        open={!!review}
        onOpenChange={(o) => {
          if (!o && !write.isPending) {
            setReview(null);
            write.reset();
          }
        }}
        title={
          review === 'remove' ? 'Remover fonte do environment?' : 'Salvar fonte do environment?'
        }
        description={`${draft?.name || 'Repositório'} em ${app.project!.name}. ${review === 'remove' ? 'A fonte deixará de estar disponível neste environment. Stacks existentes não serão removidas.' : 'O servidor poderá clonar a URL configurada. A sincronização será validada separadamente.'} Fontes globais permanecem preservadas.`}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{write.error.message}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar edição do repositório?"
        description="A alteração ainda não foi enviada ao servidor."
        onConfirm={() => {
          setDiscard(false);
          clear();
          if (discardCloses) onClose();
        }}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset();
        }}
        title="Sair com alteração pendente?"
        description="Aguarde qualquer envio em andamento antes de sair."
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
