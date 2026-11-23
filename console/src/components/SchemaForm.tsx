import { CapabilityEditor } from './CapabilityEditor';
import { validateWorkloadSecurity } from '../workload-security';
import { MemoryEditor } from './MemoryEditor';
import { CpuResourceEditor } from './CpuResourceEditor';
import { isCpuField } from '../cpu-resources';
import { validateWorkloadResources } from '../workload-resources';
import { WorkloadBindingsEditor } from './WorkloadBindingsEditor';
import { HealthCheckEditor } from './HealthCheckEditor';
import { SchedulingEditor } from './SchedulingEditor';
import { validateWorkloadScheduling } from '../workload-scheduling';
import { validateWorkloadHealthChecks } from '../workload-healthchecks';
import { validateSidecars } from '../workload-sidecars';
import { validateBindingFields } from '../workload-bindings';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import type { Resource, Schema, SchemaField } from '../api';
import { Alert, Button, CheckboxField, Field } from './ui';
import { workloadSections } from '../workload-creation';

const labels: Record<string, string> = {
  start: 'Iniciar',
  id: 'ID',
  type: 'Tipo de recurso',
  project: 'Environment',
  projectTemplate: 'Template do environment',
  orchestration: 'Orquestrador',
  setmembers: 'Gerenciar acessos diretos',
  service: 'Serviço',
  container: 'Container',
  certificate: 'Certificado',
  secret: 'Secret',
  registry: 'Registry',
  volume: 'Volume',
  snapshot: 'Criar snapshot',
  restore: 'Restaurar',
  restorefrombackup: 'Restaurar de backup',
  reverttosnapshot: 'Reverter para snapshot',
  mounts: 'Montagens',
  snapshots: 'Snapshots',
  storagePools: 'Pools de armazenamento',
  images: 'Imagens',
  account: 'Conta',
  host: 'Host',
  state: 'Estado',
  healthState: 'Saúde',
  healthCheck: 'Verificação de saúde',
  secondaryLaunchConfigs: 'Sidecars',
  dataVolumesFromLaunchConfigs: 'Volumes de outros containers deste serviço',
  networkLaunchConfig: 'Rede de outro container deste serviço',
  hostId: 'Host',
  primaryIpAddress: 'Endereço IP',
  created: 'Criado em',
  transitioningMessage: 'Mensagem da operação',
  deactivateservices: 'Parar serviços',
  activateservices: 'Iniciar serviços',
  exportconfig: 'Exportar Compose',
  addoutputs: 'Adicionar saídas',
  addservicelink: 'Adicionar vínculo de serviço',
  removeservicelink: 'Remover vínculo de serviço',
  setservicelinks: 'Gerenciar vínculos de serviços',
  update: 'Atualizar configuração',
  stop: 'Parar',
  restart: 'Reiniciar',
  remove: 'Remover',
  purge: 'Excluir definitivamente',
  logs: 'Ver logs',
  execute: 'Abrir terminal',
  activate: 'Ativar',
  deactivate: 'Desativar',
  upgrade: 'Atualizar serviço',
  rollback: 'Reverter atualização',
  finishupgrade: 'Concluir atualização',
  cancelupgrade: 'Cancelar atualização',
  cancelrollback: 'Cancelar reversão',
  name: 'Nome',
  description: 'Descrição',
  imageUuid: 'Imagem',
  scale: 'Escala',
  hostname: 'Hostname',
  serverAddress: 'Endereço do registry',
  username: 'Usuário',
  password: 'Senha',
  value: 'Valor',
  cert: 'Certificado PEM',
  key: 'Chave privada PEM',
  certChain: 'Cadeia intermediária PEM',
  expiresAt: 'Validade',
  issuedAt: 'Emitido em',
  issuer: 'Emissor',
  certFingerprint: 'Impressão digital',
  CN: 'Nome comum',
  sizeMb: 'Capacidade solicitada (MiB)',
  driverOpts: 'Opções do driver',
  storageDriverId: 'Driver de armazenamento',
  projectTemplateId: 'Template do environment',
  environment: 'Variáveis de ambiente',
  ports: 'Portas publicadas',
  command: 'Comando',
  entryPoint: 'Entrypoint',
  dataVolumes: 'Volumes',
  dataVolumesFrom: 'Volumes de containers',
  requestedHostId: 'Host solicitado',
  stackId: 'Stack',
  memory: 'Memória (bytes)',
  milliCpuReservation: 'Reserva de CPU (millicores)',
  memoryReservation: 'Reserva de memória (bytes)',
  privileged: 'Modo privilegiado',
  startOnCreate: 'Iniciar após criação',
  networkMode: 'Modo de rede',
  labels: 'Labels',
  launchConfig: 'Configuração do container',
  externalIpAddresses: 'Endereços externos',
  lbConfig: 'Configuração do balanceador',
  members: 'Membros diretos',
  kind: 'Tipo',
  publicValue: 'Chave pública',
  secretValue: 'Chave secreta',
  accountId: 'Conta',
  driver: 'Driver',
  size: 'Tamanho',
  accessMode: 'Modo de acesso',
  user: 'Usuário do processo',
  workingDir: 'Diretório de trabalho',
  stdinOpen: 'Manter entrada padrão aberta',
  tty: 'Alocar terminal (TTY)',
  domainName: 'Domínio',
  expose: 'Portas expostas',
  dns: 'Servidores DNS',
  dnsSearch: 'Domínios de busca DNS',
  networkIds: 'Redes',
  cpuShares: 'Peso de CPU',
  cpuSet: 'CPUs permitidas',
  cpuPeriod: 'Período de CPU (µs)',
  cpuQuota: 'Quota de CPU (µs)',
  blkioWeight: 'Peso de I/O',
  volumeDriver: 'Driver de volumes',
  storageOpt: 'Opções de armazenamento',
  readOnly: 'Sistema de arquivos somente leitura',
  capAdd: 'Capabilities adicionais',
  capDrop: 'Capabilities removidas',
  securityOpt: 'Opções de segurança',
  devices: 'Dispositivos',
};
const basics = new Set([
  'name',
  'description',
  'imageUuid',
  'hostname',
  'serverAddress',
  'username',
  'password',
  'publicValue',
  'secretValue',
  'value',
  'cert',
  'key',
  'projectTemplateId',
  'scale',
  'launchConfig',
  'externalIpAddresses',
  'lbConfig',
  'accountId',
  'kind',
]);
export const sensitiveField = (name: string, field?: SchemaField) =>
  field?.type === 'password' ||
  /password|passwd|secret|private.?key|token|credential|auth.?key|host.?key|access.?key|api.?key|(^|_)pass($|_)|^key$|^value$/i.test(
    name,
  );
