import { ResourceValidationError } from '../resource-validation';
import { workloadValidationMessage } from '../workload-validation-message';
import { UlimitEditor } from './UlimitEditor';
import { DeviceEditor } from './DeviceEditor';
import {
  DeviceValidationError,
  supportsDevices,
  validateWorkloadDevices,
} from '../workload-devices';
import { useI18n } from '../i18n/provider';
import { ptSchemaForm } from '../i18n/domains/schema-form';
import { supportsUlimits, validateWorkloadUlimits } from '../workload-ulimits';
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
type FieldLabelKey = Extract<keyof typeof ptSchemaForm, `schemaForm.label.${string}`>;
function fieldLabelKey(name: string) {
  const exact = `schemaForm.label.${name}`;
  const lower = `schemaForm.label.${name.toLowerCase()}`;
  if (Object.hasOwn(ptSchemaForm, exact)) return exact as FieldLabelKey;
  if (Object.hasOwn(ptSchemaForm, lower)) return lower as FieldLabelKey;
}
export function fieldLabel(name: string, translate?: (key: FieldLabelKey) => string) {
  const key = fieldLabelKey(name);
  return key ? (translate?.(key) ?? ptSchemaForm[key]) : humanizeFieldName(name);
}
function humanizeFieldName(name: string) {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
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
type PayloadErrorDetail =
  | [key: 'schemaForm.validation.depth']
  | [
      key:
        | 'schemaForm.validation.required'
        | 'schemaForm.validation.notNullable'
        | 'schemaForm.validation.integer'
        | 'schemaForm.validation.enum'
        | 'schemaForm.validation.invalidCharacters'
        | 'schemaForm.validation.range'
        | 'schemaForm.validation.boolean'
        | 'schemaForm.validation.integerArray'
        | 'schemaForm.validation.object'
        | 'schemaForm.validation.items',
      field: string,
    ]
  | [
      key: 'schemaForm.validation.minLength' | 'schemaForm.validation.maxLength',
      field: string,
      limit: number,
    ];

class SchemaPayloadError extends Error {
  readonly detail: PayloadErrorDetail;
  constructor(...detail: PayloadErrorDetail) {
    const [key, field, limit] = detail;
    super(
      ptSchemaForm[key].replace(/\{(field|limit)\}/g, (_, param: string) =>
        param === 'field' ? fieldLabel(field!) : String(limit),
      ),
    );
    this.detail = detail;
  }
}

export function preparePayload(
  schema: Schema,
  values: Record<string, unknown>,
  original?: Resource,
  schemas: Record<string, Schema> = {},
  depth = 0,
) {
  if (depth > 12) throw new SchemaPayloadError('schemaForm.validation.depth');
  const result: Record<string, unknown> = {};
  for (const [name, field] of editableFields(schema, !!original)) {
    const value = values[name];
    if (value === undefined || value === '') {
      if (field.required && (!original || original[name] !== value))
        throw new SchemaPayloadError('schemaForm.validation.required', name);
      if (original && value === '' && original[name] !== '' && original[name] !== undefined)
        result[name] = field.nullable ? null : '';
      continue;
    }
    if (value === null) {
      if (field.required) throw new SchemaPayloadError('schemaForm.validation.required', name);
      if (field.nullable === false)
        throw new SchemaPayloadError('schemaForm.validation.notNullable', name);
      if (!original || original[name] !== null) result[name] = null;
      continue;
    }
    if (
      (field.type === 'int' || field.type === 'long') &&
      (!Number.isSafeInteger(Number(value)) || String(value).trim() === '')
    )
      throw new SchemaPayloadError('schemaForm.validation.integer', name);
    if (field.options && field.type === 'enum' && !field.options.includes(String(value)))
      throw new SchemaPayloadError('schemaForm.validation.enum', name);
    if (typeof value === 'string') {
      if (field.minLength !== undefined && value.length < field.minLength)
        throw new SchemaPayloadError('schemaForm.validation.minLength', name, field.minLength);
      if (field.maxLength !== undefined && value.length > field.maxLength)
        throw new SchemaPayloadError('schemaForm.validation.maxLength', name, field.maxLength);
      // The Cattle schema describes a character class, not a complete regular expression.
      if (field.validChars && !new RegExp(`^[${field.validChars}]*$`).test(value))
        throw new SchemaPayloadError('schemaForm.validation.invalidCharacters', name);
    }
    if (
      ['int', 'long'].includes(field.type) &&
      ((field.min !== undefined && Number(value) < field.min) ||
        (field.max !== undefined && Number(value) > field.max))
    )
      throw new SchemaPayloadError('schemaForm.validation.range', name);
    if ((field.type === 'boolean' || field.type === 'bool') && typeof value !== 'boolean')
      throw new SchemaPayloadError('schemaForm.validation.boolean', name);
    if (
      field.type === 'array[int]' &&
      (!Array.isArray(value) || value.some((item) => !Number.isSafeInteger(item)))
    )
      throw new SchemaPayloadError('schemaForm.validation.integerArray', name);
    if (field.required && typeof value === 'object' && value !== null && !Object.keys(value).length)
      throw new SchemaPayloadError('schemaForm.validation.required', name);
    let normalized: unknown = field.type === 'int' || field.type === 'long' ? Number(value) : value;
    if (name === 'imageUuid' && typeof normalized === 'string') {
      if (!normalized.trim()) throw new SchemaPayloadError('schemaForm.validation.required', name);
      normalized = normalized.trim();
      if (!(normalized as string).startsWith('docker:')) normalized = 'docker:' + normalized;
    }
    const nested = objectSchema(field.type, schemas);
    const arrayType = /^array\[([^\]]+)\]$/.exec(field.type)?.[1];
    if (nested) {
      if (typeof value !== 'object' || Array.isArray(value))
        throw new SchemaPayloadError('schemaForm.validation.object', name);
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
        throw new SchemaPayloadError('schemaForm.validation.items', name);
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
  const { t } = useI18n();
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
            aria-label={t('schemaForm.mapKey', { name, index: index + 1 })}
            placeholder={t('schemaForm.key')}
            value={row.key}
            onChange={(e) =>
              update(rows.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)))
            }
          />
          <input
            aria-label={t('schemaForm.mapValue', { name, index: index + 1 })}
            placeholder={t('schemaForm.value')}
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
            aria-label={t('schemaForm.removeRow', { index: index + 1 })}
            onClick={() => update(rows.filter((_, i) => i !== index))}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ))}
      <Button type="button" onClick={() => update([...rows, { key: '', value: '' }])}>
        <Plus size={15} />
        {t('schemaForm.add')}
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
  const { t } = useI18n();
  const [text, setText] = useState(value === undefined ? '' : JSON.stringify(value, null, 2));
  const input = useRef<HTMLTextAreaElement>(null);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    input.current?.setCustomValidity(invalid ? t('schemaForm.invalidJson') : '');
  }, [invalid, t]);
  return (
    <textarea
      ref={input}
      dir="ltr"
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
          setInvalid(false);
          onChange(parsed);
        } catch {
          setInvalid(true);
          e.target.setCustomValidity(t('schemaForm.invalidJson'));
        }
      }}
    />
  );
}
type SectionTitleKey = Extract<keyof typeof ptSchemaForm, `schemaForm.section.${string}.title`>;
type SectionDescriptionKey = Extract<
  keyof typeof ptSchemaForm,
  `schemaForm.section.${string}.description`
