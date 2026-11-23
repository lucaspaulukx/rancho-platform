import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import { useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { allPages, api, type Resource, type Schema } from '../api';
import { useActionScope } from '../hooks/useActionScope';
import { useApp } from '../state';
import { useSchemas } from '../hooks/useSchemas';
import { Alert, Button, Confirm, ErrorState, Loading, Modal, useToast } from './ui';
import { SchemaForm } from './SchemaForm';
import { StackComposeForm } from './StackComposeForm';
import { validateStackCreation } from '../stack-compose';
import { validateWorkloadCreation } from '../workload-creation';

export interface CreationSelection {
  kind: string;
  stack?: Resource;
}
export const creationLabels: Record<string, string> = {
  stack: 'Stack',
  service: 'Serviço',
  loadBalancerService: 'Balanceador',
  dnsService: 'Alias de serviço',
  externalService: 'Serviço externo',
  container: 'Container avulso',
};
export function ResourceCreator({
  selection,
  onClose,
  references = {},
}: {
  selection: CreationSelection;
  onClose: () => void;
  references?: Record<string, Resource[]>;
}) {
  const app = useApp();
  const scope = useActionScope();
  const client = useQueryClient();
  const toast = useToast();
  const schemas = useSchemas(true);
  const schema = schemas.data?.[selection.kind];
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const allowed = !!schema?.collectionMethods?.includes('POST');
  const composeEditor = selection.kind === 'stack' && app.config.modules.stackComposeEditor;
  const workloadLayout =
    app.config.modules.workloadCreationSections &&
    ['service', 'container'].includes(selection.kind);
  const healthChecks =
    app.config.modules.workloadHealthChecks && ['service', 'container'].includes(selection.kind);
  const ulimits =
    app.config.modules.workloadUlimitEditors && ['service', 'container'].includes(selection.kind);
  const devices =
    app.config.modules.workloadDeviceEditors && ['service', 'container'].includes(selection.kind);
  const security =
    app.config.modules.workloadSecurityEditors && ['service', 'container'].includes(selection.kind);
  const resources =
    app.config.modules.workloadResourceEditors && ['service', 'container'].includes(selection.kind);
  const scheduling =
    app.config.modules.workloadScheduling && ['service', 'container'].includes(selection.kind);
  const sidecars = app.config.modules.workloadSidecars && selection.kind === 'service';
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!allowed || !schema?.links.collection)
        throw new Error('A criação não está disponível neste contexto.');
      const signal = scope.signal();
      if (!schema.links.self) throw new Error('O schema de criação não está disponível.');
      const current = await api<Schema>(schema.links.self, undefined, undefined, signal);
      scope.assertCurrent();
      if (current.id !== schema.id || !current.collectionMethods?.includes('POST'))
        throw new Error('Sua permissão de criar não está mais disponível.');
      if (selection.stack) {
        const stack = await api<Resource>(selection.stack.links.self, undefined, undefined, signal);
        scope.resource(stack, selection.stack);
        if (stack.state !== 'active')
          throw new Error('A stack não está disponível para receber serviços.');
      }
      scope.assertCurrent();
      if (composeEditor) payload = validateStackCreation(current, payload);
      if (
        workloadLayout ||
        healthChecks ||
        sidecars ||
        scheduling ||
        resources ||
        security ||
        ulimits ||
        devices
      ) {
        const refreshed = Object.fromEntries(
          (await allPages<Schema>(`projects/${scope.environment}/schemas`, signal)).map((value) => [
            value.id,
            value,
          ]),
        );
        scope.assertCurrent();
        if (!refreshed[selection.kind])
          throw new Error('O schema de criação não está mais disponível.');
        payload = validateWorkloadCreation(
          refreshed[selection.kind],
          payload,
          refreshed,
          healthChecks,
          sidecars,
          scheduling,
          resources,
          security,
          ulimits,
          devices,
        );
      }
      return api<Resource>(
        current.links.collection,
        selection.stack ? { ...payload, stackId: selection.stack.id } : payload,
        'POST',
        signal,
      );
    },
    onSuccess: async (resource) => {
      setDirty(false);
      await client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', app.project?.id],
      });
      toast(
        `${creationLabels[selection.kind] || 'Recurso'} ${resource.name || resource.id} criado. Acompanhe o estado na operação.`,
      );
      onClose();
    },
  });
  const blocker = useBlocker(dirty || mutation.isPending);
  usePageLeaveGuard(dirty || mutation.isPending, app.config.modules.unsavedChangesGuard);
  function close() {
    if (mutation.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  const formSchema = schema
    ? {
        ...schema,
        resourceFields: Object.fromEntries(
          Object.entries(schema.resourceFields)
            .filter(([name]) => !selection.stack || name !== 'stackId')
            .map(([name, field]) => [
              name,
              (name === 'stackId' && selection.kind.endsWith('Service')) ||
              (name === 'stackId' && selection.kind === 'service') ||
              (name === 'launchConfig' && selection.kind === 'service') ||
              (name === 'imageUuid' && selection.kind === 'container')
                ? { ...field, required: true }
                : field,
            ]),
        ),
      }
    : undefined;
  const formSchemas =
    selection.kind === 'service' && schemas.data?.launchConfig
      ? {
          ...schemas.data,
          launchConfig: {
            ...schemas.data.launchConfig,
            resourceFields: {
              ...Object.fromEntries(
                Object.entries(schemas.data.launchConfig.resourceFields).filter(
                  ([name]) =>
                    ![
                      'kind',
                      'description',
                      ...(workloadLayout ? ['stackId', 'startOnCreate'] : []),
                    ].includes(name),
                ),
              ),
              imageUuid: { ...schemas.data.launchConfig.resourceFields.imageUuid, required: true },
            },
          },
        }
      : schemas.data || {};
  return (
    <>
      <Modal
        open
        drawer
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={`Criar ${creationLabels[selection.kind]?.toLocaleLowerCase() || 'recurso'}`}
        description={`Environment: ${app.project?.name}${selection.stack ? ' · Stack: ' + (selection.stack.name || selection.stack.id) : ''}`}
        footer={
          <>
            <Button onClick={close} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="workspace-create-form"
              variant="primary"
              disabled={!allowed || schemas.isPending}
              busy={mutation.isPending}
            >
              Criar
            </Button>
          </>
        }
      >
        {schemas.isPending ? (
          <Loading />
        ) : schemas.error ? (
          <ErrorState error={schemas.error} retry={() => void schemas.refetch()} />
        ) : !allowed || !formSchema ? (
          <Alert>
            Seu perfil ou o servidor não disponibiliza a criação deste recurso no environment
            selecionado.
          </Alert>
        ) : composeEditor ? (
          <StackComposeForm
            schema={formSchema}
            onSubmit={(payload) => mutation.mutate(payload)}
            error={mutation.error}
            busy={mutation.isPending}
            onDirtyChange={setDirty}
          />
        ) : (
          <SchemaForm
            layout={workloadLayout ? 'workload' : undefined}
            bindingEditors={workloadLayout && app.config.modules.workloadBindingEditors}
            healthCheckEditors={healthChecks}
            sidecarEditors={sidecars}
            schedulingEditors={scheduling}
            resourceEditors={resources}
            securityEditors={security}
            ulimitEditors={ulimits}
            deviceEditors={devices}
            id="workspace-create-form"
            schema={formSchema}
            schemas={formSchemas}
            references={references}
            onSubmit={(payload) => mutation.mutate(payload)}
            error={mutation.error}
            busy={mutation.isPending}
            onDirtyChange={setDirty}
          />
        )}
      </Modal>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar rascunho?"
        description="O recurso ainda não foi criado. As informações preenchidas serão descartadas."
        onConfirm={onClose}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        busy={mutation.isPending}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Mudar de contexto?"
        description={
          mutation.isPending
            ? 'Aguarde a resposta do Rancher.'
            : 'Há um rascunho que ainda não foi salvo.'
        }
        onConfirm={() => {
          if (!mutation.isPending && blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}
