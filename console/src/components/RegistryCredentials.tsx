import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allPages, api, ApiError, type Resource } from '../api';
import { dataResourceMetadata } from '../data-resources';
import { useApp, useDataKey } from '../state';
import { canManageResource, useSchemas } from '../hooks/useSchemas';
import {
  Alert,
  Badge,
  Button,
  Confirm,
  DataTable,
  ErrorState,
  Loading,
  Modal,
  useToast,
} from './ui';
import { SchemaForm } from './SchemaForm';

export function RegistryCredentials({
  registry,
  onDirty,
  onPending,
}: {
  registry: Resource;
  onDirty: (value: boolean) => void;
  onPending: (value: boolean) => void;
}) {
  const app = useApp();
  const schemas = useSchemas(true);
  const schema = schemas.data?.registryCredential;
  const client = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Resource | null | undefined>();
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [action, setAction] = useState<{ resource: Resource; name: string } | null>(null);
  const query = useQuery({
    queryKey: useDataKey('registry-credentials', registry.id),
    enabled: !!schema?.links.collection,
    queryFn: async ({ signal }) =>
      (
        await allPages<Resource>(
          `${schema!.links.collection}?registryId=${encodeURIComponent(registry.id)}&limit=100`,
          signal,
        )
      )
        .filter((value) => value.registryId === registry.id && !value.removed)
        .map(dataResourceMetadata),
    refetchInterval: 15_000,
  });
  const save = useMutation({
    gcTime: 0,
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!schema) throw new Error('As credenciais não estão disponíveis neste contexto.');
      const permission = await api<import('../api').Schema>(schema.links.self);
      if (
        editing
          ? !permission.resourceMethods?.includes('PUT')
          : !permission.collectionMethods?.includes('POST')
      )
        throw new Error('Sua permissão de alteração não está mais disponível.');
      let url = permission.links.collection;
      if (editing) {
        const current = await api<Resource>(editing.links.self);
        if (current.registryId !== registry.id)
          throw new Error('A credencial não pertence a este registry.');
        url = current.links.self;
      }
      try {
        const result = await api<Resource>(
          url,
          editing ? payload : { ...payload, registryId: registry.id },
          editing ? 'PUT' : 'POST',
        );
        return dataResourceMetadata(result);
      } catch (error) {
        if (error instanceof ApiError)
          throw new ApiError(
            error.status,
            `Não foi possível salvar a credencial (HTTP ${error.status}). Confira os dados e suas permissões.`,
          );
        throw error;
      }
    },
    onSuccess: () => {
      setDirty(false);
      setEditing(undefined);
      save.reset();
      void query.refetch();
      toast('Credencial salva. A senha não será exibida novamente.');
    },
  });
  const run = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      if (!action || !canManageResource(schema))
        throw new Error('Esta operação não está disponível.');
      const current = await api<Resource>(action.resource.links.self);
      if (current.registryId !== registry.id || !current.actions?.[action.name])
        throw new Error('A operação não está mais disponível para esta credencial.');
      await api(current.actions[action.name], {});
    },
    onSuccess: () => {
      setAction(null);
      run.reset();
      void client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', app.project?.id],
      });
      toast('Operação recebida pelo Rancher.');
    },
  });
  const busy = save.isPending || run.isPending;
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    onPending(busy);
    return () => onPending(false);
  }, [busy, onPending]);
  function close() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else {
      setEditing(undefined);
      save.reset();
    }
  }
  const form = schema
    ? {
        ...schema,
        resourceFields: Object.fromEntries(
          Object.entries(schema.resourceFields)
            .filter(([name]) =>
              ['name', 'description', 'publicValue', 'secretValue'].includes(name),
            )
            .map(([name, field]) => [
              name,
              name === 'publicValue'
                ? { ...field, label: 'Usuário do registry' }
                : name === 'secretValue'
                  ? {
                      ...field,
                      label: 'Senha ou token',
                      description: editing
                        ? 'Deixe em branco para preservar a senha existente.'
                        : undefined,
                    }
                  : field,
            ]),
        ),
      }
    : undefined;
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-heading">
        <div>
          <h2>Credenciais do registry</h2>
          <p className="muted">Gerencie as contas usadas para obter imagens deste registry.</p>
        </div>
        {schema?.collectionMethods?.includes('POST') && (
          <Button
            variant="primary"
            onClick={() => {
              save.reset();
              setEditing(null);
            }}
          >
            Adicionar credencial
          </Button>
        )}
      </div>
      {!schema ? (
        <Alert tone="info">Sua conta não tem acesso às credenciais deste registry.</Alert>
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <DataTable
          rows={query.data}
          rowKey={(value) => value.id}
          emptyTitle="Nenhuma credencial cadastrada"
          emptyDescription="Adicione uma credencial se o registry exige autenticação. Registries públicos podem ser usados sem senha."
          columns={[
            { key: 'name', label: 'Nome', render: (value) => value.name || value.id },
            {
              key: 'user',
              label: 'Usuário',
              render: (value) => (typeof value.publicValue === 'string' ? value.publicValue : '—'),
            },
            {
              key: 'state',
              label: 'Estado',
              render: (value) => <Badge state={value.state}>{value.state}</Badge>,
            },
            {
              key: 'actions',
              label: 'Ações',
              render: (value) => (
                <div className="row-actions">
                  {schema.resourceMethods?.includes('PUT') && (
                    <Button
                      onClick={() => {
                        save.reset();
                        setEditing(value);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                  {canManageResource(schema) &&
                    ['activate', 'deactivate', 'remove']
                      .filter((name) => value.actions?.[name])
                      .map((name) => (
                        <Button key={name} onClick={() => setAction({ resource: value, name })}>
                          {name === 'activate'
                            ? 'Ativar'
                            : name === 'deactivate'
                              ? 'Desativar'
                              : 'Remover'}
                        </Button>
                      ))}
                </div>
              ),
            },
          ]}
        />
      )}
      <Modal
        open={editing !== undefined}
        drawer
        title={editing ? 'Editar credencial' : 'Adicionar credencial'}
        description={`Registry: ${String(registry.serverAddress || registry.name || registry.id)} · Environment: ${app.project?.name}`}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="registry-credential-form"
              variant="primary"
              busy={save.isPending}
            >
              Salvar credencial
            </Button>
          </>
        }
      >
        {editing !== undefined && form && (
          <SchemaForm
            id="registry-credential-form"
            key={editing?.id || 'new'}
            schema={form}
            schemas={schemas.data || {}}
            original={editing || undefined}
            onDirtyChange={setDirty}
            onSubmit={(payload) => save.mutate(payload)}
            busy={save.isPending}
            error={save.error}
          />
        )}
      </Modal>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar credencial?"
        description="Os dados preenchidos ainda não foram salvos."
        onConfirm={() => {
          setDiscard(false);
          setDirty(false);
          setEditing(undefined);
          save.reset();
        }}
      />
      <Confirm
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !run.isPending) {
            setAction(null);
            run.reset();
          }
        }}
        title={`${action?.name === 'activate' ? 'Ativar' : action?.name === 'deactivate' ? 'Desativar' : 'Remover'} credencial?`}
        description={`A operação afeta somente ${action?.resource.name || action?.resource.id || 'esta credencial'} no registry ${String(registry.serverAddress || registry.id)}. Novas operações com imagens podem depender dessa conta.`}
        busy={run.isPending}
        onConfirm={() => run.mutate()}
      />
      {run.error && <Alert>{run.error.message}</Alert>}
    </section>
  );
}
