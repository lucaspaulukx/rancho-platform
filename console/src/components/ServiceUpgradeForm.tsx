import { UlimitEditor } from './UlimitEditor';
import { DeviceEditor } from './DeviceEditor';
import { DeviceValidationError } from '../workload-devices';
import { ResourceValidationError } from '../resource-validation';
import { workloadValidationMessage } from '../workload-validation-message';
import { useI18n } from '../i18n/provider';
import { editableUlimits } from '../workload-ulimits';
import { CapabilityEditor } from './CapabilityEditor';
import { MemoryEditor } from './MemoryEditor';
import { CpuResourceEditor } from './CpuResourceEditor';
import { cpuFields, cpuResourceDefaults, type CpuField } from '../cpu-resources';
import { useState, type FormEvent } from 'react';
import type { Resource, Schema } from '../api';
import {
  imageName,
  imageUpgradePayload,
  configurationUpgradePayload,
  supportsConfigurationUpgrade,
  supportsHealthCheckUpgrade,
  editableHealthCheck,
  supportsSidecarUpgrade,
  editableSidecars,
  supportsSchedulingUpgrade,
  supportsResourceUpgrade,
  supportsCpuResourceUpgrade,
  supportsSecurityUpgrade,
  supportsUlimitUpgrade,
  supportsDeviceUpgrade,
  DeviceUpgradeValidationError,
  ServiceUpgradeValidationError,
  securityValues,
} from '../service-upgrade';
import { WorkloadBindingsEditor } from './WorkloadBindingsEditor';
import { HealthCheckEditor } from './HealthCheckEditor';
import { SidecarsEditor, MapField } from './SchemaForm';
import { SchedulingEditor } from './SchedulingEditor';
import { Alert, Button, CheckboxField, Confirm, Field } from './ui';

