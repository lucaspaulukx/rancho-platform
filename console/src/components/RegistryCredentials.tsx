import { useI18n } from '../i18n/provider';
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

class RegistryCredentialError extends Error {
  constructor(
    readonly key:
      | 'registryCredentials.error.unavailable'
      | 'registryCredentials.error.permission'
      | 'registryCredentials.error.registryMismatch'
      | 'registryCredentials.error.actionUnavailable'
      | 'registryCredentials.error.actionChanged',
  ) {
    super(key);
  }
}
class RegistryCredentialSaveError extends ApiError {
  constructor(status: number) {
    super(status, 'registryCredentials.error.save');
  }
}

export function RegistryCredentials({
  registry,
  onDirty,
  onPending,
}: {
  registry: Resource;
  onDirty: (value: boolean) => void;
  onPending: (value: boolean) => void;
}) {
  const { t } = useI18n();
  function localizeError(error: Error) {
    if (error instanceof RegistryCredentialSaveError)
      return new ApiError(
        error.status,
        t('registryCredentials.error.save', { status: error.status }),
      );
    if (error instanceof RegistryCredentialError) return new Error(t(error.key));
    return error;
  }
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
      if (!schema) throw new RegistryCredentialError('registryCredentials.error.unavailable');
      const permission = await api<import('../api').Schema>(schema.links.self);
      if (
        editing
          ? !permission.resourceMethods?.includes('PUT')
          : !permission.collectionMethods?.includes('POST')
      )
        throw new RegistryCredentialError('registryCredentials.error.permission');
      let url = permission.links.collection;
      if (editing) {
        const current = await api<Resource>(editing.links.self);
        if (current.registryId !== registry.id)
          throw new RegistryCredentialError('registryCredentials.error.registryMismatch');
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
        if (error instanceof ApiError) throw new RegistryCredentialSaveError(error.status);
        throw error;
      }
    },
    onSuccess: () => {
      setDirty(false);
      setEditing(undefined);
      save.reset();
      void query.refetch();
      toast(t('registryCredentials.saved'));
    },
  });
  const run = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      if (!action || !canManageResource(schema))
        throw new RegistryCredentialError('registryCredentials.error.actionUnavailable');
      const current = await api<Resource>(action.resource.links.self);
      if (current.registryId !== registry.id || !current.actions?.[action.name])
        throw new RegistryCredentialError('registryCredentials.error.actionChanged');
      await api(current.actions[action.name], {});
    },
    onSuccess: () => {
      setAction(null);
      run.reset();
      void client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', app.project?.id],
      });
      toast(t('registryCredentials.operationSent'));
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
                ? { ...field, label: t('registryCredentials.usernameLabel') }
                : name === 'secretValue'
                  ? {
                      ...field,
                      label: t('registryCredentials.secretLabel'),
                      description: editing ? t('registryCredentials.preserveSecret') : undefined,
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
          <h2>{t('registryCredentials.title')}</h2>
          <p className="muted">{t('registryCredentials.description')}</p>
        </div>
        {schema?.collectionMethods?.includes('POST') && (
          <Button
            variant="primary"
            onClick={() => {
              save.reset();
              setEditing(null);
            }}
          >
            {t('registryCredentials.add')}
          </Button>
        )}
      </div>
      {!schema ? (
        <Alert tone="info">{t('registryCredentials.noAccess')}</Alert>
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <DataTable
          rows={query.data}
          rowKey={(value) => value.id}
          emptyTitle={t('registryCredentials.empty')}
          emptyDescription={t('registryCredentials.emptyDescription')}
          columns={[
            {
              key: 'name',
              label: t('registryCredentials.name'),
              render: (value) => value.name || value.id,
            },
            {
              key: 'user',
              label: t('registryCredentials.username'),
              render: (value) => (typeof value.publicValue === 'string' ? value.publicValue : '—'),
            },
            {
              key: 'state',
              label: t('registryCredentials.state'),
              render: (value) => <Badge state={value.state}>{value.state}</Badge>,
            },
            {
              key: 'actions',
              label: t('registryCredentials.actions'),
              render: (value) => (
                <div className="row-actions">
                  {schema.resourceMethods?.includes('PUT') && (
                    <Button
                      onClick={() => {
                        save.reset();
                        setEditing(value);
                      }}
                    >
                      {t('registryCredentials.edit')}
                    </Button>
                  )}
                  {canManageResource(schema) &&
                    ['activate', 'deactivate', 'remove']
                      .filter((name) => value.actions?.[name])
                      .map((name) => (
                        <Button key={name} onClick={() => setAction({ resource: value, name })}>
                          {name === 'activate'
                            ? t('registryCredentials.activate')
                            : name === 'deactivate'
                              ? t('registryCredentials.deactivate')
                              : t('registryCredentials.remove')}
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
        title={editing ? t('registryCredentials.editTitle') : t('registryCredentials.add')}
        description={t('registryCredentials.context', {
          registry: String(registry.serverAddress || registry.name || registry.id),
          environment: app.project?.name || '',
        })}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={busy}>
              {t('registryCredentials.cancel')}
            </Button>
            <Button
              type="submit"
              form="registry-credential-form"
              variant="primary"
              busy={save.isPending}
            >
              {t('registryCredentials.save')}
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
            error={save.error && localizeError(save.error)}
          />
        )}
      </Modal>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('registryCredentials.discard')}
        description={t('registryCredentials.discardDescription')}
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
        title={t(
          action?.name === 'activate'
            ? 'registryCredentials.activateTitle'
            : action?.name === 'deactivate'
              ? 'registryCredentials.deactivateTitle'
              : 'registryCredentials.removeTitle',
        )}
        description={t('registryCredentials.actionDescription', {
          credential:
            action?.resource.name ||
            action?.resource.id ||
            t('registryCredentials.credentialFallback'),
          registry: String(registry.serverAddress || registry.id),
        })}
        busy={run.isPending}
        onConfirm={() => run.mutate()}
      />
      {run.error && <Alert>{localizeError(run.error).message}</Alert>}
    </section>
  );
}
