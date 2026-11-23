import { supportsUlimits, normalizeUlimits, editableUlimits } from './workload-ulimits';
import { normalizeDevices, supportsDevices } from './workload-devices';
import { ptDeviceUpgrade } from './i18n/domains/device-upgrade';
import { ptServiceUpgradeForm } from './i18n/domains/service-upgrade-form';
import { validateWorkloadSecurity } from './workload-security';
import { validateWorkloadResources } from './workload-resources';
import { cpuFields, cpuResourceDefaults, validatedCpuResources } from './cpu-resources';
import type { Resource, Schema } from './api';
import { validateBindings } from './workload-bindings';
import { preparePayload } from './components/SchemaForm';
import { decodeHealthRequest, validateHealthCheck } from './workload-healthchecks';
import { validateWorkloadHealthChecks } from './workload-healthchecks';
import { validateSidecars } from './workload-sidecars';
import { validateSchedulingLabels } from './workload-scheduling';

type DeviceUpgradeErrorKey = Extract<keyof typeof ptDeviceUpgrade, `deviceUpgrade.error.${string}`>;
type ServiceUpgradeErrorKey = Extract<
  keyof typeof ptServiceUpgradeForm,
  `serviceUpgradeForm.validation.${string}`
>;
export class ServiceUpgradeValidationError extends Error {
  constructor(readonly key: ServiceUpgradeErrorKey) {
    super(ptServiceUpgradeForm[key]);
  }
}
export class DeviceUpgradeValidationError extends Error {
  constructor(public readonly key: DeviceUpgradeErrorKey) {
    super(ptDeviceUpgrade[key]);
    this.name = 'DeviceUpgradeValidationError';
  }
}

export function imageName(value: unknown) {
  return typeof value === 'string' ? value.replace(/^docker:/, '') : '';
}
export function supportsImageUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  return (
    resource.type === 'service' &&
    !!resource.launchConfig &&
    schemas.service?.resourceActions?.upgrade?.input === 'serviceUpgrade' &&
    schemas.serviceUpgrade?.resourceFields.inServiceStrategy?.create === true &&
    schemas.inServiceUpgradeStrategy?.resourceFields.launchConfig?.create === true &&
    schemas.launchConfig?.resourceFields.imageUuid?.create === true
  );
}
function upgradePayload(
  resource: Resource,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
  allowSameImage = false,
) {
  if (!supportsImageUpgrade(resource, schemas))
    throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.contract');
  if (
    Array.isArray(resource.secondaryLaunchConfigs) &&
    resource.secondaryLaunchConfigs.length &&
    !schemas.secondaryLaunchConfig
  )
    throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.sidecarContract');
  const image = imageName(values.image).trim();
  if (!image || /\s/.test(image))
    throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.image');
  const batch = Number(values.batchSize),
    interval = Number(values.intervalMillis);
  if (String(values.batchSize ?? '').trim() === '' || !Number.isSafeInteger(batch) || batch < 1)
    throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.batch');
  if (
    String(values.intervalMillis ?? '').trim() === '' ||
    !Number.isSafeInteger(interval) ||
    interval < 100
  )
    throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.interval');
  if (typeof values.startFirst !== 'boolean')
    throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.order');
  const launch = resource.launchConfig as Record<string, unknown>;
  if (!allowSameImage && image === imageName(launch.imageUuid))
    throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.differentImage');
  return preparePayload(
    schemas.serviceUpgrade,
    {
      inServiceStrategy: {
        batchSize: batch,
        intervalMillis: interval,
        startFirst: values.startFirst,
        launchConfig: { ...launch, imageUuid: `docker:${image}` },
        ...(Array.isArray(resource.secondaryLaunchConfigs)
          ? { secondaryLaunchConfigs: resource.secondaryLaunchConfigs }
          : {}),
      },
    },
    undefined,
    schemas,
  );
}