>;
function WorkloadSections({
  fields,
  render,
}: {
  fields: [string, SchemaField][];
  render: (entry: [string, SchemaField]) => ReactNode;
}) {
  const { t } = useI18n();
  const { groups, advanced } = workloadSections(fields);
  return (
    <>
      {groups.map((group) => {
        const section = group.fields[0] || 'required';
        const titleKey = `schemaForm.section.${section}.title`;
        const descriptionKey = `schemaForm.section.${section}.description`;
        const title = Object.hasOwn(ptSchemaForm, titleKey)
          ? t(titleKey as SectionTitleKey)
          : group.title;
        const description = Object.hasOwn(ptSchemaForm, descriptionKey)
          ? t(descriptionKey as SectionDescriptionKey)
          : group.description;
        return ['name', 'imageUuid', 'required'].includes(section) ||
          group.entries.some(([, field]) => field.required) ? (
          <section className="form-section" key={section} aria-label={title}>
            <h3>{title}</h3>
            <p className="muted">{description}</p>
            {group.entries.map(render)}
          </section>
        ) : (
          <details className="workload-form-section" key={section}>
            <summary>
              <strong>{title}</strong>
              <span>{description}</span>
            </summary>
            <div>{group.entries.map(render)}</div>
          </details>
        );
      })}
      {!!advanced.length && (
        <details className="advanced-fields">
          <summary>
            {t('schemaForm.nativeOptions')}{' '}
            <span>{t('schemaForm.optionCount', { count: advanced.length })}</span>
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
  ulimitEditors = false,
  deviceEditors = false,
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
  ulimitEditors?: boolean;
  deviceEditors?: boolean;
}) {
  const { locale, t } = useI18n();
  const key = fieldLabelKey(name);
  const defaultLabel = key ? t(key) : humanizeFieldName(name);
  const label = field.label || defaultLabel;
  const nested = objectSchema(field.type, schemas);
  const [revealed, setRevealed] = useState(false);
  if (deviceEditors && name === 'devices' && supportsDevices(field))
    return <DeviceEditor value={value} onChange={onChange} />;
  if (ulimitEditors && name === 'ulimits' && supportsUlimits(field, schemas))
    return <UlimitEditor value={value} onChange={onChange} />;
  if (
    securityEditors &&
    ['capAdd', 'capDrop'].includes(name) &&
    field.type === 'array[enum]' &&
    field.options
  )
    return (
      <CapabilityEditor
        label={t(name === 'capAdd' ? 'schemaForm.label.capAdd' : 'schemaForm.label.capDrop')}
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
        label={t(
          name === 'memory'
            ? 'serviceUpgradeForm.memoryLimit'
            : 'serviceUpgradeForm.memoryReservation',
        )}
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
        ulimitEditors={ulimitEditors}
        deviceEditors={deviceEditors}
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
        ulimitEditors={ulimitEditors}
        deviceEditors={deviceEditors}
        healthCheckEditors={healthCheckEditors}
      />
    );
    const primary = nestedFields.filter(([key, child]) => basics.has(key) || child.required);
    const advanced = nestedFields.filter(([key, child]) => !basics.has(key) && !child.required);
    return (
      <fieldset className="nested-fields">
        <legend>
          {defaultLabel}
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
            <span>
              {t('schemaForm.configure', {
                label: field.label || defaultLabel.toLocaleLowerCase(locale),
              })}
            </span>
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
                      {t('schemaForm.otherOptions', {
                        label: defaultLabel.toLocaleLowerCase(locale),
                      })}{' '}
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
        label={label}
        description={field.description}
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  return (
    <Field
      label={`${label}${field.required ? ' *' : ''}`}
      hint={
        field.description ||
        (field.validChars ? t('schemaForm.validChars', { chars: field.validChars }) : undefined) ||
        (/^reference\[/.test(field.type)
          ? choices
            ? t('schemaForm.chooseResource')
            : t('schemaForm.enterResource')
          : field.type.startsWith('array[')
            ? t('schemaForm.arrayHint')
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
              <option value="">{t('schemaForm.select')}</option>
              {!!value && !choices.some((choice) => choice.id === value) && (
                <option value={String(value)}>
                  {t('schemaForm.unavailableResource', { id: String(value) })}
                </option>
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
              <option value="">{t('schemaForm.select')}</option>
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
              name={defaultLabel}
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
                  {t(revealed ? 'schemaForm.hide' : 'schemaForm.show')}
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
  ulimitEditors = false,
  deviceEditors = false,
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
  ulimitEditors?: boolean;
  deviceEditors?: boolean;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
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
    <section aria-label={t('schemaForm.sidecars')}>
      <p className="muted">{t('schemaForm.sidecarsHelp')}</p>
      {!valid ? (
        <Alert>{t('schemaForm.sidecarsInvalid')}</Alert>
      ) : (
        <>
          {rows.map((row, index) => (
            <fieldset className="nested-fields" key={row.key}>
              <legend>
                {t('schemaForm.sidecar', { index: index + 1 })}
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
                    ulimitEditors={ulimitEditors}
                    deviceEditors={deviceEditors}
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
                {t('schemaForm.removeSidecar', { index: index + 1 })}
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
            {t('schemaForm.addSidecar')}
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
  ulimitEditors = false,
  deviceEditors = false,
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
  ulimitEditors?: boolean;
  deviceEditors?: boolean;
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
  const { t } = useI18n();
  const [validation, setValidation] = useState<Error | 'review' | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    setValidation(null);
    try {
      if (bindingEditors) validateBindingFields(schema, values, schemas, initialBindings.current);
      if (healthCheckEditors) validateWorkloadHealthChecks(schema, values, schemas);
      if (securityEditors) validateWorkloadSecurity(schema, values, schemas);
      if (ulimitEditors) validateWorkloadUlimits(schema, values, schemas);
      if (deviceEditors && !original) validateWorkloadDevices(schema, values, schemas);
      if (resourceEditors) validateWorkloadResources(schema, values, schemas);
      if (schedulingEditors) validateWorkloadScheduling(schema, values, schemas);
      if (sidecarEditors && schema.id === 'service') validateSidecars(values, schemas);
      onSubmit(preparePayload(schema, values, original, schemas));
    } catch (error) {
      setValidation(error instanceof Error ? error : 'review');
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
      ulimitEditors={ulimitEditors}
      deviceEditors={deviceEditors && !original}
      onChange={(value) => {
        setValues((previous) => ({ ...previous, [name]: value }));
        if (field.type.startsWith('reference[')) onReferenceChange?.(name, String(value ?? ''));
      }}
    />
  );
  const main = fields.filter(([name, field]) => basics.has(name) || field.required);
  const advanced = fields.filter(([name, field]) => !basics.has(name) && !field.required);
  function describeError(value?: Error | null) {
    if (value instanceof DeviceValidationError || value instanceof ResourceValidationError)
      return t(value.key);
    if (!(value instanceof SchemaPayloadError)) return workloadValidationMessage(value, t);
    const [key, name, limit] = value.detail;
    if (key === 'schemaForm.validation.depth') return t(key);
    const labelKey = fieldLabelKey(name);
    const field = labelKey ? t(labelKey) : humanizeFieldName(name);
    if (key === 'schemaForm.validation.minLength' || key === 'schemaForm.validation.maxLength')
      return t(key, { field, limit: String(limit) });
    return t(key, { field });
  }
  const validationText =
    validation === 'review' ? t('schemaForm.review') : describeError(validation);
  const errorText = describeError(error);
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
                  {t('schemaForm.advanced')}{' '}
                  <span>{t('schemaForm.optionCount', { count: advanced.length })}</span>
                </summary>
                <div>{advanced.map(render)}</div>
              </details>
            )}
          </>
        )}
      </fieldset>
      {(validationText || errorText) && <Alert>{validationText || errorText}</Alert>}
    </form>
  );
}
