import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Schema } from '../api';
import { validateSidecars } from '../workload-sidecars';
import { validateWorkloadCreation } from '../workload-creation';
import { SchemaForm } from '../components/SchemaForm';
const text = { type: 'string', create: true };
const sidecar: Schema = {
  id: 'secondaryLaunchConfig',
  pluralName: 'secondaryLaunchConfigs',
  links: {},
  resourceFields: {
    name: { ...text, required: true },
    imageUuid: text,
    networkLaunchConfig: text,
    networkMode: { type: 'enum', create: true, options: ['managed', 'container', 'none'] },
    dataVolumesFromLaunchConfigs: { type: 'array[string]', create: true },
    healthCheck: { type: 'instanceHealthCheck', create: true, nullable: true },
  },
};
const health: Schema = {
  id: 'instanceHealthCheck',
  pluralName: 'instanceHealthChecks',
  links: {},
  resourceFields: { port: { type: 'int', create: true, required: true }, requestLine: text },
};
const service: Schema = {
  id: 'service',
  pluralName: 'services',
  links: {},
  collectionMethods: ['POST'],
  resourceFields: {
    name: { ...text, required: true },
    secondaryLaunchConfigs: { type: 'array[secondaryLaunchConfig]', create: true },
  },
};
const schemas = { secondaryLaunchConfig: sidecar, instanceHealthCheck: health };
const row = (name: string) => ({ name, imageUuid: 'alpine:3.20' });
describe('Sidecars na criação', () => {
  it('valida nomes/imagens e normaliza cada imagem usando o schema nativo', () => {
    const values = { name: 'web', secondaryLaunchConfigs: [row('worker'), row('cache')] };
    expect(validateWorkloadCreation(service, values, schemas, true, true)).toMatchObject({
      secondaryLaunchConfigs: [
        { name: 'worker', imageUuid: 'docker:alpine:3.20' },
        { name: 'cache', imageUuid: 'docker:alpine:3.20' },
      ],
    });
    for (const configs of [
      [row('web')],
      [row('worker'), row('worker')],
      [row('bad/name')],
      [{ name: 'worker', imageUuid: '' }],
    ])
      expect(() =>
        validateSidecars({ name: 'web', secondaryLaunchConfigs: configs }, schemas),
      ).toThrow();
  });
  it('bloqueia referências ausentes, self-reference e ciclos de rede/volumes', () => {
    for (const patch of [
      { networkMode: 'container', networkLaunchConfig: 'missing' },
      { networkMode: 'container', networkLaunchConfig: 'worker' },
      { dataVolumesFromLaunchConfigs: ['missing'] },
    ])
      expect(() =>
        validateSidecars(
          { name: 'web', secondaryLaunchConfigs: [{ ...row('worker'), ...patch }] },
          schemas,
        ),
      ).toThrow('vínculos');
    for (const field of ['networkLaunchConfig', 'dataVolumesFromLaunchConfigs'])
      expect(() =>
        validateSidecars(
          {
            name: 'web',
            secondaryLaunchConfigs: [
              {
                ...row('a'),
                networkMode: 'container',
                [field]: field === 'networkLaunchConfig' ? 'b' : ['b'],
              },
              {
                ...row('b'),
                networkMode: 'container',
                [field]: field === 'networkLaunchConfig' ? 'a' : ['a'],
              },
            ],
          },
          schemas,
        ),
      ).toThrow('ciclos');
  });
  it('recusa ciclo misto e colisão de nomes sem diferenciar caixa', () => {
    for (const values of [
      {
        name: 'web',
        secondaryLaunchConfigs: [
          { ...row('a'), networkMode: 'container', networkLaunchConfig: 'b' },
          { ...row('b'), dataVolumesFromLaunchConfigs: ['a'] },
        ],
      },
      {
        name: 'web',
        launchConfig: { networkMode: 'container', networkLaunchConfig: 'a' },
        secondaryLaunchConfigs: [{ ...row('a'), dataVolumesFromLaunchConfigs: ['web'] }],
      },
    ])
      expect(() => validateSidecars(values, schemas)).toThrow('ciclos');
    for (const configs of [[row('Web')], [row('Worker'), row('worker')]])
      expect(() =>
        validateSidecars({ name: 'web', secondaryLaunchConfigs: configs }, schemas),
      ).toThrow('nomes únicos');
    const acyclic = {
      name: 'web',
      launchConfig: {},
      secondaryLaunchConfigs: [
        {
          ...row('a'),
          networkMode: 'container',
          networkLaunchConfig: 'web',
          dataVolumesFromLaunchConfigs: ['web'],
        },
      ],
    };
    const before = JSON.stringify(acyclic);
    expect(() => validateSidecars(acyclic, schemas)).not.toThrow();
    expect(JSON.stringify(acyclic)).toBe(before);
  });
  it('permite referência ao primário e a outro sidecar sem alterar campos', () => {
    const values = {
      name: 'web',
      secondaryLaunchConfigs: [
        { ...row('worker'), networkMode: 'container', networkLaunchConfig: 'web' },
        { ...row('cache'), dataVolumesFromLaunchConfigs: ['worker'] },
      ],
    };
    const before = JSON.stringify(values);
    expect(() => validateSidecars(values, schemas)).not.toThrow();
    expect(JSON.stringify(values)).toBe(before);
  });
  it('recusa referência de rede sem modo container em vez de criar rede isolada', () => {
    for (const networkMode of [undefined, 'managed', 'none']) {
      expect(() =>
        validateSidecars(
          {
            name: 'web',
            secondaryLaunchConfigs: [{ ...row('worker'), networkMode, networkLaunchConfig: 'web' }],
          },
          schemas,
        ),
      ).toThrow('modo de rede container');
    }
  });
  it('rejeita lista inválida/excessiva e contratos de sidecar revogados', () => {
    for (const value of [{}, [null], Array.from({ length: 51 }, (_, i) => row('a' + i))])
      expect(() => validateSidecars({ secondaryLaunchConfigs: value }, schemas)).toThrow();
    expect(() =>
      validateWorkloadCreation(
        service,
        { name: 'web', secondaryLaunchConfigs: [row('worker')] },
        {},
        false,
        true,
      ),
    ).toThrow('Contrato');
  });
  it('revalida campos e saúde dentro das listas com schema fresco', () => {
    expect(() =>
      validateWorkloadCreation(
        service,
        { name: 'web', secondaryLaunchConfigs: [{ ...row('worker'), healthCheck: { port: 0 } }] },
        schemas,
        true,
        true,
      ),
    ).toThrow('Porta');
    expect(() =>
      validateWorkloadCreation(
        service,
        { name: 'web', secondaryLaunchConfigs: [{ ...row('worker'), revoked: true }] },
        schemas,
        true,
        true,
      ),
    ).toThrow('revoked');
  });
  it('remover primeiro sidecar preserva valores e estado HTTP do segundo', async () => {
    const user = userEvent.setup(),
      submit = vi.fn();
    render(
      <>
        <SchemaForm
          id="sidecars"
          sidecarEditors
          healthCheckEditors
          layout="workload"
          schema={service}
          schemas={schemas}
          onSubmit={submit}
        />
        <button type="submit" form="sidecars">
          Salvar serviço
        </button>
      </>,
    );
    await user.type(screen.getByLabelText('Nome *'), 'web');
    fireEvent.click(screen.getByText('Sidecars', { exact: true }));
    await user.click(screen.getByRole('button', { name: 'Adicionar sidecar' }));
    const first = within(screen.getByRole('group', { name: 'Sidecar 1' }));
    await user.type(first.getByLabelText('Nome *'), 'first');
    await user.type(first.getByLabelText('Imagem *'), 'alpine:3.20');
    await user.click(screen.getByRole('button', { name: 'Adicionar sidecar' }));
    const second = within(screen.getByRole('group', { name: 'Sidecar 2' }));
    await user.type(second.getByLabelText('Nome *'), 'second');
    await user.type(second.getByLabelText('Imagem *'), 'busybox:1');
    fireEvent.click(second.getByText('Saúde', { exact: true }));
    await user.selectOptions(second.getByLabelText('Tipo de verificação'), 'http');
    await user.type(second.getByLabelText('Porta da verificação'), '8080');
    await user.clear(second.getByLabelText('Caminho da verificação HTTP'));
    await user.type(second.getByLabelText('Caminho da verificação HTTP'), '/second');
    await user.click(screen.getByRole('button', { name: 'Remover sidecar 1' }));
    const remaining = within(screen.getByRole('group', { name: 'Sidecar 1 · second' }));
    expect(remaining.getByLabelText('Nome *')).toHaveValue('second');
    expect(remaining.getByLabelText('Caminho da verificação HTTP')).toHaveValue('/second');
    await user.click(screen.getByRole('button', { name: 'Salvar serviço' }));
    expect(submit).toHaveBeenCalledWith({
      name: 'web',
      secondaryLaunchConfigs: [
        {
          name: 'second',
          imageUuid: 'docker:busybox:1',
          healthCheck: { port: 8080, requestLine: 'GET "/second" "HTTP/1.0"' },
        },
      ],
    });
  });
  it('flag off mantém JSON genérico e não oferece adicionar sidecar', () => {
    render(<SchemaForm schema={service} schemas={schemas} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Adicionar sidecar' })).not.toBeInTheDocument();
  });
});
