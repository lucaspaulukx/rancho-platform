import { useState } from 'react';
import { Copy } from 'lucide-react';
import type { Resource, Schema } from '../api';
import { Badge, Button, Tabs, useToast } from './ui';
import { fieldLabel, sensitiveField } from './SchemaForm';
import { certificateValidity, formatResourceDate } from '../resource-format';

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
  ];
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
        labels={['Resumo', 'Configuração']}
        selected={tab}
        onChange={setTab}
        idPrefix={`resource-${resource.id}`}
        panelId={`resource-details-${resource.id}`}
        label="Detalhes do recurso"
      />
      <div
        id={`resource-details-${resource.id}`}
        role="tabpanel"
        aria-labelledby={`resource-${resource.id}-${tab}`}
      >
        {tab === 0 ? (
          <dl className="details-grid">
            {summary.map((key) => (
              <div key={key}>
                <dt>{fieldLabel(key)}</dt>
                <dd>
                  {key === 'state' ? (
                    <Badge state={resource.state}>{resource.state}</Badge>
                  ) : key === 'expiresAt' ? (
                    <>
                      <span>{formatResourceDate(resource[key])}</span>{' '}
                      <Badge state={certificateValidity(resource[key]).state}>
                        {certificateValidity(resource[key]).label}
                      </Badge>
                    </>
                  ) : ['created', 'issuedAt'].includes(key) ? (
                    formatResourceDate(resource[key])
                  ) : key === 'type' ? (
                    fieldLabel(String(resource[key]))
                  ) : typeof resource[key] === 'object' ? (
                    JSON.stringify(safeConfiguration(resource[key]))
                  ) : (
                    String(resource[key])
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <>
            <div className="panel-heading">
              <p className="muted">
                Configuração retornada pelo Rancher. Campos sensíveis são protegidos nesta
                visualização.
              </p>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(json);
                    toast('Configuração copiada.');
                  } catch {
                    toast('Não foi possível copiar. Selecione o texto para copiar manualmente.');
                  }
                }}
              >
                <Copy size={16} />
                Copiar
              </Button>
            </div>
            <pre className="configuration-viewer" tabIndex={0} aria-label="Configuração sanitizada">
              {json}
            </pre>
          </>
        )}
      </div>
    </section>
  );
}
