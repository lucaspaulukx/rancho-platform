import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Schema } from '../api';
import {
  healthDefaults,
  healthRequestLine,
  decodeHealthRequest,
  validateHealthCheck,
} from '../workload-healthchecks';
import { validateWorkloadCreation } from '../workload-creation';
import { SchemaForm } from '../components/SchemaForm';
const integer = { type: 'int', create: true };
const health: Schema = {
  id: 'instanceHealthCheck',
  pluralName: 'instanceHealthChecks',
  links: {},
  resourceFields: {
    port: { ...integer, required: true, min: 1, max: 65535 },
    interval: integer,
    responseTimeout: integer,
    initializingTimeout: integer,
    reinitializingTimeout: integer,
    healthyThreshold: integer,
    unhealthyThreshold: integer,
    requestLine: { type: 'string', create: true },
    strategy: {
      type: 'enum',
      create: true,
      options: ['none', 'recreate', 'recreateOnQuorum'],
      default: 'recreate',
    },
    recreateOnQuorumStrategyConfig: {
      type: 'recreateOnQuorumStrategyConfig',
      create: true,
      nullable: true,
    },
  },
};
const quorum: Schema = {
  id: 'recreateOnQuorumStrategyConfig',
  pluralName: 'recreateOnQuorumStrategyConfigs',
  links: {},
  resourceFields: { quorum: integer },
};
const container: Schema = {
  id: 'container',
  pluralName: 'containers',
  collectionMethods: ['POST'],
  links: {},
  resourceFields: {
    imageUuid: { type: 'string', create: true },
    healthCheck: { type: 'instanceHealthCheck', create: true, nullable: true },
  },
};
const schemas = { instanceHealthCheck: health, recreateOnQuorumStrategyConfig: quorum };
const base = () => ({ ...healthDefaults(health), port: 8080 });
describe('Healthcheck nativo Cattle', () => {
  it('gera a sintaxe HAProxy legada exata e lê o mesmo formato', () => {
    const request = {
      method: 'GET',
      path: '/health?ready=1',
      version: 'HTTP/1.1',
      host: 'app.internal:8080',
    };
    expect(healthRequestLine(request)).toBe(
      'GET "/health?ready=1" "HTTP/1.1\\r\\nHost: app.internal:8080"',
    );
    expect(decodeHealthRequest(healthRequestLine(request))).toEqual(request);
    expect(() =>
      validateHealthCheck({ ...base(), requestLine: healthRequestLine(request) }, health),
    ).not.toThrow();
  });
  it('rejeita injeção de linha/header, path/Host inválidos e porta fora da faixa', () => {
    for (const requestLine of [
      'GET "/health x" "HTTP/1.0"',
      'GET "/" "HTTP/1.1\\r\\nHost: a\\r\\nX: b"',
      'GET / HTTP/1.0',
      'GET "/" "HTTP/1.0\\r\\nHost: a"',
    ])
      expect(() => validateHealthCheck({ ...base(), requestLine }, health)).toThrow();
    for (const port of [0, 65536, 1.5, true, ' '])
      expect(() => validateHealthCheck({ ...base(), port }, health)).toThrow('Porta');
  });
  it('aceita grace period zero mas não timeout/threshold/quórum inválidos', () => {
    expect(() =>
      validateHealthCheck({ ...base(), initializingTimeout: 0, reinitializingTimeout: 0 }, health),
    ).not.toThrow();
    for (const field of ['interval', 'responseTimeout', 'healthyThreshold', 'unhealthyThreshold'])
      expect(() => validateHealthCheck({ ...base(), [field]: 0 }, health)).toThrow();
    expect(() =>
      validateHealthCheck(
        { ...base(), strategy: 'recreateOnQuorum', recreateOnQuorumStrategyConfig: { quorum: 0 } },
        health,
        quorum,
      ),
    ).toThrow('Quórum');
  });
  it('revalida schema revogado antes da criação e mantém check desativado null', () => {
    expect(validateWorkloadCreation(container, { healthCheck: null }, schemas, true)).toEqual({
      healthCheck: null,
    });
    expect(() =>
      validateWorkloadCreation(
        container,
        { healthCheck: base() },
        {
          ...schemas,
          instanceHealthCheck: {
            ...health,
            resourceFields: { ...health.resourceFields, port: { type: 'int', create: false } },
          },
        },
        true,
      ),
    ).toThrow('port');
    expect(() => validateHealthCheck({ ...base(), strategy: 'recreateOnQuorum' }, health)).toThrow(
      'quórum',
    );
  });
  it('normaliza números sem mexer na imagem ou nas outras opções do workload', () => {
    expect(
      validateWorkloadCreation(
        container,
        { imageUuid: 'alpine:3.20', healthCheck: { ...base(), port: '8080' } },
        schemas,
        true,
      ),
    ).toMatchObject({
      imageUuid: 'docker:alpine:3.20',
      healthCheck: { port: 8080, interval: 2000, strategy: 'recreate' },
    });
  });
  it('editor alterna TCP/HTTP sem perder porta e envia objeto nativo, sem campo de modo', async () => {
    const submit = vi.fn(),
      user = userEvent.setup();
    render(
      <>
        <SchemaForm
          id="health-form"
          healthCheckEditors
          layout="workload"
          schema={container}
          schemas={schemas}
          onSubmit={submit}
        />
        <button type="submit" form="health-form">
          Salvar
        </button>
      </>,
    );
    fireEvent.click(screen.getByText('Saúde'));
    await user.selectOptions(screen.getByLabelText('Tipo de verificação'), 'tcp');
    await user.type(screen.getByLabelText('Porta da verificação'), '8080');
    await user.selectOptions(screen.getByLabelText('Tipo de verificação'), 'http');
    expect(screen.getByLabelText('Porta da verificação')).toHaveValue(8080);
    await user.clear(screen.getByLabelText('Caminho da verificação HTTP'));
    await user.type(screen.getByLabelText('Caminho da verificação HTTP'), '/health');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(submit).toHaveBeenCalledWith({
      healthCheck: expect.objectContaining({ port: 8080, requestLine: 'GET "/health" "HTTP/1.0"' }),
    });
    expect(submit.mock.calls[0][0].healthCheck).not.toHaveProperty('mode');
  });
  it('flag off conserva o formulário genérico, sem seletor estruturado', () => {
    render(<SchemaForm schema={container} schemas={schemas} onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText('Tipo de verificação')).not.toBeInTheDocument();
  });
});
