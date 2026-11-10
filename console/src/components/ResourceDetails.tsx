import { useState } from 'react';
import { Copy } from 'lucide-react';
import type { Resource, Schema } from '../api';
import { Badge, ResourceStateBadge, Button, Tabs, useToast } from './ui';
import { fieldLabel, sensitiveField } from './SchemaForm';
import { certificateValidity, formatResourceDate } from '../resource-format';
import { useI18n } from '../i18n/provider';

export function safeConfiguration(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[profundidade limitada]';
  if (Array.isArray(value))
    return value.slice(0, 500).map((item) => safeConfiguration(item, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['actions', 'links'].includes(key))
        .map(([key, item]) => [
          key,
          sensitiveField(key) ? '[protegido]' : safeConfiguration(item, depth + 1),
        ]),
    );
  return value;
}
export function ResourceDetails({ resource, schema }: { resource: Resource; schema?: Schema }) {
  const [tab, setTab] = useState(0);
  const toast = useToast();
  const { t, locale, formats } = useI18n();
  const fields = [
    'id',
    'name',
    'description',
    'type',
    'state',
    'healthState',
    'imageUuid',
    'scale',
    'hostname',
    'primaryIpAddress',
    'hostId',
    'stackId',
    'accountId',
    'projectTemplateId',
    'orchestration',
    'created',
    'serverAddress',
    'CN',
    'expiresAt',
    'issuedAt',
    'certFingerprint',
    'driver',
    'sizeMb',
    'transitioningMessage',
  ] as const;
  const summary = fields.filter(
    (key) => resource[key] !== undefined && resource[key] !== null && resource[key] !== '',
  );
  const configuration = Object.fromEntries(
    Object.entries(resource).filter(
      ([key]) =>
        !sensitiveField(key, schema?.resourceFields[key]) &&
        !['actions', 'links', 'hasComposeSource'].includes(key),
    ),
  );
  const json = JSON.stringify(safeConfiguration(configuration), null, 2);
  return (
    <section className="panel resource-details">
      <Tabs
        labels={[t('details.summary'), t('details.configuration')]}
        selected={tab}
        onChange={setTab}
        idPrefix={`resource-${resource.id}`}
        panelId={`resource-details-${resource.id}`}
        label={t('details.label')}
      />
      <div
        id={`resource-details-${resource.id}`}
        role="tabpanel"
        aria-labelledby={`resource-${resource.id}-${tab}`}
      >
        {tab === 0 ? (
          <dl className="details-grid">
            {summary.map((key) => {
              const validity =
                key === 'expiresAt' ? certificateValidity(resource[key], undefined, t) : undefined;
              const value = resource[key];
              return (
                <div key={key}>
                  <dt>{t(`details.field.${key}`)}</dt>
                  <dd>
                    {key === 'state' ? (
                      <ResourceStateBadge state={resource.state} />
                    ) : validity ? (
                      <>
                        <span>{formatResourceDate(value, locale)}</span>{' '}
                        <Badge state={validity.state}>{validity.label}</Badge>
                      </>
                    ) : ['created', 'issuedAt'].includes(key) ? (
                      formatResourceDate(value, locale)
                    ) : key === 'type' ? (
                      fieldLabel(String(resource[key]), t)
                    ) : typeof resource[key] === 'object' ? (
                      JSON.stringify(safeConfiguration(resource[key]))
                    ) : typeof value === 'number' ? (
                      formats.number(value)
                    ) : (
                      String(resource[key])
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <>
            <div className="panel-heading">
              <p className="muted">{t('details.explanation')}</p>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(json);
                    toast(t('details.copied'));
                  } catch {
                    toast(t('details.copyFailed'));
                  }
                }}
              >
                <Copy size={16} />
                {t('details.copy')}
              </Button>
            </div>
            <pre
              className="configuration-viewer"
              tabIndex={0}
              dir="ltr"
              aria-label={t('details.sanitized')}
            >
              {json}
            </pre>
          </>
        )}
      </div>
    </section>
  );
}
