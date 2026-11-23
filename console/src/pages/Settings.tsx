import { useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, allPages, ApiError, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { useSchemas } from '../hooks/useSchemas';
import { useRequestScope } from '../hooks/useRequestScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
  settingMetadata,
  settingSnapshot,
  settingWritable,
  prepareSetting,
  type SettingMetadata,
  type SettingSnapshot,
} from '../server-settings';
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
        ? `Não foi possível consultar ou alterar a configuração (HTTP ${e.status}).`
        : 'Não foi possível concluir a operação de configuração.',
    );
  }
}
export function Settings() {
  const app = useApp();
  return <SettingsScope key={app.identity} />;
}
function SettingsScope() {
  const app = useApp(),
    scope = useRequestScope(app.identity + ':settings'),
    schemas = useSchemas(false),
    client = useQueryClient(),
    toast = useToast();
  const [editor, setEditor] = useState<SettingSnapshot | null>(null),
    [value, setValue] = useState(''),
    [revealed, setRevealed] = useState(false),
    [empty, setEmpty] = useState(false),
    [review, setReview] = useState(false),
    [reset, setReset] = useState(false),
    [discard, setDiscard] = useState(false),
    [opening, setOpening] = useState<string | null>(null),
    [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['data', app.identity, 'server-settings'],
    enabled: app.admin && app.config.modules.settings,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      try {
        return (await allPages<Resource>('settings?limit=100', signal)).map(settingMetadata);
      } catch {
        throw new Error('Não foi possível carregar os nomes das configurações.');
      }
    },
  });
  async function open(row: SettingMetadata) {
    if (opening) return;
    setOpening(row.name);
    setError('');
    try {
      const signal = scope.signal(),
        snapshot = settingSnapshot(await request<Resource>(row.self, undefined, undefined, signal));
      scope.assertCurrent();
      if (snapshot.name !== row.name) throw new Error('A configuração mudou. Atualize a lista.');
      setEditor(snapshot);
      setValue(snapshot.value ?? '');
      setEmpty(false);
      setRevealed(false);
      setReview(false);
      setReset(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Configuração indisponível.');
    } finally {
      setOpening(null);
    }
  }
  const dirty = !!editor && value !== (editor.value ?? '');
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!app.admin || !app.config.modules.settings || !editor)
        throw new Error('Reabra o editor.');
      const signal = scope.signal(),
        contract = await request<Schema>('schemas/setting', undefined, undefined, signal);
      scope.assertCurrent();
      const fresh = settingSnapshot(
        await request<Resource>(editor.self, undefined, undefined, signal),
      );
      scope.assertCurrent();
      const payload = prepareSetting(contract, editor, fresh, value, empty, reset);
      await request<unknown>(fresh.self, payload, reset ? 'DELETE' : 'PUT', signal);
      scope.assertCurrent();
    },
    onSuccess: () => {
      clear();
      void client.invalidateQueries({ queryKey: ['data', app.identity, 'server-settings'] });
      toast('Configuração enviada ao Rancher. Consulte o valor efetivo novamente.');
    },
  });
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  function clear() {
    setEditor(null);
    setValue('');
    setRevealed(false);
    setEmpty(false);
    setReview(false);
    setReset(false);
    write.reset();
  }
  function close() {
    if (write.isPending) return;
    if (dirty) setDiscard(true);
    else clear();
  }
  if (!app.admin || !app.config.modules.settings)
    return <Alert>Configurações indisponíveis neste acesso.</Alert>;
  return (
    <>
      <PageHeader
        title="Configuração do servidor"
        description="Configurações nativas e origem do valor efetivo. Mudanças podem afetar toda a instância."
        action={
          <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
            Atualizar
          </Button>
        }
      />
      <Alert tone="info">
        A busca consulta os nomes carregados. Valores ficam protegidos e são consultados
        individualmente ao abrir. Configuração por arquivo ou variável pode prevalecer sobre um
        override no banco; esta tela não reinicia serviços.
      </Alert>
      {error && <Alert>{error}</Alert>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <DataTable
          rows={query.data || []}
          rowKey={(v) => v.name}
          searchText={(v) => `${v.name} ${v.source}`}
          columns={[
            { key: 'name', label: 'Configuração', render: (v) => v.name },
            { key: 'source', label: 'Origem', render: (v) => v.source || 'Não informada' },
            {
              key: 'database',
              label: 'Override no banco',
              render: (v) => (v.inDb ? 'Sim' : 'Não'),
            },
            {
              key: 'open',
              label: 'Detalhes',
              render: (v) => (
                <Button
                  aria-label={`Abrir configuração ${v.name}`}
                  onClick={() => void open(v)}
                  disabled={!!opening}
                >
                  {opening === v.name ? 'Abrindo…' : 'Consultar / editar'}
                </Button>
              ),
            },
          ]}
        />
      )}
      <Modal
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title="Configuração do servidor"
        description={editor?.name || 'Configuração individual'}
        footer={
          <>
            <Button onClick={close} disabled={write.isPending}>
              Cancelar
            </Button>
            {settingWritable(schemas.data?.setting, 'reset', editor ?? undefined) && (
              <Button
                onClick={() => {
                  write.reset();
                  setReset(true);
                  setRevealed(false);
                  setReview(true);
                }}
                disabled={write.isPending || dirty}
              >
                Restaurar padrão
              </Button>
            )}
            {settingWritable(schemas.data?.setting, 'update') && (
              <Button
                variant="primary"
                onClick={() => {
                  write.reset();
                  setReset(false);
                  setRevealed(false);
                  setReview(true);
                }}
                disabled={write.isPending || !dirty}
              >
                Revisar alteração
              </Button>
            )}
          </>
        }
      >
        <Alert tone="info">
          Origem: {editor?.source || 'Não informada'}. Alterar o valor cria ou atualiza o override
          no banco. O valor efetivo pode vir de outra fonte.
        </Alert>
        <Field label="Valor configurado">
          {(id) =>
            revealed ? (
              <textarea
                id={id}
                rows={5}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setEmpty(false);
                }}
                autoComplete="off"
                disabled={!settingWritable(schemas.data?.setting, 'update') || write.isPending}
              />
            ) : (
              <input id={id} type="password" value={value} readOnly autoComplete="off" />
            )
          }
        </Field>
        <Field label="Valor efetivo atual">
          {(id) =>
            revealed ? (
              <textarea
                id={id}
                rows={5}
                value={editor?.activeValue ?? ''}
                readOnly
                autoComplete="off"
              />
            ) : (
              <input
                id={id}
                type="password"
                value={editor?.activeValue ?? ''}
                readOnly
                autoComplete="off"
              />
            )
          }
        </Field>
        <Button onClick={() => setRevealed((v) => !v)}>
          {revealed ? 'Ocultar valores' : 'Mostrar valores'}
        </Button>
        {!value && (
          <CheckboxField
            label="Confirmo salvar um valor vazio"
            checked={empty}
            onChange={(e) => setEmpty(e.target.checked)}
          />
        )}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={(open) => {
          if (!write.isPending) setReview(open);
        }}
        title={reset ? 'Restaurar padrão da configuração?' : 'Alterar configuração do servidor?'}
        description={`${editor?.name || ''}. ${reset ? 'Somente o override no banco será removido; outra fonte poderá fornecer o valor efetivo.' : 'O novo valor está protegido na revisão e pode afetar toda a instância.'}`}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{write.error.message}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar alteração de configuração?"
        description="O valor digitado será descartado sem envio ao servidor."
        onConfirm={() => {
          setDiscard(false);
          clear();
        }}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Sair com alteração pendente?"
        description="A configuração ainda não foi salva. Aguarde qualquer envio em andamento."
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
