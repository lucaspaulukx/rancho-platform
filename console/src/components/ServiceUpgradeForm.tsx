import { UlimitEditor } from './UlimitEditor';
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
  securityValues,
} from '../service-upgrade';
import { WorkloadBindingsEditor } from './WorkloadBindingsEditor';
import { HealthCheckEditor } from './HealthCheckEditor';
import { SidecarsEditor, MapField } from './SchemaForm';
import { SchedulingEditor } from './SchedulingEditor';
import { Alert, CheckboxField, Confirm, Field } from './ui';

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
  schemas: Record<string, Schema>;
  onSubmit: (values: Record<string, unknown>) => void;
  onDirtyChange: (dirty: boolean) => void;
  busy: boolean;
  error: Error | null;
}) {
  const current = imageName((resource.launchConfig as Record<string, unknown>)?.imageUuid);
  const [image, setImage] = useState(current);
  const [batchSize, setBatch] = useState('1');
  const [intervalMillis, setInterval] = useState('2000');
  const [startFirst, setFirst] = useState(false);
  const [validation, setValidation] = useState('');
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
  const editingConfiguration =
    (available && editBindings) ||
    (healthAvailable && editHealthCheck) ||
    (sidecarsAvailable && editSidecars) ||
    (schedulingAvailable && editScheduling) ||
    (resourceAvailable && editResources) ||
    (cpuAvailable && editCpuResources) ||
    (securityAvailable && editSecurity) ||
    (ulimitsAvailable && editUlimits);
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
      setValidation('');
      if (editingConfiguration) setReview(values);
      else onSubmit(values);
    } catch (caught) {
      setValidation(caught instanceof Error ? caught.message : 'Revise a atualização.');
    }
  }
  return (
    <>
      <form id="workspace-resource-form" onSubmit={submit} onChange={() => onDirtyChange(true)}>
        <fieldset disabled={busy} className="form-fieldset">
          <legend>
            {editingConfiguration ? 'Atualização da configuração' : 'Atualização da imagem'}
          </legend>
          <p className="muted">
            Imagem atual: <code>{current}</code>
          </p>
          <Field label="Nova imagem">
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
              label="Editar portas e volumes nesta atualização"
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
              label="Editar verificação de saúde nesta atualização"
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
              label="Editar sidecars nesta atualização"
              checked={editSidecars}
              onChange={(e) => {
                setEditSidecars(e.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {ulimitsAvailable && (
            <CheckboxField
              label="Editar limites de processo nesta atualização"
              checked={editUlimits}
              onChange={(event) => {
                setEditUlimits(event.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {ulimitsAvailable && editUlimits && (
            <>
              <Alert tone="info">
                Alterar limites substitui os containers do serviço. Uma lista vazia retira os
                limites explícitos e passa a herdar o Docker.
              </Alert>
              <UlimitEditor
                value={ulimits}
                onChange={(value) => {
                  setUlimits(value);
                  onDirtyChange(true);
                }}
              />
            </>
          )}
          {securityAvailable && (
            <CheckboxField
              label="Editar segurança nesta atualização"
              checked={editSecurity}
              onChange={(e) => {
                setEditSecurity(e.target.checked);
                onDirtyChange(true);
              }}
            />
          )}
          {securityAvailable && editSecurity && (
            <>
              <Alert tone="info">
                Mudanças de segurança substituem os containers do serviço. Revise capabilities,
                acesso ao host e sistema de arquivos antes de confirmar.
              </Alert>
              <CheckboxField
                label="Modo privilegiado"
                checked={security.privileged === true}
                onChange={(e) => {
                  setSecurity({ ...security, privileged: e.target.checked });
                  onDirtyChange(true);
                }}
              />
              <CheckboxField
                label="Sistema de arquivos somente leitura"
                checked={security.readOnly === true}
                onChange={(e) => {
                  setSecurity({ ...security, readOnly: e.target.checked });
                  onDirtyChange(true);
                }}
              />
              {(['capAdd', 'capDrop'] as const).map((key) => (
                <CapabilityEditor
                  key={key}
                  label={key === 'capAdd' ? 'Capabilities adicionais' : 'Capabilities removidas'}
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
              label="Editar memória nesta atualização"
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
                label="Limite de memória"
                value={memory}
                onChange={(v) => {
                  setMemory(v);
                  onDirtyChange(true);
                }}
              />
              <MemoryEditor
                label="Reserva de memória"
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
              label="Editar CPU e I/O nesta atualização"
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
              label="Editar afinidades nesta atualização"
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
            <Field label="Containers por lote">
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
            <Field label="Intervalo entre lotes (ms)">
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
            Iniciar novos containers antes de parar os atuais
          </label>
          <Alert>
            Serão atualizados até {batchSize || '—'} containers por lote, com intervalo de{' '}
            {intervalMillis || '—'} ms. Portas, variáveis, volumes e sidecars seguem a configuração
            atual do serviço, exceto as opções explicitamente editadas acima. A disponibilidade
            depende da capacidade e da saúde da aplicação.
          </Alert>
          <p className="muted">
            Após a troca, acompanhe o estado nesta tela. Concluir atualização e Reverter atualização
            aparecem conforme as ações disponíveis no Rancher.
          </p>
          {(validation || error) && <Alert tone="danger">{validation || error?.message}</Alert>}
        </fieldset>
      </form>
      <Confirm
        open={!!review}
        onOpenChange={(open) => {
          if (!open && !busy) setReview(null);
        }}
        title="Atualizar configuração do serviço?"
        description={`Serviço ${resource.name || resource.id}. Portas publicadas podem mudar o acesso; alterar montagens pode tornar dados anteriores indisponíveis. Editar ou remover sidecars substitui containers auxiliares e pode afetar dados/rede. Verificações de saúde podem recriar containers ou interromper a atualização se o endpoint falhar. O Rancher substituirá containers conforme a estratégia escolhida. Revise os campos antes de confirmar.`}
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
