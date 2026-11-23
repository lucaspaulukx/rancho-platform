import { ActionMenu, type MenuAction } from '../components/ActionMenu';
import { useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, allPages, ApiError, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { useSchemas } from '../hooks/useSchemas';
import { useRequestScope } from '../hooks/useRequestScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
  driverMetadata,
  driverSnapshot,
  driverPayload,
  driverAction,
  customDriver,
  sameDriver,
  emptyDriver,
  type DriverFields,
  type DriverSnapshot,
  type DriverMetadata,
  type DriverAction,
} from '../machine-drivers';
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
  PageHeader,
  useToast,
} from '../components/ui';
async function request<T>(path: string, body?: unknown, method?: string, signal?: AbortSignal) {
  try {
    return await api<T>(path, body, method, signal);
  } catch (e) {
    throw new Error(
      e instanceof ApiError
        ? `Operação de driver não concluída (HTTP ${e.status}).`
        : 'Não foi possível concluir a operação de driver.',
    );
  }
}
export function MachineDrivers() {
  const app = useApp();
  return <DriverScope key={app.identity} />;
}
function DriverScope() {
  const app = useApp(),
    scope = useRequestScope(app.identity + ':drivers'),
    schemas = useSchemas(false),
    client = useQueryClient(),
    toast = useToast();
  const [editor, setEditor] = useState<DriverSnapshot | 'new' | null>(null),
    [fields, setFields] = useState<DriverFields>({ ...emptyDriver }),
    [revealed, setRevealed] = useState(false),
    [auto, setAuto] = useState(true),
    [review, setReview] = useState(false),
    [discard, setDiscard] = useState(false),
    [action, setAction] = useState<{ row: DriverSnapshot; kind: DriverAction } | null>(null),
    [opening, setOpening] = useState(false),
    [error, setError] = useState('');
  const enabled = app.admin && app.config.modules.machineDrivers;
  const query = useQuery({
    queryKey: ['data', app.identity, 'machine-drivers'],
    enabled,
    gcTime: 0,
    refetchInterval: auto ? 5000 : false,
    queryFn: async ({ signal }) => {
      try {
        return (await allPages<Resource>('machinedrivers?limit=100', signal)).map(driverMetadata);
      } catch {
        throw new Error('Não foi possível carregar os drivers.');
      }
    },
  });
  const before = editor && editor !== 'new' ? editor : undefined;
  const dirty =
    !!editor &&
    (Object.keys(emptyDriver) as (keyof DriverFields)[]).some(
      (k) => fields[k] !== (before?.[k] ?? ''),
    );
  function clear() {
    setEditor(null);
    setFields({ ...emptyDriver });
    setRevealed(false);
    setReview(false);
    setAction(null);
    write.reset();
  }
  async function open(row: DriverMetadata, kind?: DriverAction) {
    if (opening) return;
    setOpening(true);
    setError('');
    try {
      const snapshot = driverSnapshot(
        await request<Resource>(row.self, undefined, undefined, scope.signal()),
      );
      scope.assertCurrent();
      if (snapshot.id !== row.id) throw new Error('O driver mudou. Atualize a lista.');
      if (kind) setAction({ row: snapshot, kind });
      else {
        if (!customDriver(snapshot)) throw new Error('Edição manual indisponível.');
        setEditor(snapshot);
        setFields({
          url: snapshot.url,
          uiUrl: snapshot.uiUrl,
          checksum: snapshot.checksum,
          description: snapshot.description,
        });
        setRevealed(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Driver indisponível.');
    } finally {
      setOpening(false);
    }
  }
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!enabled) throw new Error('Acesso indisponível.');
      const signal = scope.signal(),
        schema = await request<Schema>('schemas/machineDriver', undefined, undefined, signal);
      scope.assertCurrent();
      if (action) {
        if (action.kind !== 'remove' && !app.config.modules.driverActivation)
          throw new Error('Ativação de drivers desabilitada.');
        const fresh = driverSnapshot(
          await request<Resource>(action.row.self, undefined, undefined, signal),
        );
        scope.assertCurrent();
        const target = driverAction(schema, action.row, fresh, action.kind);
        await request<unknown>(target, {}, 'POST', signal);
      } else {
        if (!editor) throw new Error('Reabra o editor.');
        const fresh = before
          ? driverSnapshot(await request<Resource>(before.self, undefined, undefined, signal))
          : undefined;
        scope.assertCurrent();
        if (before && fresh) sameDriver(before, fresh);
        const payload = driverPayload(schema, fields, before, fresh);
        await request<unknown>(
          before?.self || 'machinedrivers',
          payload,
          before ? 'PUT' : 'POST',
          signal,
        );
      }
      scope.assertCurrent();
    },
    onSuccess: () => {
      clear();
      void client.invalidateQueries({ queryKey: ['data', app.identity, 'machine-drivers'] });
      toast('Operação enviada. Acompanhe o estado do driver na lista.');
    },
  });
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  function close() {
    if (write.isPending) return;
    if (dirty) setDiscard(true);
    else clear();
  }
  if (!enabled) return <Alert>Drivers indisponíveis neste acesso.</Alert>;
  const actionLabels: Record<DriverAction, string> = {
    activate: 'Ativar',
    reactivate: 'Reativar',
    deactivate: 'Desativar',
    remove: 'Remover',
  };
  return (
    <>
      <PageHeader
        title="Drivers de máquinas"
        description="Provedores de máquinas disponíveis no Rancher. As operações afetam toda a instância."
        action={
          <>
            <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
              Atualizar
            </Button>
            <Button
              disabled={!schemas.data?.machineDriver?.collectionMethods?.includes('POST')}
              onClick={() => {
                setEditor('new');
                setFields({ ...emptyDriver });
                setError('');
              }}
            >
              Adicionar driver
            </Button>
          </>
        }
      />
      <CheckboxField
        label="Atualizar drivers automaticamente (5 s)"
        checked={auto}
        onChange={(e) => setAuto(e.target.checked)}
      />
      <Alert tone="info">
        O cadastro solicita um driver inativo. O registro e a edição podem baixar e executar o
        binário no servidor. A URL de interface é armazenada, mas seu código não é carregado nesta
        console.
      </Alert>
      {error && <Alert>{error}</Alert>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <DataTable
          label="Drivers de máquinas"
          rows={query.data || []}
          rowKey={(v) => v.id}
          searchText={(v) =>
            `${v.name} ${v.state} ${v.builtin ? 'Embutido' : v.catalog ? 'Catálogo' : 'Personalizado'}`
          }
          columns={[
            { key: 'name', label: 'Driver', render: (v) => v.name },
            {
              key: 'state',
              label: 'Estado',
              render: (v) => <Badge state={v.state}>{v.state || '—'}</Badge>,
            },
            {
              key: 'origin',
              label: 'Origem',
              render: (v) => (v.builtin ? 'Embutido' : v.catalog ? 'Catálogo' : 'Personalizado'),
            },
            {
              key: 'actions',
              label: 'Ações',
              render: (v) => {
                const actions: MenuAction[] = [];
                if (customDriver(v) && ['active', 'inactive', 'error'].includes(v.state))
                  actions.push({
                    id: 'edit',
                    label: 'Editar driver',
                    disabled: opening,
                    onSelect: () => void open(v),
                  });
                if (app.config.modules.driverActivation)
                  for (const k of ['activate', 'reactivate', 'deactivate'] as const)
                    if (v.actions[k])
                      actions.push({
                        id: k,
                        label: actionLabels[k] + ' driver',
                        disabled: opening,
                        onSelect: () => void open(v, k),
                      });
                if (customDriver(v) && v.actions.remove)
                  actions.push({
                    id: 'remove',
                    label: 'Remover driver',
                    danger: true,
                    disabled: opening,
                    onSelect: () => void open(v, 'remove'),
                  });
                return <ActionMenu label={`Ações do driver ${v.name}`} actions={actions} />;
              },
            },
          ]}
        />
      )}
      <Modal
        open={!!editor}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        title={before ? 'Editar driver' : 'Adicionar driver'}
        description={
          before?.name || 'O nome será definido pelo Rancher a partir da URL do binário.'
        }
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
              disabled={!fields.url || !dirty}
            >
              Revisar driver
            </Button>
          </>
        }
      >
        <CheckboxField
          label="Mostrar URLs e checksum"
          checked={revealed}
          onChange={(e) => setRevealed(e.target.checked)}
        />
        {(Object.keys(emptyDriver) as (keyof DriverFields)[]).map((key) => (
          <Field
            key={key}
            label={
              {
                url: 'URL do binário',
                uiUrl: 'URL da interface (opcional)',
                checksum: 'Checksum (opcional)',
                description: 'Descrição (opcional)',
              }[key]
            }
            hint={
              key === 'url'
                ? 'Use um binário de origem confiável. Cadastrar pode executar código no servidor.'
                : undefined
            }
          >
            {(id, descriptionId) => (
              <input
                id={id}
                aria-describedby={descriptionId}
                type={key === 'description' || revealed ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={fields[key]}
                onChange={(e) => setFields((v) => ({ ...v, [key]: e.target.value }))}
              />
            )}
          </Field>
        ))}
      </Modal>
      <Confirm
        open={review || !!action}
        onOpenChange={(o) => {
          if (!write.isPending && !o) {
            setReview(false);
            setAction(null);
            write.reset();
          }
        }}
        title={action ? `${actionLabels[action.kind]} driver?` : 'Salvar driver?'}
        description={
          action
            ? `${action.row.name}. ${action.kind === 'remove' ? 'O registro será removido. Máquinas já provisionadas não são removidas por esta tela.' : action.kind === 'deactivate' ? 'O provedor deixará de estar disponível para novos provisionamentos.' : 'O servidor pode baixar e executar o binário configurado. Confirme a origem antes de continuar.'}`
            : 'O Rancher pode baixar e executar o binário durante o registro ou a edição. As URLs e o checksum estão protegidos nesta revisão.'
        }
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{write.error.message}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar alterações do driver?"
        description="Os campos ainda não foram enviados ao servidor."
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
        description="O driver ainda não foi salvo. Aguarde qualquer envio em andamento."
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
