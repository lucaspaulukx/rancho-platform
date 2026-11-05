import { supportsUlimits, normalizeUlimits, editableUlimits } from './workload-ulimits';
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
    throw new Error('O contrato de atualização não está disponível.');
  if (
    Array.isArray(resource.secondaryLaunchConfigs) &&
    resource.secondaryLaunchConfigs.length &&
    !schemas.secondaryLaunchConfig
  )
    throw new Error('O contrato dos sidecars não está disponível.');
  const image = imageName(values.image).trim();
  if (!image || /\s/.test(image)) throw new Error('Informe uma imagem válida, sem espaços.');
  const batch = Number(values.batchSize),
    interval = Number(values.intervalMillis);
  if (String(values.batchSize ?? '').trim() === '' || !Number.isSafeInteger(batch) || batch < 1)
    throw new Error('O lote deve ser um inteiro de pelo menos 1.');
  if (
    String(values.intervalMillis ?? '').trim() === '' ||
    !Number.isSafeInteger(interval) ||
    interval < 100
  )
    throw new Error('O intervalo deve ser um inteiro de pelo menos 100 ms.');
  if (typeof values.startFirst !== 'boolean') throw new Error('Revise a ordem de atualização.');
  const launch = resource.launchConfig as Record<string, unknown>;
  if (!allowSameImage && image === imageName(launch.imageUuid))
    throw new Error('Escolha uma imagem diferente da atual.');
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
    ? resource.secondaryLaunchConfigs.map((value) =>
        preparePayload(schemas.secondaryLaunchConfig, value, undefined, schemas),
      )
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
  if (
    !(values.editUlimits === true
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
    throw new Error('A atualização de configuração não está disponível neste serviço.');
  if (
    bindingsSnapshot(before) !== bindingsSnapshot(fresh) ||
    ((values.editHealthCheck === true ||
      values.editSidecars === true ||
      values.editScheduling === true ||
      values.editResources === true ||
      values.editCpuResources === true ||
      values.editSecurity === true ||
      values.editUlimits === true) &&
      JSON.stringify(canonical([before.launchConfig, before.secondaryLaunchConfigs])) !==
        JSON.stringify(canonical([fresh.launchConfig, fresh.secondaryLaunchConfigs])))
  )
    throw new Error('A configuração foi alterada por outro cliente. Reabra o upgrade.');
  const launch = fresh.launchConfig as Record<string, unknown>;
  const editBindings =
    values.editBindings === true ||
    (values.editHealthCheck !== true &&
      values.editSidecars !== true &&
      values.editScheduling !== true &&
      values.editResources !== true &&
      values.editCpuResources !== true &&
      values.editSecurity !== true &&
      values.editUlimits !== true);
  if (editBindings) {
    validateBindings('ports', values.ports, launch.ports ?? []);
    validateBindings('dataVolumes', values.dataVolumes, launch.dataVolumes ?? []);
  }
  if (values.editHealthCheck === true) {
    if (values.healthCheck === undefined) throw new Error('Revise a verificação de saúde.');
    if (!supportsHealthCheckUpgrade(fresh, schemas))
      throw new Error('Contrato da verificação de saúde indisponível.');
    validateHealthCheck(
      values.healthCheck,
      schemas.instanceHealthCheck,
      schemas.recreateOnQuorumStrategyConfig,
    );
  }
  if (values.editUlimits === true) {
    if (!supportsUlimitUpgrade(fresh, schemas))
      throw new Error('Contrato de limites de processo indisponível.');
    normalizeUlimits(values.ulimits);
  }
  if (values.editSecurity === true) {
    if (
      !supportsSecurityUpgrade(fresh, schemas) ||
      typeof values.readOnly !== 'boolean' ||
      typeof values.privileged !== 'boolean' ||
      !Array.isArray(values.capAdd) ||
      !Array.isArray(values.capDrop)
    )
      throw new Error('Revise o contrato de segurança.');
    validateWorkloadSecurity(schemas.launchConfig, securityValues(values), schemas);
  }
  if (values.editResources === true) {
    if (
      !supportsResourceUpgrade(fresh, schemas) ||
      values.memory === undefined ||
      values.memoryReservation === undefined
    )
      throw new Error('Informe limite e reserva; use zero para retirar o valor explícito.');
    validateWorkloadResources(
      schemas.launchConfig,
      { memory: values.memory, memoryReservation: values.memoryReservation },
      schemas,
    );
  }
  if (values.editCpuResources === true) {
    if (!supportsCpuResourceUpgrade(fresh, schemas))
      throw new Error('Contrato de CPU e I/O indisponível.');
    validatedCpuResources(values.cpuResources);
  }
  if (values.editScheduling === true) {
    if (!supportsSchedulingUpgrade(fresh, schemas))
      throw new Error('Contrato de agendamento indisponível.');
    validateSchedulingLabels(values.labels);
  }
  if (values.editSidecars === true) {
    if (!supportsSidecarUpgrade(fresh, schemas) || !Array.isArray(values.secondaryLaunchConfigs))
      throw new Error('Contrato de atualização dos sidecars indisponível.');
    const next = {
      name: fresh.name,
      launchConfig: {
        ...launch,
        ...(values.editHealthCheck === true ? { healthCheck: values.healthCheck } : {}),
      },
      secondaryLaunchConfigs: values.secondaryLaunchConfigs,
    };
    validateSidecars(next, schemas);
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
    (values.editSecurity !== true ||
      JSON.stringify(canonical(securityValues(values))) ===
        JSON.stringify(canonical(securityValues(launch))))
  )
    throw new Error('Altere a imagem ou a configuração antes de atualizar.');
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