export function fieldLabel(name: string) {
  return (
    labels[name] ||
    labels[name.toLowerCase()] ||
    name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
  );
}
function objectSchema(type: string, schemas: Record<string, Schema>) {
  if (
    [
      'string',
      'password',
      'int',
      'long',
      'float',
      'double',
      'boolean',
      'bool',
      'date',
      'enum',
      'multiline',
      'json',
      'base64',
    ].includes(type)
  )
    return undefined;
  return schemas[type];
}
export function editableFields(schema: Schema, updating: boolean) {
  const priority = [
    'name',
    'description',
    'imageUuid',
    'stackId',
    'scale',
    'launchConfig',
    'serverAddress',
    'username',
    'password',
    'value',
  ];
  return Object.entries(schema.resourceFields || {})
    .filter(([, f]) => (updating ? f.update : f.create))
    .sort(
      ([left], [right]) =>
        (priority.includes(left) ? priority.indexOf(left) : 100) -
        (priority.includes(right) ? priority.indexOf(right) : 100),
    );
}
export function preparePayload(
  schema: Schema,
  values: Record<string, unknown>,
  original?: Resource,
  schemas: Record<string, Schema> = {},
  depth = 0,
) {
  if (depth > 12) throw new Error('A configuração tem níveis demais. Revise os campos avançados.');
  const result: Record<string, unknown> = {};
  for (const [name, field] of editableFields(schema, !!original)) {
    const value = values[name];
    if (value === undefined || value === '') {
      if (field.required && (!original || original[name] !== value))
        throw new Error(`Preencha ${fieldLabel(name)}.`);
      if (original && value === '' && original[name] !== '' && original[name] !== undefined)
        result[name] = field.nullable ? null : '';
      continue;
    }
    if (value === null) {
      if (field.required) throw new Error(`Preencha ${fieldLabel(name)}.`);
      if (field.nullable === false) throw new Error(`${fieldLabel(name)} não pode ser removido.`);
      if (!original || original[name] !== null) result[name] = null;
      continue;
    }
    if (
      (field.type === 'int' || field.type === 'long') &&
      (!Number.isSafeInteger(Number(value)) || String(value).trim() === '')
    )
      throw new Error(`${fieldLabel(name)} precisa ser um número inteiro.`);
    if (field.options && field.type === 'enum' && !field.options.includes(String(value)))
      throw new Error(`Escolha uma opção válida em ${fieldLabel(name)}.`);
    if (typeof value === 'string') {
      if (field.minLength !== undefined && value.length < field.minLength)
        throw new Error(
          `${fieldLabel(name)} precisa ter pelo menos ${field.minLength} caracteres.`,
        );
      if (field.maxLength !== undefined && value.length > field.maxLength)
        throw new Error(`${fieldLabel(name)} aceita até ${field.maxLength} caracteres.`);
      // The Cattle schema describes a character class, not a complete regular expression.
      if (field.validChars && !new RegExp(`^[${field.validChars}]*$`).test(value))
        throw new Error(`${fieldLabel(name)} contém caracteres não permitidos pelo Rancher.`);
    }
    if (
      ['int', 'long'].includes(field.type) &&
      ((field.min !== undefined && Number(value) < field.min) ||
        (field.max !== undefined && Number(value) > field.max))
    )
      throw new Error(`${fieldLabel(name)} está fora dos limites permitidos.`);
    if ((field.type === 'boolean' || field.type === 'bool') && typeof value !== 'boolean')
      throw new Error(`${fieldLabel(name)} precisa ser verdadeiro ou falso.`);
    if (
      field.type === 'array[int]' &&
      (!Array.isArray(value) || value.some((item) => !Number.isSafeInteger(item)))
    )
      throw new Error(`${fieldLabel(name)} precisa conter apenas números inteiros.`);
    if (field.required && typeof value === 'object' && value !== null && !Object.keys(value).length)
      throw new Error(`Preencha ${fieldLabel(name)}.`);
    let normalized: unknown = field.type === 'int' || field.type === 'long' ? Number(value) : value;
    if (name === 'imageUuid' && typeof normalized === 'string') {
      if (!normalized.trim()) throw new Error('Preencha Imagem.');
      normalized = normalized.trim();
      if (!(normalized as string).startsWith('docker:')) normalized = 'docker:' + normalized;
    }
    const nested = objectSchema(field.type, schemas);
    const arrayType = /^array\[([^\]]+)\]$/.exec(field.type)?.[1];
    if (nested) {
      if (typeof value !== 'object' || Array.isArray(value))
        throw new Error(`Revise ${fieldLabel(name)}.`);
      normalized = preparePayload(
        nested,
        value as Record<string, unknown>,
        undefined,
        schemas,
        depth + 1,
      );
    } else if (arrayType && schemas[arrayType]) {
      if (
        !Array.isArray(value) ||
        value.some((item) => !item || typeof item !== 'object' || Array.isArray(item))
      )
        throw new Error(`Revise os itens de ${fieldLabel(name)}.`);
      normalized = value.map((item) =>
        preparePayload(schemas[arrayType], item, undefined, schemas, depth + 1),
      );
    }
    if (original && JSON.stringify(normalized) === JSON.stringify(original[name])) continue;
    result[name] = normalized;
  }
  return result;
}
export function MapField({
  name,
  value,
  onChange,
  privateValues = false,
}: {
  name: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  privateValues?: boolean;
}) {
  const [rows, setRows] = useState(() =>
    Object.entries(value).map(([key, value]) => ({ key, value })),
  );
  function update(next: typeof rows) {
    setRows(next);
    onChange(Object.fromEntries(next.filter((row) => row.key).map((row) => [row.key, row.value])));
  }
  return (
    <div className="map-editor">
      {rows.map((row, index) => (
        <div className="map-row" key={index}>
          <input
            aria-label={`${name}: chave ${index + 1}`}
            placeholder="Chave"
            value={row.key}
            onChange={(e) =>
              update(rows.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)))
            }
          />
          <input
            aria-label={`${name}: valor ${index + 1}`}
            placeholder="Valor"
            type={privateValues ? 'password' : 'text'}
            autoComplete={privateValues ? 'new-password' : 'off'}
            value={row.value}
            onChange={(e) =>
              update(rows.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))
            }
          />
          <Button
            variant="ghost"
            type="button"
            aria-label={`Remover linha ${index + 1}`}
            onClick={() => update(rows.filter((_, i) => i !== index))}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ))}
      <Button type="button" onClick={() => update([...rows, { key: '', value: '' }])}>
        <Plus size={15} />
        Adicionar
      </Button>
    </div>
  );
}
function JsonField({
  id,
  value,
  onChange,
  required,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  required?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? '' : JSON.stringify(value, null, 2));
  return (
    <textarea
      id={id}
      className="code-input"
      rows={6}
      value={text}
      required={required}
      spellCheck={false}
      onChange={(e) => {
        setText(e.target.value);
        try {
          const parsed = e.target.value ? JSON.parse(e.target.value) : undefined;
          e.target.setCustomValidity('');
          onChange(parsed);
        } catch {
          e.target.setCustomValidity('Informe JSON válido.');
        }
      }}
    />
  );
}
function WorkloadSections({
  fields,
  render,
}: {
  fields: [string, SchemaField][];
  render: (entry: [string, SchemaField]) => ReactNode;
}) {
  const { groups, advanced } = workloadSections(fields);
  return (
    <>
      {groups.map((group) =>
        ['Identificação', 'Container', 'Campos obrigatórios adicionais'].includes(group.title) ||
        group.entries.some(([, field]) => field.required) ? (
          <section className="form-section" key={group.title} aria-label={group.title}>
            <h3>{group.title}</h3>
            <p className="muted">{group.description}</p>
            {group.entries.map(render)}
          </section>
        ) : (
          <details className="workload-form-section" key={group.title}>
            <summary>
              <strong>{group.title}</strong>
              <span>{group.description}</span>
            </summary>
            <div>{group.entries.map(render)}</div>
          </details>
        ),
      )}
      {!!advanced.length && (
        <details className="advanced-fields">
          <summary>
            Outras opções nativas <span>{advanced.length} opções</span>
          </summary>
          <div>{advanced.map(render)}</div>
        </details>
      )}
    </>
  );
}
function EditorField({
  name,
  field,
  value,
  onChange,
  schemas,
  references,
  depth = 0,
  sectioned = false,
  bindingEditors = false,
  healthCheckEditors = false,
  sidecarEditors = false,
  schedulingEditors = false,
  resourceEditors = false,
  securityEditors = false,
}: {
  name: string;
  field: SchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
  schemas: Record<string, Schema>;
  references: Record<string, Resource[]>;
  depth?: number;
  sectioned?: boolean;
  bindingEditors?: boolean;
  healthCheckEditors?: boolean;
  sidecarEditors?: boolean;
  schedulingEditors?: boolean;
  resourceEditors?: boolean;
  securityEditors?: boolean;
}) {
  const nested = objectSchema(field.type, schemas);
  const [revealed, setRevealed] = useState(false);
  if (
    securityEditors &&
    ['capAdd', 'capDrop'].includes(name) &&
    field.type === 'array[enum]' &&
    field.options
  )
    return (
      <CapabilityEditor
        label={name === 'capAdd' ? 'Capabilities adicionais' : 'Capabilities removidas'}
        value={value}
        options={field.options}
        onChange={onChange}
      />
    );
  if (
    resourceEditors &&
    ['memory', 'memoryReservation'].includes(name) &&
    ['int', 'long'].includes(field.type)
  )
    return (
      <MemoryEditor
        label={name === 'memory' ? 'Limite de memória' : 'Reserva de memória'}
        value={value}
        onChange={onChange}
      />
    );
  if (
    resourceEditors &&
    isCpuField(name) &&
    (name === 'cpuSet' ? field.type === 'string' : ['int', 'long'].includes(field.type))
  )
    return <CpuResourceEditor name={name} value={value} onChange={onChange} />;
  if (schedulingEditors && name === 'labels' && field.type === 'map[string]')
    return (
      <SchedulingEditor
        value={(value || {}) as Record<string, string>}
        onChange={onChange}
        renderLabels={(labels, change) => (
          <div className="field">
            <MapField name="Labels" value={labels} onChange={change} />
          </div>
        )}
      />
    );

  if (
    sidecarEditors &&
    name === 'secondaryLaunchConfigs' &&
    field.type === 'array[secondaryLaunchConfig]' &&
    schemas.secondaryLaunchConfig
  )
    return (
      <SidecarsEditor
        value={value}
        schemas={schemas}
        references={references}
        bindingEditors={bindingEditors}
        schedulingEditors={schedulingEditors}
        resourceEditors={resourceEditors}
        securityEditors={securityEditors}
        healthCheckEditors={healthCheckEditors}
        onChange={onChange}
      />
    );
  if (
    healthCheckEditors &&
    name === 'healthCheck' &&
    field.type === 'instanceHealthCheck' &&
    nested?.resourceFields.port?.create
  )
    return (
      <HealthCheckEditor
        value={value}
        schema={nested}
        quorum={schemas.recreateOnQuorumStrategyConfig}
        onChange={onChange}
      />
    );
  if (nested && depth < 3) {
    const object = (value || {}) as Record<string, unknown>;
    const enabled = field.required || (value !== undefined && value !== null);
    const nestedFields = editableFields(nested, false);
    const renderNested = ([key, child]: [string, SchemaField]) => (
      <EditorField
        key={key}
        name={key}
        field={child}
        value={object[key]}
        onChange={(next) => onChange({ ...object, [key]: next })}
        schemas={schemas}
        references={references}
        depth={depth + 1}
        bindingEditors={bindingEditors}
        schedulingEditors={schedulingEditors}
        resourceEditors={resourceEditors}
        securityEditors={securityEditors}
        healthCheckEditors={healthCheckEditors}
      />
    );
    const primary = nestedFields.filter(([key, child]) => basics.has(key) || child.required);
    const advanced = nestedFields.filter(([key, child]) => !basics.has(key) && !child.required);
    return (
      <fieldset className="nested-fields">
        <legend>
          {fieldLabel(name)}
          {field.required ? ' *' : ''}
        </legend>
        {!field.required && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={!!enabled}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? Object.fromEntries(
                        editableFields(nested, false)
                          .filter(([, child]) => child.default !== undefined)
                          .map(([key, child]) => [key, child.default]),
                      )
                    : null,
                )
              }
            />
            <span>Configurar {(field.label || fieldLabel(name)).toLocaleLowerCase()}</span>
          </label>
        )}
        {enabled && (
          <>
            {sectioned ? (
              <WorkloadSections fields={nestedFields} render={renderNested} />
            ) : (
              <>
                {primary.map(renderNested)}
                {!!advanced.length && (
                  <details className="advanced-fields">
                    <summary>
                      Outras opções de {fieldLabel(name).toLocaleLowerCase()}{' '}
                      <span>{advanced.length}</span>
                    </summary>
                    <div>{advanced.map(renderNested)}</div>
                  </details>
                )}
              </>
            )}
          </>
        )}
      </fieldset>
    );
  }
  if (
    bindingEditors &&
    field.type === 'array[string]' &&
    (name === 'ports' || name === 'dataVolumes')
  )
    return <WorkloadBindingsEditor kind={name} value={value} onChange={onChange} />;
  const isSecret = sensitiveField(name, field);
  const referenceType = /^reference\[([^\]]+)\]$/.exec(field.type)?.[1];
  const choices = referenceType ? references[referenceType] : undefined;
  if (field.type === 'boolean' || field.type === 'bool')
    return (
      <CheckboxField
        label={field.label || fieldLabel(name)}
        description={field.description}
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  return (
    <Field
      label={`${field.label || fieldLabel(name)}${field.required ? ' *' : ''}`}
      hint={
        field.description ||
        (field.validChars ? `Caracteres permitidos: ${field.validChars}.` : undefined) ||
        (/^reference\[/.test(field.type)
          ? choices
            ? 'Escolha um recurso deste environment.'
            : 'Informe o ID do recurso autorizado.'
          : field.type.startsWith('array[')
            ? 'Um valor por linha.'
            : undefined)
      }
    >
      {(id, desc) => {
        const common = { id, 'aria-describedby': desc, required: field.required };
        if (choices)
          return (
            <select
              {...common}
              value={String(value ?? '')}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">Selecionar…</option>
              {!!value && !choices.some((choice) => choice.id === value) && (
                <option value={String(value)}>Recurso indisponível ({String(value)})</option>
              )}
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name || choice.id}
                </option>
              ))}
            </select>
          );
        if (field.type === 'enum')
          return (
            <select
              {...common}
              value={String(value ?? '')}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">Selecionar…</option>
              {field.options?.map((option) => (
                <option value={option} key={option}>
                  {option}
                </option>
              ))}
            </select>
          );
        if (field.type === 'map[string]')
          return (
            <MapField
              name={fieldLabel(name)}
              privateValues={name === 'environment'}
              value={(value || {}) as Record<string, string>}
              onChange={onChange}
            />
          );
        if (/^array\[(string|int|reference\[[^\]]+\])\]$/.test(field.type))
          return (
            <textarea
              {...common}
              rows={4}
              value={Array.isArray(value) ? value.join('\n') : ''}
              onChange={(e) =>
                onChange(
                  e.target.value
                    .split('\n')
                    .filter(Boolean)
                    .map((v) => (field.type === 'array[int]' ? Number(v) : v)),
                )
              }
            />
          );
        if (
          field.type.startsWith('array[') ||
          field.type.startsWith('map[') ||
          (nested && depth >= 3)
        )
          return <JsonField id={id} value={value} onChange={onChange} required={field.required} />;
        if (
          name === 'description' ||
          name === 'cert' ||
          name === 'key' ||
          name === 'certChain' ||
          field.type === 'multiline'
        )
          return (
            <>
              <textarea
                {...common}
                rows={name === 'description' ? 3 : 6}
                value={String(value ?? '')}
                autoComplete="off"
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
                className={isSecret && !revealed ? 'secret-input' : undefined}
              />
              {isSecret && (
                <Button
                  type="button"
                  variant="ghost"
                  aria-pressed={revealed}
                  onClick={() => setRevealed(!revealed)}
                >
                  {revealed ? <EyeOff size={16} /> : <Eye size={16} />}{' '}
                  {revealed ? 'Ocultar' : 'Mostrar'} conteúdo
                </Button>
              )}
            </>
          );
        return (
          <input
            {...common}
            type={
              isSecret
                ? 'password'
                : field.type === 'int' || field.type === 'long'
                  ? 'number'
                  : 'text'
            }
            value={String(value ?? '')}
            min={field.min}
            max={field.max}
            minLength={field.minLength}
            maxLength={field.maxLength}
            autoComplete={isSecret ? 'new-password' : 'off'}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      }}
    </Field>
  );
}
export function SidecarsEditor({
  value,
  schemas,
  references,
  bindingEditors,
  healthCheckEditors,
  schedulingEditors = false,
  resourceEditors = false,
  securityEditors = false,
  onChange,
}: {
  value: unknown;
  schemas: Record<string, Schema>;
  references: Record<string, Resource[]>;
  bindingEditors: boolean;
  healthCheckEditors: boolean;
  schedulingEditors?: boolean;
  resourceEditors?: boolean;
  securityEditors?: boolean;
  onChange: (value: unknown) => void;
}) {
  const [rows, setRows] = useState(() =>
    Array.isArray(value)
      ? value.map((value) => ({
          key: crypto.randomUUID(),
          value: value as Record<string, unknown>,
        }))
      : [],
  );
  const valid =
    value == null ||
    (Array.isArray(value) &&
      value.every((row) => row && typeof row === 'object' && !Array.isArray(row)));
  const original = schemas.secondaryLaunchConfig;
  const schema: Schema = {
    ...original,
    resourceFields: Object.fromEntries(
      Object.entries(original.resourceFields)
        .filter(([name]) => !['kind', 'stackId', 'startOnCreate'].includes(name))
        .map(([name, field]) => [
          name,
          ['name', 'imageUuid'].includes(name) ? { ...field, required: true } : field,
        ]),
    ),
  };
  function update(next: typeof rows) {
    setRows(next);
    onChange(next.map((v) => v.value));
  }
  return (
    <section aria-label="Containers auxiliares do serviço">
      <p className="muted">
        Cada sidecar acompanha as instâncias deste serviço. Referências de rede/volumes usam o nome
        do serviço ou do sidecar. Para compartilhar a rede, defina o modo container na seção Rede e
        informe o nome do container. Revise os vínculos ao renomear ou remover um container.
      </p>
      {!valid ? (
        <Alert>Configuração de sidecars inválida. Reabra o formulário.</Alert>
      ) : (
        <>
          {rows.map((row, index) => (
            <fieldset className="nested-fields" key={row.key}>
              <legend>
                Sidecar {index + 1}
                {row.value.name ? ' · ' + row.value.name : ''}
              </legend>
              <WorkloadSections
                fields={editableFields(schema, false)}
                render={([name, field]) => (
                  <EditorField
                    key={name}
                    name={name}
                    field={field}
                    value={row.value[name]}
                    schemas={schemas}
                    references={references}
                    bindingEditors={bindingEditors}
                    schedulingEditors={schedulingEditors}
                    resourceEditors={resourceEditors}
                    securityEditors={securityEditors}
                    healthCheckEditors={healthCheckEditors}
                    onChange={(next) =>
                      update(
                        rows.map((v) =>
                          v.key === row.key ? { ...v, value: { ...v.value, [name]: next } } : v,
                        ),
                      )
                    }
                  />
                )}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => update(rows.filter((v) => v.key !== row.key))}
              >
                Remover sidecar {index + 1}
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            disabled={rows.length >= 50}
            onClick={() =>
              update([
                ...rows,
                {
                  key: crypto.randomUUID(),
                  value: Object.fromEntries(
                    editableFields(schema, false)
                      .filter(([, field]) => field.default !== undefined)
                      .map(([name, field]) => [name, field.default]),
                  ),
                },
              ])
            }
          >
            <Plus size={15} />
            Adicionar sidecar
          </Button>
        </>
      )}
    </section>
  );
}
export function SchemaForm({
  schema,
  schemas,
  original,
  initialValues,
  references = {},
  onSubmit,
  busy,
  error,
  id = 'resource-form',
  onDirtyChange,
  onReferenceChange,
  layout,
  bindingEditors = false,
  healthCheckEditors = false,
  sidecarEditors = false,
  schedulingEditors = false,
  resourceEditors = false,
  securityEditors = false,
}: {
  schema: Schema;
  schemas: Record<string, Schema>;
  original?: Resource;
  initialValues?: Record<string, unknown>;
  references?: Record<string, Resource[]>;
  onDirtyChange?: (dirty: boolean) => void;
  onReferenceChange?: (name: string, value: string) => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  busy?: boolean;
  error?: Error | null;
  id?: string;
  layout?: 'workload';
  bindingEditors?: boolean;
  healthCheckEditors?: boolean;
  sidecarEditors?: boolean;
  schedulingEditors?: boolean;
  resourceEditors?: boolean;
  securityEditors?: boolean;
}) {
  const fields = editableFields(schema, !!original).filter(
    ([name]) =>
      !(name === 'lbConfig' && (original?.type || schema.id) === 'service' && !original?.lbConfig),
  );
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      fields.flatMap(([name, field]) => {
        if (original && sensitiveField(name, field)) return [];
        let value = original?.[name] ?? initialValues?.[name] ?? field.default;
        if (
          !original &&
          layout === 'workload' &&
          field.required &&
          value === undefined &&
          schemas[field.type]
        )
          value = Object.fromEntries(
            Object.entries(schemas[field.type].resourceFields)
              .filter(([, child]) => child.create && child.default !== undefined)
              .map(([key, child]) => [key, child.default]),
          );
        return value === undefined || value === null ? [] : [[name, value]];
      }),
    ),
  );
  const initialBindings = useRef(values);
  const initial = useRef(JSON.stringify(values));
  const dirty = JSON.stringify(values) !== initial.current;
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty]);
  const [validation, setValidation] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    setValidation('');
    try {
      if (bindingEditors) validateBindingFields(schema, values, schemas, initialBindings.current);
      if (healthCheckEditors) validateWorkloadHealthChecks(schema, values, schemas);
      if (securityEditors) validateWorkloadSecurity(schema, values, schemas);
      if (resourceEditors) validateWorkloadResources(schema, values, schemas);
      if (schedulingEditors) validateWorkloadScheduling(schema, values, schemas);
      if (sidecarEditors && schema.id === 'service') validateSidecars(values, schemas);
      onSubmit(preparePayload(schema, values, original, schemas));
    } catch (error) {
      setValidation(error instanceof Error ? error.message : 'Revise os campos.');
    }
  }
  const render = ([name, field]: [string, SchemaField]) => (
    <EditorField
      key={name}
      name={name}
      field={field}
      value={values[name]}
      schemas={schemas}
      references={references}
      sectioned={layout === 'workload' && name === 'launchConfig'}
      bindingEditors={bindingEditors}
      healthCheckEditors={healthCheckEditors}
      sidecarEditors={sidecarEditors}
      schedulingEditors={schedulingEditors}
      resourceEditors={resourceEditors}
      securityEditors={securityEditors}
      onChange={(value) => {
        setValues((previous) => ({ ...previous, [name]: value }));
        if (field.type.startsWith('reference[')) onReferenceChange?.(name, String(value ?? ''));
      }}
    />
  );
  const main = fields.filter(([name, field]) => basics.has(name) || field.required);
  const advanced = fields.filter(([name, field]) => !basics.has(name) && !field.required);
  return (
    <form id={id} onSubmit={submit}>
      <fieldset disabled={busy} className="form-fieldset">
        {layout === 'workload' ? (
          <WorkloadSections fields={fields} render={render} />
        ) : (
          <>
            {main.map(render)}
            {!!advanced.length && (
              <details className="advanced-fields">
                <summary>
                  Configuração avançada <span>{advanced.length} opções</span>
                </summary>
                <div>{advanced.map(render)}</div>
              </details>
            )}
          </>
        )}
      </fieldset>
      {(validation || error) && <Alert>{validation || error?.message}</Alert>}
    </form>
  );
}