export function imageUpgradePayload(
  resource: Resource,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
) {
  return upgradePayload(resource, values, schemas);
}
export function supportsConfigurationUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  return (
    supportsImageUpgrade(resource, schemas) &&
    ['ports', 'dataVolumes'].every(
      (name) => schemas.launchConfig?.resourceFields[name]?.create === true,
    )
  );
}
export function supportsUlimitUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  return (
    supportsImageUpgrade(resource, schemas) &&
    supportsUlimits(schemas.launchConfig?.resourceFields.ulimits, schemas)
  );
}
export function supportsDeviceUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  return (
    supportsImageUpgrade(resource, schemas) &&
    supportsDevices(schemas.launchConfig?.resourceFields.devices)
  );
}
export function supportsSidecarDeviceUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  return (
    supportsSidecarUpgrade(resource, schemas) &&
    schemas.serviceUpgrade?.resourceFields.inServiceStrategy?.type === 'inServiceUpgradeStrategy' &&
    schemas.inServiceUpgradeStrategy?.resourceFields.launchConfig?.type === 'launchConfig' &&
    schemas.inServiceUpgradeStrategy?.resourceFields.secondaryLaunchConfigs?.type ===
      'array[secondaryLaunchConfig]' &&
    schemas.secondaryLaunchConfig?.resourceFields.name?.type === 'string' &&
    schemas.secondaryLaunchConfig?.resourceFields.imageUuid?.type === 'string' &&
    supportsDevices(schemas.secondaryLaunchConfig?.resourceFields.devices)
  );
}
export function supportsSecurityUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  return (
    supportsImageUpgrade(resource, schemas) &&
    ['capAdd', 'capDrop'].every(
      (k) =>
        schemas.launchConfig?.resourceFields[k]?.create === true &&
        schemas.launchConfig.resourceFields[k].type === 'array[enum]' &&
        Array.isArray(schemas.launchConfig.resourceFields[k].options),
    ) &&
    ['readOnly', 'privileged'].every(
      (k) =>
        schemas.launchConfig?.resourceFields[k]?.create === true &&
        schemas.launchConfig.resourceFields[k].type === 'boolean',
    )
  );
}
export function securityValues(value: Record<string, unknown>) {
  return {
    capAdd: value.capAdd ?? [],
    capDrop: value.capDrop ?? [],
    readOnly: value.readOnly ?? false,
    privileged: value.privileged ?? false,
  };
}
export function supportsResourceUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  return (
    supportsImageUpgrade(resource, schemas) &&
    ['memory', 'memoryReservation'].every(
      (key) =>
        schemas.launchConfig?.resourceFields[key]?.create === true &&
        ['int', 'long'].includes(schemas.launchConfig.resourceFields[key].type),
    )
  );
}
export function supportsCpuResourceUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  return (
    supportsImageUpgrade(resource, schemas) &&
    Object.keys(cpuFields).every((key) => {
      const field = schemas.launchConfig?.resourceFields[key];
      return (
        field?.create === true &&
        (key === 'cpuSet' ? field.type === 'string' : ['int', 'long'].includes(field.type))
      );
    })
  );
}
export function supportsSchedulingUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  if (
    !supportsImageUpgrade(resource, schemas) ||
    schemas.launchConfig?.resourceFields.labels?.create !== true ||
    schemas.launchConfig.resourceFields.labels.type !== 'map[string]'
  )
    return false;
  try {
    validateSchedulingLabels((resource.launchConfig as Record<string, unknown>).labels ?? {});
    return true;
  } catch {
    return false;
  }
}
export function supportsHealthCheckUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  const current = (resource.launchConfig as Record<string, unknown> | undefined)?.healthCheck as
    Record<string, unknown> | undefined;
  return (
    supportsImageUpgrade(resource, schemas) &&
    schemas.launchConfig?.resourceFields.healthCheck?.create === true &&
    schemas.launchConfig.resourceFields.healthCheck.type === 'instanceHealthCheck' &&
    schemas.instanceHealthCheck?.resourceFields.port?.create === true &&
    (!current?.requestLine ||
      (typeof current.requestLine === 'string' && !!decodeHealthRequest(current.requestLine)))
  );
}
export function editableHealthCheck(resource: Resource, schemas: Record<string, Schema>) {
  const current = (resource.launchConfig as Record<string, unknown>)?.healthCheck;
  return current == null
    ? null
    : preparePayload(
        schemas.instanceHealthCheck,
        current as Record<string, unknown>,
        undefined,
        schemas,
      );
}
export function supportsSidecarUpgrade(resource: Resource, schemas: Record<string, Schema>) {
  const existing = resource.secondaryLaunchConfigs ?? [];
  return (
    supportsImageUpgrade(resource, schemas) &&
    schemas.inServiceUpgradeStrategy?.resourceFields.secondaryLaunchConfigs?.create === true &&
    schemas.secondaryLaunchConfig?.resourceFields.name?.create === true &&
    schemas.secondaryLaunchConfig.resourceFields.imageUuid?.create === true &&
    resource.selectorContainer == null &&
    Array.isArray(existing) &&
    existing.every((v) => {
      const hc = v?.healthCheck;
      return (
        !hc?.requestLine ||
        (typeof hc.requestLine === 'string' && !!decodeHealthRequest(hc.requestLine))
      );
    })
  );
}
export function editableSidecars(resource: Resource, schemas: Record<string, Schema>) {
  return Array.isArray(resource.secondaryLaunchConfigs)
    ? resource.secondaryLaunchConfigs.map((value): Record<string, unknown> => {
        const schema = schemas.secondaryLaunchConfig;
        const draftSchema = supportsDevices(schema.resourceFields.devices)
          ? schema
          : {
              ...schema,
              resourceFields: Object.fromEntries(
                Object.entries(schema.resourceFields).filter(([name]) => name !== 'devices'),
              ),
            };
        const prepared = preparePayload(draftSchema, value, undefined, schemas);
        // Retain native device data in the draft even when the current create schema omits it.
        // The fresh submission contract must reject loss rather than silently clearing mappings.
        return Object.hasOwn(value, 'devices') ? { ...prepared, devices: value.devices } : prepared;
      })
    : [];
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
function bindingsSnapshot(resource: Resource) {
  const launch = resource.launchConfig as Record<string, unknown>;
  return JSON.stringify(
    canonical({
      imageUuid: launch?.imageUuid,
      ports: launch?.ports ?? [],
      dataVolumes: launch?.dataVolumes ?? [],
      secondaryLaunchConfigs: resource.secondaryLaunchConfigs ?? [],
    }),
  );
}
export function configurationUpgradePayload(
  before: Resource,
  fresh: Resource,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
) {
  const deviceEditing = values.editDevices === true || values.editSidecarDevices === true;
  if (
    values.editSidecarDevices === true &&
    (values.editSidecars !== true || !supportsSidecarDeviceUpgrade(fresh, schemas))
  )
    throw new DeviceUpgradeValidationError('deviceUpgrade.error.unavailable');
  if (
    !(values.editDevices === true
      ? supportsDeviceUpgrade(fresh, schemas)
      : values.editUlimits === true
        ? supportsUlimitUpgrade(fresh, schemas)
        : values.editBindings === true
          ? supportsConfigurationUpgrade(fresh, schemas)
          : values.editHealthCheck === true
            ? supportsHealthCheckUpgrade(fresh, schemas)
            : values.editSidecars === true
              ? supportsSidecarUpgrade(fresh, schemas)
              : values.editScheduling === true
                ? supportsSchedulingUpgrade(fresh, schemas)
                : values.editCpuResources === true
                  ? supportsCpuResourceUpgrade(fresh, schemas)
                  : values.editResources === true
                    ? supportsResourceUpgrade(fresh, schemas)
                    : values.editSecurity === true
                      ? supportsSecurityUpgrade(fresh, schemas)
                      : supportsConfigurationUpgrade(fresh, schemas)) ||
    before.id !== fresh.id ||
    before.type !== fresh.type ||
    before.accountId !== fresh.accountId ||
    before.stackId !== fresh.stackId ||
    fresh.removed ||
    !['active', 'inactive'].includes(fresh.state || '') ||
    !fresh.actions?.upgrade
  )
    throw deviceEditing
      ? new DeviceUpgradeValidationError('deviceUpgrade.error.unavailable')
      : new Error('A atualização de configuração não está disponível neste serviço.');
  if (
    bindingsSnapshot(before) !== bindingsSnapshot(fresh) ||
    ((values.editHealthCheck === true ||
      values.editSidecars === true ||
      values.editScheduling === true ||
      values.editResources === true ||
      values.editCpuResources === true ||
      values.editSecurity === true ||
      values.editUlimits === true ||
      values.editDevices === true) &&
      JSON.stringify(canonical([before.launchConfig, before.secondaryLaunchConfigs])) !==
        JSON.stringify(canonical([fresh.launchConfig, fresh.secondaryLaunchConfigs])))
  )
    throw deviceEditing
      ? new DeviceUpgradeValidationError('deviceUpgrade.error.conflict')
      : new Error('A configuração foi alterada por outro cliente. Reabra o upgrade.');
  const launch = fresh.launchConfig as Record<string, unknown>;
  const editBindings =
    values.editBindings === true ||
    (values.editHealthCheck !== true &&
      values.editSidecars !== true &&
      values.editScheduling !== true &&
      values.editResources !== true &&
      values.editCpuResources !== true &&
      values.editSecurity !== true &&
      values.editUlimits !== true &&
      values.editDevices !== true);
  if (editBindings) {
    validateBindings('ports', values.ports, launch.ports ?? []);
    validateBindings('dataVolumes', values.dataVolumes, launch.dataVolumes ?? []);
  }
  if (values.editHealthCheck === true) {
    if (values.healthCheck === undefined)
      throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.health');
    if (!supportsHealthCheckUpgrade(fresh, schemas))
      throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.healthContract');
    validateHealthCheck(
      values.healthCheck,
      schemas.instanceHealthCheck,
      schemas.recreateOnQuorumStrategyConfig,
    );
  }
  if (values.editUlimits === true) {
    if (!supportsUlimitUpgrade(fresh, schemas))
      throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.ulimitContract');
    normalizeUlimits(values.ulimits);
  }
  if (values.editDevices === true) {
    if (!supportsDeviceUpgrade(fresh, schemas))
      throw new DeviceUpgradeValidationError('deviceUpgrade.error.unavailable');
    normalizeDevices(values.devices);
  }
  if (values.editSecurity === true) {
    if (
      !supportsSecurityUpgrade(fresh, schemas) ||
      typeof values.readOnly !== 'boolean' ||
      typeof values.privileged !== 'boolean' ||
      !Array.isArray(values.capAdd) ||
      !Array.isArray(values.capDrop)
    )
      throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.securityContract');
    validateWorkloadSecurity(schemas.launchConfig, securityValues(values), schemas);
  }
  if (values.editResources === true) {
    if (
      !supportsResourceUpgrade(fresh, schemas) ||
      values.memory === undefined ||
      values.memoryReservation === undefined
    )
      throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.memory');
    validateWorkloadResources(
      schemas.launchConfig,
      { memory: values.memory, memoryReservation: values.memoryReservation },
      schemas,
    );
  }
  if (values.editCpuResources === true) {
    if (!supportsCpuResourceUpgrade(fresh, schemas))
      throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.cpuContract');
    validatedCpuResources(values.cpuResources);
  }
  if (values.editScheduling === true) {
    if (!supportsSchedulingUpgrade(fresh, schemas))
      throw new ServiceUpgradeValidationError('serviceUpgradeForm.validation.schedulingContract');
    validateSchedulingLabels(values.labels);
  }
  if (values.editSidecars === true) {
    if (!supportsSidecarUpgrade(fresh, schemas) || !Array.isArray(values.secondaryLaunchConfigs))
      throw new ServiceUpgradeValidationError(
        'serviceUpgradeForm.validation.sidecarUpgradeContract',
      );
    const next = {
      name: fresh.name,
      launchConfig: {
        ...launch,
        ...(values.editHealthCheck === true ? { healthCheck: values.healthCheck } : {}),
      },
      secondaryLaunchConfigs: values.secondaryLaunchConfigs,
    };
    validateSidecars(next, schemas);
    if (values.editSidecarDevices === true) {
      const originals = new Map(
        ((fresh.secondaryLaunchConfigs ?? []) as Record<string, unknown>[]).map((row) => [
          row.name,
          row,
        ]),
      );
      for (const row of values.secondaryLaunchConfigs as Record<string, unknown>[]) {
        const original = originals.get(row.name);
        if (JSON.stringify(row.devices) !== JSON.stringify(original?.devices)) {
          // Clearing a kept mapping is explicit ([]); omission must never imply a reset.
          if (row.devices === undefined)
            throw new DeviceUpgradeValidationError('deviceUpgrade.error.unavailable');
          normalizeDevices(row.devices);
        }
      }
    }
    validateWorkloadHealthChecks(
      {
        ...schemas.service,
        resourceFields: {
          ...schemas.service.resourceFields,
          secondaryLaunchConfigs: { type: 'array[secondaryLaunchConfig]', create: true },
        },
      },
      { secondaryLaunchConfigs: values.secondaryLaunchConfigs },
      schemas,
    );
  }
  if (
    imageName(values.image).trim() === imageName(launch.imageUuid) &&
    (!editBindings ||
      (JSON.stringify(values.ports) === JSON.stringify(launch.ports ?? []) &&
        JSON.stringify(values.dataVolumes) === JSON.stringify(launch.dataVolumes ?? []))) &&
    (values.editHealthCheck !== true ||
      JSON.stringify(canonical(values.healthCheck)) ===
        JSON.stringify(canonical(editableHealthCheck(fresh, schemas)))) &&
    (values.editSidecars !== true ||
      JSON.stringify(canonical(values.secondaryLaunchConfigs)) ===
        JSON.stringify(canonical(editableSidecars(fresh, schemas)))) &&
    (values.editScheduling !== true ||
      JSON.stringify(canonical(values.labels)) ===
        JSON.stringify(canonical(launch.labels ?? {}))) &&
    (values.editResources !== true ||
      (values.memory === (launch.memory ?? 0) &&
        values.memoryReservation === (launch.memoryReservation ?? 0))) &&
    (values.editCpuResources !== true ||
      JSON.stringify(canonical(validatedCpuResources(values.cpuResources))) ===
        JSON.stringify(canonical(cpuResourceDefaults(launch)))) &&
    (values.editUlimits !== true ||
      JSON.stringify(canonical(normalizeUlimits(values.ulimits))) ===
        JSON.stringify(canonical(editableUlimits(launch.ulimits)))) &&
    (values.editDevices !== true ||
      JSON.stringify(normalizeDevices(values.devices)) === JSON.stringify(launch.devices ?? [])) &&
    (values.editSecurity !== true ||
      JSON.stringify(canonical(securityValues(values))) ===
        JSON.stringify(canonical(securityValues(launch))))
  )
    throw deviceEditing
      ? new DeviceUpgradeValidationError('deviceUpgrade.error.noChange')
      : new Error('Altere a imagem ou a configuração antes de atualizar.');
  const result = upgradePayload(
    {
      ...fresh,
      ...(values.editSidecars === true
        ? { secondaryLaunchConfigs: values.secondaryLaunchConfigs }
        : {}),
      launchConfig: {
        ...launch,
        ...(values.editSecurity === true ? securityValues(values) : {}),
        ...(values.editUlimits === true ? { ulimits: normalizeUlimits(values.ulimits) } : {}),
        ...(values.editDevices === true ? { devices: normalizeDevices(values.devices) } : {}),
        ...(editBindings ? { ports: values.ports, dataVolumes: values.dataVolumes } : {}),
        ...(values.editResources === true
          ? { memory: values.memory, memoryReservation: values.memoryReservation }
          : {}),
        ...(values.editCpuResources === true ? validatedCpuResources(values.cpuResources) : {}),
        ...(values.editScheduling === true ? { labels: values.labels } : {}),
        ...(values.editHealthCheck === true ? { healthCheck: values.healthCheck } : {}),
      },
    },
    values,
    schemas,
    true,
  );
  if (values.editDevices === true && values.editSidecars !== true) {
    const original = (fresh.secondaryLaunchConfigs ?? []) as Record<string, unknown>[];
    const strategy = result.inServiceStrategy as Record<string, unknown>;
    const prepared = (strategy.secondaryLaunchConfigs ?? []) as Record<string, unknown>[];
    if (
      Array.isArray(original) &&
      original.some(
        (sidecar, index) =>
          Array.isArray(sidecar.devices) &&
          sidecar.devices.length > 0 &&
          JSON.stringify(sidecar.devices) !== JSON.stringify(prepared[index]?.devices),
      )
    )
      throw new DeviceUpgradeValidationError('deviceUpgrade.error.unavailable');
  }
  if (values.editSidecarDevices === true) {
    const strategy = result.inServiceStrategy as Record<string, unknown>;
    const prepared = new Map(
      ((strategy.secondaryLaunchConfigs ?? []) as Record<string, unknown>[]).map((row) => [
        row.name,
        row,
      ]),
    );
    for (const row of values.secondaryLaunchConfigs as Record<string, unknown>[])
      if (JSON.stringify(row.devices) !== JSON.stringify(prepared.get(row.name)?.devices))
        throw new DeviceUpgradeValidationError('deviceUpgrade.error.unavailable');
    const intendedPrimary =
      values.editDevices === true ? normalizeDevices(values.devices) : launch.devices;
    if (
      JSON.stringify(intendedPrimary) !==
      JSON.stringify((strategy.launchConfig as Record<string, unknown>).devices)
    )
      throw new DeviceUpgradeValidationError('deviceUpgrade.error.unavailable');
  }
  if (values.editCpuResources === true) {
    // An explicit empty cpuset removes pinning; the generic create serializer omits empty strings.
    const strategy = result.inServiceStrategy as Record<string, unknown>;
    (strategy.launchConfig as Record<string, unknown>).cpuSet = validatedCpuResources(
      values.cpuResources,
    ).cpuSet;
  }
  if (values.editSidecars === true) {
    const names = new Set(
      (values.secondaryLaunchConfigs as Record<string, unknown>[]).map((v) => v.name),
    );
    const removals = editableSidecars(fresh, schemas)
      .filter((v) => !names.has(v.name))
      .map((v) => ({ name: v.name, imageUuid: 'rancher/none' }));
    const strategy = result.inServiceStrategy as Record<string, unknown>;
    strategy.secondaryLaunchConfigs = [
      ...(strategy.secondaryLaunchConfigs as unknown[]),
      ...removals,
    ];
  }
  return result;
}