export function ServiceUpgradeForm({
  resource,
  schemas,
  bindingsEnabled = false,
  healthChecksEnabled = false,
  sidecarsEnabled = false,
  schedulingEnabled = false,
  resourcesEnabled = false,
  securityEnabled = false,
  ulimitsEnabled = false,
  devicesEnabled = false,
  onSubmit,
  onDirtyChange,
  busy,
  error,
}: {
  resource: Resource;
  bindingsEnabled?: boolean;
  healthChecksEnabled?: boolean;
  sidecarsEnabled?: boolean;
  schedulingEnabled?: boolean;
  resourcesEnabled?: boolean;
  securityEnabled?: boolean;
  ulimitsEnabled?: boolean;
  devicesEnabled?: boolean;
  schemas: Record<string, Schema>;
  onSubmit: (values: Record<string, unknown>) => void;
  onDirtyChange: (dirty: boolean) => void;
  busy: boolean;
  error: Error | null;
}) {
  const { t } = useI18n();
  const current = imageName((resource.launchConfig as Record<string, unknown>)?.imageUuid);
  const [image, setImage] = useState(current);
  const [batchSize, setBatch] = useState('1');
  const [intervalMillis, setInterval] = useState('2000');
  const [startFirst, setFirst] = useState(false);
  const [validation, setValidation] = useState<Error | 'review' | null>(null);
  function describeError(value: Error | null) {
    if (
      value instanceof DeviceValidationError ||
      value instanceof DeviceUpgradeValidationError ||
      value instanceof ServiceUpgradeValidationError ||
      value instanceof ResourceValidationError
    )
      return t(value.key);
    return workloadValidationMessage(value, t);
  }
  const launch = resource.launchConfig as Record<string, unknown>;
  const available = bindingsEnabled && supportsConfigurationUpgrade(resource, schemas);
  const [editBindings, setEditBindings] = useState(false);
  const healthAvailable = healthChecksEnabled && supportsHealthCheckUpgrade(resource, schemas);
  const [editHealthCheck, setEditHealthCheck] = useState(false);
  const [healthCheck, setHealthCheck] = useState<unknown>(() =>
    healthAvailable ? editableHealthCheck(resource, schemas) : null,
  );
  const sidecarsAvailable = sidecarsEnabled && supportsSidecarUpgrade(resource, schemas);
  const [editSidecars, setEditSidecars] = useState(false);
  const schedulingAvailable = schedulingEnabled && supportsSchedulingUpgrade(resource, schemas);
  const [editScheduling, setEditScheduling] = useState(false);
  const [labels, setLabels] = useState((launch?.labels ?? {}) as Record<string, string>);
  const [sidecars, setSidecars] = useState<unknown>(() =>
    sidecarsAvailable ? editableSidecars(resource, schemas) : [],
  );
  const resourceAvailable = resourcesEnabled && supportsResourceUpgrade(resource, schemas);
  const [editResources, setEditResources] = useState(false);
  const cpuAvailable = resourcesEnabled && supportsCpuResourceUpgrade(resource, schemas);
  const [editCpuResources, setEditCpuResources] = useState(false);
  const [cpuResources, setCpuResources] = useState(() => cpuResourceDefaults(launch ?? {}));
  const [memory, setMemory] = useState<unknown>(launch?.memory ?? 0),
    [reservation, setReservation] = useState<unknown>(launch?.memoryReservation ?? 0);
  const securityAvailable = securityEnabled && supportsSecurityUpgrade(resource, schemas);
  const [editSecurity, setEditSecurity] = useState(false);
  const [security, setSecurity] = useState(securityValues(launch));
  const ulimitsAvailable = ulimitsEnabled && supportsUlimitUpgrade(resource, schemas);
  const [editUlimits, setEditUlimits] = useState(false);
  const [ulimits, setUlimits] = useState(() => editableUlimits(launch?.ulimits));
  const devicesAvailable = devicesEnabled && supportsDeviceUpgrade(resource, schemas);
  const [editDevices, setEditDevices] = useState(false);
  const [devices, setDevices] = useState<unknown>(() => launch?.devices ?? []);
  const editingConfiguration =
    (available && editBindings) ||
    (healthAvailable && editHealthCheck) ||
    (sidecarsAvailable && editSidecars) ||
    (schedulingAvailable && editScheduling) ||
    (resourceAvailable && editResources) ||
    (cpuAvailable && editCpuResources) ||
    (securityAvailable && editSecurity) ||
    (ulimitsAvailable && editUlimits) ||
    (devicesAvailable && editDevices);
  const [ports, setPorts] = useState(launch?.ports ?? []),
    [volumes, setVolumes] = useState(launch?.dataVolumes ?? []);
  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const values = {
      image,
      batchSize,
      intervalMillis,
      startFirst,
      ...(securityAvailable && editSecurity ? { editSecurity: true, ...security } : {}),
      ...(ulimitsAvailable && editUlimits ? { editUlimits: true, ulimits } : {}),
      ...(devicesAvailable && editDevices ? { editDevices: true, devices } : {}),
      ...(resourceAvailable && editResources
        ? { editResources: true, memory, memoryReservation: reservation }
        : {}),
      ...(cpuAvailable && editCpuResources ? { editCpuResources: true, cpuResources } : {}),
      ...(available && editBindings ? { editBindings: true, ports, dataVolumes: volumes } : {}),
      ...(healthAvailable && editHealthCheck ? { editHealthCheck: true, healthCheck } : {}),
      ...(schedulingAvailable && editScheduling ? { editScheduling: true, labels } : {}),
      ...(sidecarsAvailable && editSidecars
        ? { editSidecars: true, secondaryLaunchConfigs: sidecars }
        : {}),
    };
    try {
      if (editingConfiguration) configurationUpgradePayload(resource, resource, values, schemas);
      else imageUpgradePayload(resource, values, schemas);
      setValidation(null);
      if (editingConfiguration) setReview(values);
      else onSubmit(values);
    } catch (caught) {
      setValidation(caught instanceof Error ? caught : 'review');
    }
  }
  return (
    <>
      <form id="workspace-resource-form" onSubmit={submit} onChange={() => onDirtyChange(true)}>
        <fieldset disabled={busy} className="form-fieldset">
          <legend>
            {t(
              editingConfiguration
                ? 'serviceUpgradeForm.configuration'
                : 'serviceUpgradeForm.imageUpgrade',
            )}
          </legend>
          <p className="muted">
            {t('serviceUpgradeForm.currentImage')} <code>{current}</code>
          </p>
          <Field label={t('serviceUpgradeForm.image')}>
            {(id) => (
              <input
                id={id}
                value={image}
                required
                onChange={(event) => setImage(event.target.value)}
                placeholder="registry/aplicacao:versao"
              />
            )}
          </Field>
          {available && (
            <CheckboxField
              label={t('serviceUpgradeForm.bindings')}
              checked={editBindings}
              onChange={(e) => {
                setEditBindings(e.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {available && editBindings && (
            <>
              <WorkloadBindingsEditor
                kind="ports"
                value={ports}
                onChange={(value) => {
                  setPorts(value);
                  onDirtyChange(true);
                }}
              />
              <WorkloadBindingsEditor
                kind="dataVolumes"
                value={volumes}
                onChange={(value) => {
                  setVolumes(value);
                  onDirtyChange(true);
                }}
              />
            </>
          )}
          {healthAvailable && (
            <CheckboxField
              label={t('serviceUpgradeForm.health')}
              checked={editHealthCheck}
              onChange={(e) => {
                setEditHealthCheck(e.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {healthAvailable && editHealthCheck && (
            <HealthCheckEditor
              value={healthCheck}
              schema={schemas.instanceHealthCheck}
              quorum={schemas.recreateOnQuorumStrategyConfig}
              onChange={(value) => {
                setHealthCheck(value);
                onDirtyChange(true);
              }}
            />
          )}
          {sidecarsAvailable && (
            <CheckboxField
              label={t('serviceUpgradeForm.sidecars')}
              checked={editSidecars}
              onChange={(e) => {
                setEditSidecars(e.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {ulimitsAvailable && (
            <CheckboxField
              label={t('serviceUpgradeForm.ulimits')}
              checked={editUlimits}
              onChange={(event) => {
                setEditUlimits(event.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {ulimitsAvailable && editUlimits && (
            <>
              <Alert tone="info">{t('serviceUpgradeForm.limitsNotice')}</Alert>
              <UlimitEditor
                value={ulimits}
                onChange={(value) => {
                  setUlimits(value);
                  onDirtyChange(true);
                }}
              />
            </>
          )}
          {devicesAvailable && (
            <CheckboxField
              label={t('deviceUpgradeForm.edit')}
              checked={editDevices}
              onChange={(event) => {
                setEditDevices(event.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {devicesAvailable && editDevices && (
            <>
              <Alert tone="info">{t('deviceUpgradeForm.impact')}</Alert>
              <DeviceEditor
                value={devices}
                onChange={(value) => {
                  setDevices(value);
                  onDirtyChange(true);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                disabled={Array.isArray(devices) && devices.length === 0}
                onClick={() => {
                  setDevices([]);
                  onDirtyChange(true);
                }}
              >
                {t('deviceUpgradeForm.reset')}
              </Button>
            </>
          )}
          {securityAvailable && (
            <CheckboxField
              label={t('serviceUpgradeForm.security')}
              checked={editSecurity}
              onChange={(e) => {
                setEditSecurity(e.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {securityAvailable && editSecurity && (
            <>
              <Alert tone="info">{t('serviceUpgradeForm.securityNotice')}</Alert>
              <CheckboxField
                label={t('serviceUpgradeForm.privileged')}
                checked={security.privileged === true}
                onChange={(e) => {
                  setSecurity({ ...security, privileged: e.target.checked });
                  onDirtyChange(true);
                }}
              />
              <CheckboxField
                label={t('serviceUpgradeForm.readOnly')}
                checked={security.readOnly === true}
                onChange={(e) => {
                  setSecurity({ ...security, readOnly: e.target.checked });
                  onDirtyChange(true);
                }}
              />
              {(['capAdd', 'capDrop'] as const).map((key) => (
                <CapabilityEditor
                  key={key}
                  label={t(
                    key === 'capAdd' ? 'serviceUpgradeForm.capAdd' : 'serviceUpgradeForm.capDrop',
                  )}
                  value={security[key]}
                  options={schemas.launchConfig.resourceFields[key].options!}
                  onChange={(v) => {
                    setSecurity({ ...security, [key]: v });
                    onDirtyChange(true);
                  }}
                />
              ))}
            </>
          )}
          {resourceAvailable && (
            <CheckboxField
              label={t('serviceUpgradeForm.memory')}
              checked={editResources}
              onChange={(e) => {
                setEditResources(e.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {resourceAvailable && editResources && (
            <>
              <MemoryEditor
                label={t('serviceUpgradeForm.memoryLimit')}
                value={memory}
                onChange={(v) => {
                  setMemory(v);
                  onDirtyChange(true);
                }}
              />
              <MemoryEditor
                label={t('serviceUpgradeForm.memoryReservation')}
                value={reservation}
                onChange={(v) => {
                  setReservation(v);
                  onDirtyChange(true);
                }}
              />
            </>
          )}
          {cpuAvailable && (
            <CheckboxField
              label={t('serviceUpgradeForm.cpu')}
              checked={editCpuResources}
              onChange={(event) => {
                setEditCpuResources(event.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {cpuAvailable &&
            editCpuResources &&
            (Object.keys(cpuFields) as CpuField[]).map((name) => (
              <CpuResourceEditor
                key={name}
                name={name}
                value={cpuResources[name]}
                onChange={(value) => {
                  setCpuResources((previous) => ({
                    ...previous,
                    [name]: name === 'cpuSet' && value == null ? '' : value,
                  }));
                  onDirtyChange(true);
                }}
              />
            ))}
          {schedulingAvailable && (
            <CheckboxField
              label={t('serviceUpgradeForm.affinity')}
              checked={editScheduling}
              onChange={(e) => {
                setEditScheduling(e.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {schedulingAvailable && editScheduling && (
            <SchedulingEditor
              value={labels}
              onChange={(value) => {
                setLabels(value);
                onDirtyChange(true);
              }}
              renderLabels={(value, onChange) => (
                <div className="field">
                  <MapField name="Labels" value={value} onChange={onChange} />
                </div>
              )}
            />
          )}
          {sidecarsAvailable && editSidecars && (
            <SidecarsEditor
              value={sidecars}
              schemas={schemas}
              references={{}}
              bindingEditors={bindingsEnabled}
              healthCheckEditors={healthChecksEnabled}
              onChange={(value) => {
                setSidecars(value);
                onDirtyChange(true);
              }}
            />
          )}
          <div className="form-grid">
            <Field label={t('serviceUpgradeForm.batch')}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={batchSize}
                  onChange={(event) => setBatch(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('serviceUpgradeForm.interval')}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={100}
                  step={1}
                  required
                  value={intervalMillis}
                  onChange={(event) => setInterval(event.target.value)}
                />
              )}
            </Field>
          </div>
          <label className="workload-system">
            <input
              type="checkbox"
              checked={startFirst}
              onChange={(event) => setFirst(event.target.checked)}
            />
            {t('serviceUpgradeForm.startFirst')}
          </label>
          <Alert>
            {t('serviceUpgradeForm.batchNotice', {
              batch: batchSize || '—',
              interval: intervalMillis || '—',
            })}
          </Alert>
          <p className="muted">{t('serviceUpgradeForm.follow')}</p>
          {(validation || error) && (
            <Alert tone="danger">
              {validation === 'review'
                ? t('serviceUpgradeForm.review')
                : describeError(validation || error)}
            </Alert>
          )}
        </fieldset>
      </form>
      <Confirm
        open={!!review}
        onOpenChange={(open) => {
          if (!open && !busy) setReview(null);
        }}
        title={
          review?.editDevices === true
            ? t('deviceUpgradeForm.confirmTitle')
            : t('serviceUpgradeForm.confirm')
        }
        description={
          review?.editDevices === true
            ? t('deviceUpgradeForm.confirmDescription', { service: resource.name || resource.id })
            : t('serviceUpgradeForm.impact', { service: resource.name || resource.id })
        }
        busy={busy}
        onConfirm={() => {
          if (review) {
            onSubmit(review);
            setReview(null);
          }
        }}
      />
    </>
  );
}
