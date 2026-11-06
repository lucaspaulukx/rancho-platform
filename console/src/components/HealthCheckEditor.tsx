import { useState } from 'react';
import type { Schema } from '../api';
import { useI18n } from '../i18n/provider';
import {
  healthDefaults,
  healthMethods,
  healthNumbers,
  healthRequestLine,
  decodeHealthRequest,
  type HealthRequest,
} from '../workload-healthchecks';
import { Alert, Field } from './ui';

export function HealthCheckEditor({
  value,
  schema,
  quorum,
  onChange,
}: {
  value: unknown;
  schema: Schema;
  quorum?: Schema;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const v = (value || {}) as Record<string, unknown>;
  const [mode, setMode] = useState(value == null ? 'none' : v.requestLine ? 'http' : 'tcp');
  const [request, setRequest] = useState<HealthRequest>(
    () =>
      decodeHealthRequest(String(v.requestLine || '')) || {
        method: 'GET',
        path: '/',
        version: 'HTTP/1.0',
        host: '',
      },
  );
  function changeRequest(patch: Partial<HealthRequest>) {
    const next = { ...request, ...patch };
    setRequest(next);
    onChange({ ...v, requestLine: healthRequestLine(next) });
  }
  return (
    <fieldset className="nested-fields">
      <legend>{t('healthCheckEditor.title')}</legend>
      <Field label={t('healthCheckEditor.type')}>
        {(id) => (
          <select
            id={id}
            value={mode}
            onChange={(e) => {
              const next = e.target.value;
              setMode(next);
              const initial = healthDefaults(schema);
              onChange(
                next === 'none'
                  ? null
                  : {
                      ...initial,
                      ...v,
                      ...(schema.resourceFields.requestLine?.create
                        ? { requestLine: next === 'http' ? healthRequestLine(request) : '' }
                        : {}),
                    },
              );
            }}
          >
            <option value="none">{t('healthCheckEditor.disabled')}</option>
            <option value="tcp">{t('healthCheckEditor.tcp')}</option>
            {schema.resourceFields.requestLine?.create && (
              <option value="http">{t('healthCheckEditor.http')}</option>
            )}
          </select>
        )}
      </Field>
      {mode !== 'none' && (
        <>
          <Field label={t('healthCheckEditor.port')} hint={t('healthCheckEditor.portHint')}>
            {(id, description) => (
              <input
                id={id}
                aria-describedby={description}
                type="number"
                min={1}
                max={65535}
                step={1}
                required
                value={String(v.port ?? '')}
                onChange={(e) => onChange({ ...v, port: e.target.value })}
              />
            )}
          </Field>
          {mode === 'http' && (
            <>
              <div className="form-grid">
                <Field label={t('healthCheckEditor.method')}>
                  {(id) => (
                    <select
                      id={id}
                      value={request.method}
                      onChange={(e) => changeRequest({ method: e.target.value })}
                    >
                      {healthMethods.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={t('healthCheckEditor.version')}>
                  {(id) => (
                    <select
                      id={id}
                      value={request.version}
                      onChange={(e) => changeRequest({ version: e.target.value })}
                    >
                      <option>HTTP/1.0</option>
                      <option>HTTP/1.1</option>
                    </select>
                  )}
                </Field>
              </div>
              <Field label={t('healthCheckEditor.path')} hint={t('healthCheckEditor.pathHint')}>
                {(id, description) => (
                  <input
                    id={id}
                    aria-describedby={description}
                    required
                    value={request.path}
                    autoComplete="off"
                    onChange={(e) => changeRequest({ path: e.target.value })}
                  />
                )}
              </Field>
              {request.version === 'HTTP/1.1' && (
                <Field label={t('healthCheckEditor.host')}>
                  {(id) => (
                    <input
                      id={id}
                      autoComplete="off"
                      value={request.host}
                      onChange={(e) => changeRequest({ host: e.target.value })}
                    />
                  )}
                </Field>
              )}
            </>
          )}
          <details className="advanced-fields">
            <summary>{t('healthCheckEditor.advanced')}</summary>
            <div>
              <div className="form-grid">
                {healthNumbers
                  .filter(([name]) => schema.resourceFields[name]?.create)
                  .map(([name, , min]) => (
                    <Field key={name} label={t(`healthCheckEditor.number.${name}`)}>
                      {(id) => (
                        <input
                          id={id}
                          type="number"
                          min={min}
                          step={1}
                          value={String(v[name] ?? '')}
                          onChange={(e) => onChange({ ...v, [name]: e.target.value })}
                        />
                      )}
                    </Field>
                  ))}
              </div>
              {schema.resourceFields.strategy?.create && (
                <Field label={t('healthCheckEditor.strategy')}>
                  {(id) => (
                    <select
                      id={id}
                      value={String(v.strategy ?? '')}
                      onChange={(e) =>
                        onChange({
                          ...v,
                          strategy: e.target.value,
                          recreateOnQuorumStrategyConfig:
                            e.target.value === 'recreateOnQuorum' ? { quorum: 1 } : null,
                        })
                      }
                    >
                      {schema.resourceFields.strategy.options?.map((key) => (
                        <option key={key} value={key}>
                          {(
                            {
                              none: t('healthCheckEditor.strategy.none'),
                              recreate: t('healthCheckEditor.strategy.recreate'),
                              recreateOnQuorum: t('healthCheckEditor.strategy.recreateOnQuorum'),
                            } as Record<string, string>
                          )[key] || key}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}
              {v.strategy === 'recreateOnQuorum' && quorum?.resourceFields.quorum?.create && (
                <Field label={t('healthCheckEditor.quorum')}>
                  {(id) => (
                    <input
                      id={id}
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={String(
                        (v.recreateOnQuorumStrategyConfig as Record<string, unknown>)?.quorum ?? '',
                      )}
                      onChange={(e) =>
                        onChange({
                          ...v,
                          recreateOnQuorumStrategyConfig: { quorum: e.target.value },
                        })
                      }
                    />
                  )}
                </Field>
              )}
            </div>
          </details>
          <Alert tone="info">{t('healthCheckEditor.notice')}</Alert>
        </>
      )}
    </fieldset>
  );
}
