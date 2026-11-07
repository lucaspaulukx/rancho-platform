import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import { lazy, Suspense, useRef, useState } from 'react';
import { Link, useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { api, allPages, type Resource, type Schema } from '../api';
import { useActionScope } from '../hooks/useActionScope';
import { useI18n } from '../i18n/provider';
import { ptSchemaForm } from '../i18n/domains/schema-form';
import { useApp, useDataKey } from '../state';
import { canManageResource, useSchemas } from '../hooks/useSchemas';
import { Alert, Badge, Button, Confirm, ErrorState, Loading, Modal, useToast } from './ui';
import { fieldLabel, SchemaForm } from './SchemaForm';
import { ResourceDetails } from './ResourceDetails';
import { ResourceStream } from './ResourceStream';
import { isUserAction } from '../resource-actions';
import { metricsLink, serviceMetricsEnabled } from '../metrics';
import {
  imageUpgradePayload,
  supportsImageUpgrade,
  configurationUpgradePayload,
  DeviceUpgradeValidationError,
} from '../service-upgrade';
import { ServiceUpgradeForm } from './ServiceUpgradeForm';
import { lifecyclePayload } from '../lifecycle-actions';
import { catalogReference } from '../catalog-upgrade';
import { publicWorkload } from '../workload-privacy';
import { canScaleService, prepareServiceScale } from '../service-scaling';
import { ServiceScaleForm } from './ServiceScaleForm';
const CatalogUpgrade = lazy(() =>
  import('../pages/Catalog').then((module) => ({ default: module.CatalogUpgrade })),
);
const StackComposeUpgradePanel = lazy(() => import('./StackComposeUpgradePanel'));
const BalancerRulesPanel = lazy(() => import('./BalancerRulesPanel'));
const ServiceLinksPanel = lazy(() => import('./ServiceLinksPanel'));
const ResourceMetrics = lazy(() =>
  import('./ResourceMetrics').then((module) => ({ default: module.ResourceMetrics })),
);

class ResourcePanelError extends Error {
  constructor(
    readonly key:
      | 'resourcePanel.operationUnavailable'
      | 'resourcePanel.editSchemaUnavailable'
      | 'resourcePanel.editPermissionUnavailable'
      | 'resourcePanel.scalingDisabled'
      | 'resourcePanel.actionUnavailable'
      | 'resourcePanel.bindingsDisabled'
      | 'resourcePanel.healthCheckDisabled'
      | 'resourcePanel.sidecarsDisabled'
      | 'resourcePanel.schedulingDisabled'
      | 'resourcePanel.memoryDisabled'
      | 'resourcePanel.cpuDisabled'
      | 'resourcePanel.securityDisabled'
      | 'resourcePanel.ulimitsDisabled',
  ) {
    super(key);
  }
}
export interface ResourceSelection {
  resource: Resource;
  mode: 'balancer' | 'detail' | 'edit' | 'scale' | 'action' | 'logs' | 'execute' | 'metrics';
  action?: string;
}
export function ResourcePanel({
  selection,
  onClose,
}: {
  selection: ResourceSelection;
  onClose: () => void;
}) {
  const app = useApp();
  const available =
    app.config.modules.catalog &&
    app.config.modules.catalogUpgrades &&
    selection.resource.type === 'stack' &&
    !!catalogReference(selection.resource.externalId);
  const [catalog, setCatalog] = useState(
    available && selection.mode === 'action' && selection.action === 'upgrade',
  );
  const composeAvailable =
    app.config.modules.stackComposeUpgrades &&
    app.config.modules.workloads &&
    app.project?.orchestration === 'cattle' &&
    selection.resource.type === 'stack' &&
    selection.resource.hasComposeSource === true &&
    !selection.resource.externalId &&
    !selection.resource.system;
  const [compose, setCompose] = useState(
    composeAvailable && selection.mode === 'action' && selection.action === 'upgrade',
  );
  const [updated, setUpdated] = useState<Resource | null>(null);
  const linksAvailable =
    app.config.modules.serviceLinksEditor && selection.resource.type === 'service';
  const [links, setLinks] = useState(
    linksAvailable && selection.mode === 'action' && selection.action === 'setservicelinks',
  );
  const balancerAvailable =
    app.config.modules.balancerRulesEditor && selection.resource.type === 'loadBalancerService';
  const [balancer, setBalancer] = useState(balancerAvailable && selection.mode === 'balancer');
  if (compose && composeAvailable)
    return (
      <Suspense fallback={<Loading />}>
        <StackComposeUpgradePanel
          resource={updated || selection.resource}
          onClose={onClose}
          onSaved={(value) => {
            setUpdated(value);
            setCompose(false);
          }}
        />
      </Suspense>
    );
  if (balancer && balancerAvailable)
    return (
      <Suspense fallback={<Loading />}>
        <BalancerRulesPanel
          resource={updated || selection.resource}
          onClose={onClose}
          onSaved={(resource) => {
            setUpdated(resource);
            setBalancer(false);
          }}
        />
      </Suspense>
    );
  if (links && linksAvailable)
    return (
      <Suspense fallback={<Loading />}>
        <ServiceLinksPanel
          resource={updated || selection.resource}
          onClose={onClose}
          onSaved={(resource) => {
            setUpdated(resource);
            setLinks(false);
          }}
        />
      </Suspense>
    );
  if (catalog && available)
    return (
      <Suspense fallback={<Loading />}>
        <CatalogUpgrade
          stack={updated || selection.resource}
          onClose={onClose}
          onUpdated={(resource) => {
            setUpdated(resource);
            setCatalog(false);
          }}
        />
      </Suspense>
    );
  return (
    <ResourcePanelContext
      selection={updated ? { resource: updated, mode: 'detail' } : selection}
      onClose={onClose}
      onCatalogUpgrade={
        available ? () => setCatalog(true) : composeAvailable ? () => setCompose(true) : undefined
      }
      onBalancer={balancerAvailable ? () => setBalancer(true) : undefined}
      onServiceLinks={linksAvailable ? () => setLinks(true) : undefined}
    />
  );
}
function ResourcePanelContext({
  selection,
  onClose,
  onCatalogUpgrade,
  onServiceLinks,
  onBalancer,
}: {
  selection: ResourceSelection;
  onClose: () => void;
  onCatalogUpgrade?: () => void;
  onServiceLinks?: () => void;
  onBalancer?: () => void;
}) {
  const { t } = useI18n();
  function actionName(name: string) {
    const exact = `schemaForm.label.${name}`;
    const lower = `schemaForm.label.${name.toLowerCase()}`;
    type LabelKey = Extract<keyof typeof ptSchemaForm, `schemaForm.label.${string}`>;
    return Object.hasOwn(ptSchemaForm, exact)
      ? t(exact as LabelKey)
      : Object.hasOwn(ptSchemaForm, lower)
        ? t(lower as LabelKey)
        : fieldLabel(name);
  }
  const app = useApp();
  const scope = useActionScope();
  const client = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState(selection.mode);
  const [action, setAction] = useState(selection.action);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [result, setResult] = useState<Resource | null>(null);
  const schemas = useSchemas(true);
  const query = useQuery({
    queryKey: useDataKey('resource-panel', selection.resource.id),
    queryFn: async ({ signal }) =>
      publicWorkload(
        await api<Resource>(selection.resource.links.self, undefined, undefined, signal),
      ),
    refetchInterval: mode === 'detail' ? 10_000 : false,
  });
  const resource = query.data;
  const scaleSnapshot = useRef<Resource | null>(null);
  if (mode !== 'scale') scaleSnapshot.current = null;
  else if (resource && !query.isFetching && !scaleSnapshot.current)
    scaleSnapshot.current = resource;
  const schema = schemas.data?.[resource?.type || selection.resource.type];
  const input = action ? schema?.resourceActions?.[action]?.input : undefined;
  const actionSchema = input ? schemas.data?.[input] : undefined;
  const actionLabel =
    action === 'upgrade' && selection.resource.type === 'stack'
      ? t('resourcePanel.upgradeStack')
      : actionName(action || '');
  const writable = canManageResource(schema);
  const scalable =
    !!resource && canScaleService(resource, schema, app.config.modules.workloadScaling);
  const imageUpgrade =
    !!resource &&
    mode === 'action' &&
    action === 'upgrade' &&
    app.config.modules.workloadUpgrades &&
    supportsImageUpgrade(resource, schemas.data || {});
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!resource || !writable)
        throw new ResourcePanelError('resourcePanel.operationUnavailable');
      const signal = scope.signal();
      const current = await api<Resource>(resource.links.self, undefined, undefined, signal);
      scope.resource(current, resource);
      if (payload.editDevices === true) {
        if (!app.config.modules.workloadDeviceUpgrades)
          throw new DeviceUpgradeValidationError('deviceUpgrade.error.disabled');
        if (!imageUpgrade || !scope.environment)
          throw new DeviceUpgradeValidationError('deviceUpgrade.error.unavailable');
      }
      if (mode === 'edit' || mode === 'scale') {
        if (!schema?.links.self)
          throw new ResourcePanelError('resourcePanel.editSchemaUnavailable');
        const permission = await api<Schema>(schema.links.self, undefined, undefined, signal);
        scope.assertCurrent();
        if (!permission.resourceMethods?.includes('PUT'))
          throw new ResourcePanelError('resourcePanel.editPermissionUnavailable');
        if (mode === 'scale') {
          if (!app.config.modules.workloadScaling)
            throw new ResourcePanelError('resourcePanel.scalingDisabled');
          return api<Resource>(
            current.links.self,
            prepareServiceScale(
              scaleSnapshot.current || resource,
              current,
              permission,
              payload.scale,
            ),
            'PUT',
            signal,
          );
        }
        return api<Resource>(current.links.self, payload, 'PUT', signal);
      }
      const url = action && current.actions?.[action];
      if (!url) throw new ResourcePanelError('resourcePanel.actionUnavailable');
      if (
        imageUpgrade &&
        (payload.editBindings === true ||
          payload.editHealthCheck === true ||
          payload.editSidecars === true ||
          payload.editScheduling === true ||
          payload.editResources === true ||
          payload.editCpuResources === true ||
          payload.editSecurity === true ||
          payload.editUlimits === true ||
          payload.editDevices === true)
      ) {
        if (payload.editBindings === true && !app.config.modules.workloadConfigUpgrades)
          throw new ResourcePanelError('resourcePanel.bindingsDisabled');
        if (payload.editHealthCheck === true && !app.config.modules.workloadHealthCheckUpgrades)
          throw new ResourcePanelError('resourcePanel.healthCheckDisabled');
        if (payload.editSidecars === true && !app.config.modules.workloadSidecarUpgrades)
          throw new ResourcePanelError('resourcePanel.sidecarsDisabled');
        if (payload.editScheduling === true && !app.config.modules.workloadSchedulingUpgrades)
          throw new ResourcePanelError('resourcePanel.schedulingDisabled');
        if (payload.editResources === true && !app.config.modules.workloadResourceUpgrades)
          throw new ResourcePanelError('resourcePanel.memoryDisabled');
        if (payload.editCpuResources === true && !app.config.modules.workloadResourceUpgrades)
          throw new ResourcePanelError('resourcePanel.cpuDisabled');
        if (payload.editSecurity === true && !app.config.modules.workloadSecurityUpgrades)
          throw new ResourcePanelError('resourcePanel.securityDisabled');
        if (payload.editUlimits === true && !app.config.modules.workloadUlimitUpgrades)
          throw new ResourcePanelError('resourcePanel.ulimitsDisabled');
        const names = [
          'service',
          'serviceUpgrade',
          'inServiceUpgradeStrategy',
          'launchConfig',
          ...(payload.editUlimits === true ? ['ulimit'] : []),
          ...(payload.editHealthCheck === true
            ? ['instanceHealthCheck', 'recreateOnQuorumStrategyConfig']
            : []),
          ...(Array.isArray(current.secondaryLaunchConfigs) && current.secondaryLaunchConfigs.length
            ? ['secondaryLaunchConfig']
            : []),
        ];
        const contracts =
          payload.editSidecars === true
            ? await allPages<Schema>(`projects/${scope.environment}/schemas`, signal)
            : await Promise.all(
                names.map((name) =>
                  api<Schema>(
                    `projects/${scope.environment}/schemas/${name}`,
                    undefined,
                    undefined,
                    signal,
                  ),
                ),
              );
        scope.assertCurrent();
        const freshContracts = Object.fromEntries(
          contracts.map((contract) => [contract.id, contract]),
        );
        if (
          payload.editDevices === true &&
          names.some((name) => !Object.hasOwn(freshContracts, name))
        )
          throw new DeviceUpgradeValidationError('deviceUpgrade.error.unavailable');
        const freshSchemas = {
          ...(payload.editDevices === true && payload.editSidecars === true ? {} : schemas.data),
          ...freshContracts,
        };
        return api<Resource>(
          url,
          configurationUpgradePayload(resource, current, payload, freshSchemas),
          'POST',
          signal,
        );
      }
      scope.assertCurrent();
      return api<Resource>(
        url,
        imageUpgrade
          ? imageUpgradePayload(current, payload, schemas.data || {})
          : lifecyclePayload(current, action || '', payload),
        'POST',
        signal,
      );
    },
    onSuccess: async (output) => {
      setDirty(false);
      setResult(output.type === 'composeConfig' ? output : null);
      setMode('detail');
      setAction(undefined);
      await client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', app.project?.id],
      });
      toast(t('resourcePanel.saved'));
    },
  });
  const blocker = useBlocker(dirty || mutation.isPending);
  usePageLeaveGuard(dirty || mutation.isPending, app.config.modules.unsavedChangesGuard);
  function close() {
    if (mutation.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  function back() {
    setMode('detail');
    setAction(undefined);
    mutation.reset();
  }
  function selectAction(name: string) {
    if (name === 'setservicelinks' && onServiceLinks) {
      onServiceLinks();
      return;
    }
    if (name === 'upgrade' && onCatalogUpgrade) {
      onCatalogUpgrade();
      return;
    }
    mutation.reset();
    setAction(name);
    setMode(name === 'logs' || name === 'execute' ? name : 'action');
  }
  const path =
    resource?.type === 'stack'
      ? 'stacks'
      : resource?.type === 'host'
        ? 'hosts'
        : resource?.type === 'container'
          ? 'containers'
          : 'services';
  if (mode === 'metrics' && resource && !query.error)
    return (
      <Suspense fallback={<Loading />}>
        <ResourceMetrics resource={resource} onClose={onClose} />
      </Suspense>
    );
  if (
    (mode === 'logs' || mode === 'execute') &&
    resource &&
    app.config.modules.observability &&
    !query.error
  )
    return <ResourceStream resource={resource} mode={mode} onClose={onClose} />;
  const busy = query.isPending || schemas.isPending || (mode === 'scale' && !scaleSnapshot.current);
  const unavailableInput = mode === 'action' && !!input && !actionSchema;
  return (
    <>
      <Modal
        open
        drawer
        title={`${mode === 'edit' ? t('resourcePanel.editPrefix') : mode === 'scale' ? t('resourcePanel.scalePrefix') : mode === 'action' ? actionLabel + ' · ' : ''}${resource?.name || selection.resource.name || selection.resource.id}`}
        description={t('resourcePanel.environment', {
          name: app.project?.name || '—',
          id: selection.resource.id,
        })}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={mutation.isPending}>
              {t('resourcePanel.close')}
            </Button>
            {(mode === 'edit' || mode === 'scale' || mode === 'action') &&
              !busy &&
              !query.error && (
                <Button
                  variant={action === 'remove' || action === 'purge' ? 'danger' : 'primary'}
                  busy={mutation.isPending}
                  disabled={!writable || unavailableInput || (mode === 'scale' && !scalable)}
                  form={
                    mode === 'edit' || mode === 'scale' || actionSchema
                      ? 'workspace-resource-form'
                      : undefined
                  }
                  type={mode === 'edit' || mode === 'scale' || actionSchema ? 'submit' : 'button'}
                  onClick={
                    mode === 'action' && !actionSchema ? () => mutation.mutate({}) : undefined
                  }
                >
                  {mode === 'edit'
                    ? t('resourcePanel.save')
                    : mode === 'scale'
                      ? t('resourcePanel.applyScale')
                      : t('resourcePanel.confirm')}
                </Button>
              )}
          </>
        }
      >
        {busy ? (
          <Loading />
        ) : query.error || schemas.error ? (
          <ErrorState
            error={query.error || schemas.error}
            retry={() => {
              void query.refetch();
              void schemas.refetch();
            }}
          />
        ) : resource ? (
          <>
            {mode === 'detail' ? (
              <>
                <div className="workspace-panel-status">
                  <Badge state={resource.state}>{resource.state}</Badge>
                  {typeof resource.healthState === 'string' && (
                    <span className="muted">
                      {t('resourcePanel.health', { state: resource.healthState })}
                    </span>
                  )}
                  <Link
                    className="button ghost"
                    to={`/${path}/${resource.id}?env=${app.project?.id}`}
                  >
                    <ExternalLink size={15} />
                    {t('resourcePanel.directLink')}
                  </Link>
                </div>
                {typeof resource.transitioningMessage === 'string' &&
                  resource.transitioningMessage && (
                    <Alert tone={resource.transitioning === 'error' ? 'danger' : 'info'}>
                      {resource.transitioningMessage}
                    </Alert>
                  )}
                <div className="workspace-panel-actions">
                  {onBalancer && writable && (
                    <Button onClick={onBalancer}>{t('resourcePanel.balancer')}</Button>
                  )}
                  {scalable && (
                    <Button
                      onClick={() => {
                        mutation.reset();
                        setMode('scale');
                      }}
                    >
                      {t('resourcePanel.scale')}
                    </Button>
                  )}
                  {app.config.modules.observability &&
                    app.config.modules.metrics &&
                    metricsLink(resource, serviceMetricsEnabled(app.config.modules)) && (
                      <Button onClick={() => setMode('metrics')}>
                        {t('resourcePanel.metrics')}
                      </Button>
                    )}
                  {writable && schema?.resourceMethods?.includes('PUT') && (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setResult(null);
                        mutation.reset();
                        setMode('edit');
                      }}
                    >
                      {t('resourcePanel.edit')}
                    </Button>
                  )}
                  {Object.keys(resource.actions || {})
                    .filter(
                      (name) =>
                        isUserAction(name) &&
                        (name === 'logs' ? app.config.modules.observability : writable) &&
                        (!['logs', 'execute'].includes(name) || app.config.modules.observability),
                    )
                    .map((name) => (
                      <Button key={name} onClick={() => selectAction(name)}>
                        {resource.type === 'stack' && name === 'upgrade'
                          ? t('resourcePanel.upgradeStack')
                          : actionName(name)}
                      </Button>
                    ))}
                </div>
                {result && <ComposeExport resource={result} onClose={() => setResult(null)} />}
                <ResourceDetails resource={resource} schema={schema} />
              </>
            ) : (
              <>
                {!dirty && (
                  <Button variant="ghost" onClick={back}>
                    <ArrowLeft size={15} />
                    {t('resourcePanel.back')}
                  </Button>
                )}
                {mode === 'action' && (
                  <Alert
                    tone={
                      ['remove', 'purge', 'stop', 'deactivateservices'].includes(action || '')
                        ? 'warning'
                        : 'info'
                    }
                  >
                    {t('resourcePanel.actionNotice', {
                      action: actionLabel,
                      name: resource.name || resource.id,
                      environment: app.project?.name || '',
                    })}
                  </Alert>
                )}
                {mutation.error instanceof ResourcePanelError && (
                  <Alert>{t(mutation.error.key)}</Alert>
                )}
                {!writable ? (
                  <Alert>{t('resourcePanel.readOnly')}</Alert>
                ) : unavailableInput ? (
                  <Alert>{t('resourcePanel.inputUnavailable')}</Alert>
                ) : mode === 'scale' ? (
                  scalable && schema ? (
                    <ServiceScaleForm
                      key={resource.id}
                      resource={scaleSnapshot.current || resource}
                      schema={schema}
                      onSubmit={(payload) => mutation.mutate(payload)}
                      busy={mutation.isPending}
                      error={mutation.error instanceof ResourcePanelError ? null : mutation.error}
                      onDirtyChange={setDirty}
                    />
                  ) : (
                    <Alert>{t('resourcePanel.scaleUnavailable')}</Alert>
                  )
                ) : mode === 'edit' && schema ? (
                  <SchemaForm
                    id="workspace-resource-form"
                    schema={schema}
                    schemas={schemas.data || {}}
                    original={resource}
                    onSubmit={(payload) => mutation.mutate(payload)}
                    busy={mutation.isPending}
                    error={mutation.error instanceof ResourcePanelError ? null : mutation.error}
                    onDirtyChange={setDirty}
                  />
                ) : imageUpgrade ? (
                  <ServiceUpgradeForm
                    key={resource.id}
                    bindingsEnabled={app.config.modules.workloadConfigUpgrades}
                    healthChecksEnabled={app.config.modules.workloadHealthCheckUpgrades}
                    sidecarsEnabled={app.config.modules.workloadSidecarUpgrades}
                    schedulingEnabled={app.config.modules.workloadSchedulingUpgrades}
                    resourcesEnabled={app.config.modules.workloadResourceUpgrades}
                    securityEnabled={app.config.modules.workloadSecurityUpgrades}
                    ulimitsEnabled={app.config.modules.workloadUlimitUpgrades}
                    devicesEnabled={app.config.modules.workloadDeviceUpgrades}
                    resource={resource}
                    schemas={schemas.data || {}}
                    onSubmit={(payload) => mutation.mutate(payload)}
                    busy={mutation.isPending}
                    error={mutation.error instanceof ResourcePanelError ? null : mutation.error}
                    onDirtyChange={setDirty}
                  />
                ) : actionSchema ? (
                  <SchemaForm
                    id="workspace-resource-form"
                    schema={actionSchema}
                    schemas={schemas.data || {}}
                    initialValues={lifecyclePayload(resource, action || '')}
                    onSubmit={(payload) => mutation.mutate(payload)}
                    busy={mutation.isPending}
                    error={mutation.error instanceof ResourcePanelError ? null : mutation.error}
                    onDirtyChange={setDirty}
                  />
                ) : (
                  mutation.error &&
                  !(mutation.error instanceof ResourcePanelError) && (
                    <Alert>{mutation.error.message}</Alert>
                  )
                )}
              </>
            )}
          </>
        ) : null}
      </Modal>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('resourcePanel.discardTitle')}
        description={t('resourcePanel.discardDescription')}
        onConfirm={onClose}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        busy={mutation.isPending}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={mutation.isPending ? t('resourcePanel.pendingTitle') : t('resourcePanel.leaveTitle')}
        description={
          mutation.isPending
            ? t('resourcePanel.pendingDescription')
            : t('resourcePanel.leaveDescription')
        }
        onConfirm={() => {
          if (!mutation.isPending && blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}
function ComposeExport({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const { t } = useI18n();
  function download(field: string, filename: string) {
    const content = resource[field];
    if (typeof content !== 'string') return;
    const url = URL.createObjectURL(
      new Blob([content], { type: 'application/yaml;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="panel compose-result">
      <h2>{t('resourcePanel.composeTitle')}</h2>
      <p className="muted">{t('resourcePanel.composeDescription')}</p>
      {[
        ['dockerComposeConfig', 'docker-compose.yml'],
        ['rancherComposeConfig', 'rancher-compose.yml'],
      ].map(
        ([key, filename]) =>
          typeof resource[key] === 'string' && (
            <div key={key}>
              <div className="panel-heading">
                <strong>{filename}</strong>
                <Button
                  aria-label={t('resourcePanel.downloadLabel', { filename })}
                  onClick={() => download(key, filename)}
                >
                  <Download size={15} />
                  {t('resourcePanel.download')}
                </Button>
              </div>
              <pre dir="ltr" className="configuration-viewer">
                {String(resource[key])}
              </pre>
            </div>
          ),
      )}
      <Button onClick={onClose}>{t('resourcePanel.closeResult')}</Button>
    </section>
  );
}
