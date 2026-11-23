import { validateWorkloadUlimits } from './workload-ulimits';
import { validateWorkloadSecurity } from './workload-security';
import { validateWorkloadResources } from './workload-resources';
import type { Schema, SchemaField } from './api';
import { preparePayload } from './components/SchemaForm';
import { validateWorkloadHealthChecks } from './workload-healthchecks';
import { validateWorkloadScheduling } from './workload-scheduling';
import { validateSidecars } from './workload-sidecars';
export type WorkloadField = [string, SchemaField];
const sections: { title: string; description: string; fields: string[] }[] = [
  {
    title: 'Identificação',
    description: 'Nome, descrição e vínculo com a stack.',
    fields: ['name', 'description', 'stackId', 'scale', 'startOnCreate'],
  },
  {
    title: 'Container',
    description: 'Imagem, argumentos e variáveis do processo.',
    fields: [
      'imageUuid',
      'command',
      'entryPoint',
      'environment',
      'workingDir',
      'user',
      'stdinOpen',
      'tty',
      'launchConfig',
    ],
  },
  {
    title: 'Sidecars',
    description: 'Containers auxiliares que acompanham cada instância do serviço.',
    fields: ['secondaryLaunchConfigs'],
  },
  {
    title: 'Rede',
    description: 'Modo de rede, portas e resolução de nomes no formato nativo.',
    fields: [
      'hostname',
      'domainName',
      'networkMode',
      'networkLaunchConfig',
      'ports',
      'expose',
      'dns',
      'dnsSearch',
      'networkIds',
    ],
  },
  {
    title: 'Recursos',
    description: 'Limites e reservas nas unidades indicadas em cada campo.',
    fields: [
      'memory',
      'memoryReservation',
      'milliCpuReservation',
      'cpuShares',
      'cpuSet',
      'cpuPeriod',
      'cpuQuota',
      'blkioWeight',
      'ulimits',
    ],
  },
  {
    title: 'Armazenamento',
    description: 'Montagens e volumes no formato aceito pelo Rancher.',
    fields: [
      'dataVolumes',
      'dataVolumesFrom',
      'dataVolumesFromLaunchConfigs',
      'volumeDriver',
      'storageOpt',
    ],
  },
  {
    title: 'Agendamento',
    description: 'Seleção de host e labels utilizadas pelo Rancher.',
    fields: ['requestedHostId', 'labels'],
  },
  {
    title: 'Saúde',
    description: 'Verificação do endpoint e política de recuperação do container.',
    fields: ['healthCheck'],
  },
  {
    title: 'Segurança',
    description: 'Opções que podem ampliar os privilégios do processo.',
    fields: [
      'privileged',
      'readOnly',
      'readOnlyRootFilesystem',
      'capAdd',
      'capDrop',
      'securityOpt',
      'devices',
    ],
  },
];
export function workloadSections(fields: WorkloadField[]) {
  const remaining = new Map(fields);
  const groups = sections
    .map((section) => ({
      ...section,
      entries: section.fields.flatMap((name) => {
        const field = remaining.get(name);
        if (!field) return [];
        remaining.delete(name);
        return [[name, field] as WorkloadField];
      }),
    }))
    .filter((group) => group.entries.length);
  const required = [...remaining].filter(([, field]) => field.required);
  for (const [name] of required) remaining.delete(name);
  if (required.length)
    groups.push({
      title: 'Campos obrigatórios adicionais',
      description: 'Exigências informadas pelo schema deste servidor.',
      fields: [],
      entries: required,
    });
  return { groups, advanced: [...remaining] as WorkloadField[] };
}
export function validateWorkloadCreation(
  schema: Schema,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
  healthChecks = false,
  sidecars = false,
  scheduling = false,
  resources = false,
  security = false,
  ulimits = false,
) {
  if (!['service', 'container'].includes(schema.id) || !schema.collectionMethods?.includes('POST'))
    throw new Error('A criação deste workload não está mais disponível.');
  function validate(current: Schema, payload: Record<string, unknown>, depth = 0) {
    if (depth > 12) throw new Error('A configuração tem níveis demais.');
    for (const [name, value] of Object.entries(payload)) {
      const field = current.resourceFields[name];
      if (!field?.create)
        throw new Error(`O campo ${name} não está mais disponível para criação. Reabra o painel.`);
      const nested = schemas[field.type];
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !nested &&
        !field.type.startsWith('map[') &&
        !['json', 'object'].includes(field.type)
      )
        throw new Error(`O schema de ${name} não está mais disponível. Reabra o painel.`);
      if (nested && value && typeof value === 'object' && !Array.isArray(value))
        validate(nested, value as Record<string, unknown>, depth + 1);
      const arrayType = /^array\[([^\]]+)\]$/.exec(field.type)?.[1];
      if (arrayType && schemas[arrayType] && Array.isArray(value))
        for (const entry of value) {
          if (entry && typeof entry === 'object' && !Array.isArray(entry))
            validate(schemas[arrayType], entry, depth + 1);
        }
    }
  }
  validate(schema, values);
  if (security) validateWorkloadSecurity(schema, values, schemas);
  if (ulimits) validateWorkloadUlimits(schema, values, schemas);
  if (resources) validateWorkloadResources(schema, values, schemas);
  if (scheduling) validateWorkloadScheduling(schema, values, schemas);
  if (healthChecks) validateWorkloadHealthChecks(schema, values, schemas);
  if (sidecars && schema.id === 'service') validateSidecars(values, schemas);
  return preparePayload(schema, values, undefined, schemas);
}
