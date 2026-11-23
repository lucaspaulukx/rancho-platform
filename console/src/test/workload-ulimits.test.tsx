import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Schema } from '../api';
import { SchemaForm, SidecarsEditor } from '../components/SchemaForm';
import { validateConfig } from '../config';
import config from '../../public/console-config.json';
import { UlimitEditor } from '../components/UlimitEditor';
import { normalizeUlimits, ulimitNumber, validateWorkloadUlimits } from '../workload-ulimits';

const schema = {
  id: 'container',
  links: {},
  pluralName: 'containers',
  collectionMethods: ['POST'],
  resourceFields: { ulimits: { type: 'array[ulimit]', create: true } },
} as Schema;
const ulimit = {
  id: 'ulimit',
  links: {},
  pluralName: 'ulimits',
  resourceFields: {
    name: { type: 'string', create: true },
    soft: { type: 'int', create: true },
    hard: { type: 'int', create: true },
  },
} as Schema;
const schemas = { container: schema, ulimit };
describe('Process limits creation', () => {
  it('defaults independently off and rejects nonboolean flag values', () => {
    expect(validateConfig(config).modules.workloadUlimitEditors).toBe(false);
    expect(
      validateConfig({ ...config, modules: { ...config.modules, workloadUlimitEditors: true } })
        .modules.workloadUlimitEditors,
    ).toBe(true);
    expect(() =>
      validateConfig({ ...config, modules: { ...config.modules, workloadUlimitEditors: 'true' } }),
    ).toThrow();
  });
  it('reuses the same editor within primary launch config and sidecars', () => {
    const primary = {
      ...schema,
      id: 'service',
      resourceFields: { launchConfig: { type: 'container', create: true, required: true } },
    } as Schema;
    const { unmount } = render(
      <SchemaForm
        schema={primary}
        schemas={schemas}
        onSubmit={vi.fn()}
        layout="workload"
        ulimitEditors
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Adicionar limite de processo', hidden: true }),
    ).toBeInTheDocument();
    unmount();
    render(
      <SidecarsEditor
        value={[{ name: 'helper', ulimits: [{ name: 'nofile', soft: 1024, hard: 2048 }] }]}
        schemas={{ ...schemas, secondaryLaunchConfig: schema }}
        references={{}}
        bindingEditors={false}
        healthCheckEditors={false}
        ulimitEditors
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Limite inicial 1')).toHaveValue('1024');
  });

  it('keeps 32-bit bounds, zero and unlimited without precision loss', () => {
    expect(
      normalizeUlimits([
        { name: 'nofile', soft: '0', hard: '2147483647' },
        { name: 'core', soft: -1, hard: -1 },
      ]),
    ).toEqual([
      { name: 'nofile', soft: 0, hard: 2147483647 },
      { name: 'core', soft: -1, hard: -1 },
    ]);
    for (const value of [
      '',
      null,
      undefined,
      true,
      '1e3',
      '1.5',
      '-2',
      '2147483648',
      '01',
      {},
      NaN,
    ])
      expect(() => ulimitNumber(value)).toThrow();
  });
  it('rejects duplicate names, incompatible data and invalid soft/hard ordering', () => {
    for (const value of [
      {},
      [null],
      [{ name: 'future', soft: 1, hard: 2 }],
      [{ name: 'nofile', soft: 1, hard: 2, discarded: true }],
      [{ name: 'nofile', soft: -1, hard: 2 }],
      [{ name: 'nofile', soft: 3, hard: 2 }],
      Array(33).fill({ name: 'nofile', soft: 1, hard: 2 }),
      [
        { name: 'nofile', soft: 1, hard: 2 },
        { name: 'nofile', soft: 1, hard: 2 },
      ],
    ])
      expect(() => normalizeUlimits(value)).toThrow();
    expect(normalizeUlimits([{ name: 'nofile', soft: 100, hard: -1 }])[0].hard).toBe(-1);
  });
  it('revalidates nested primary and sidecar contracts before submission', () => {
    const service = {
      ...schema,
      id: 'service',
      resourceFields: {
        launchConfig: { type: 'container' },
        secondaryLaunchConfigs: { type: 'array[container]' },
      },
    } as Schema;
    expect(() =>
      validateWorkloadUlimits(
        service,
        { secondaryLaunchConfigs: [{ ulimits: [{ name: 'nofile', soft: 3, hard: 2 }] }] },
        schemas,
      ),
    ).toThrow();
    expect(() =>
      validateWorkloadUlimits(
        service,
        { launchConfig: { ulimits: [] } },
        { ...schemas, ulimit: { ...ulimit, resourceFields: {} } },
      ),
    ).toThrow();
    expect(() =>
      validateWorkloadUlimits(
        service,
        { launchConfig: { ulimits: [{ name: 'nofile', soft: 1, hard: 2 }] } },
        schemas,
      ),
    ).not.toThrow();
  });
  it('preserves incompatible existing values instead of replacing them with an empty array', () => {
    const change = vi.fn();
    render(<UlimitEditor value={{ legacy: true }} onChange={change} />);
    expect(screen.getByText(/Formato legado incompatível/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Adicionar limite de processo' }),
    ).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
  it('adds explicit blank values, validates and removes rows using shared controls', async () => {
    function Controlled() {
      const [value, setValue] = useState<unknown>();
      return <UlimitEditor value={value} onChange={setValue} />;
    }
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByRole('button', { name: 'Adicionar limite de processo' }));
    expect(screen.getByLabelText('Limite inicial 1')).toHaveValue('');
    await user.selectOptions(screen.getByLabelText('Recurso do limite 1'), 'nofile');
    await user.type(screen.getByLabelText('Limite inicial 1'), '1024');
    await user.type(screen.getByLabelText('Limite máximo 1'), '2048');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remover limite 1' }));
    expect(screen.queryByLabelText('Recurso do limite 1')).not.toBeInTheDocument();
  });
  it('keeps the native JSON form when off and submits normalized values when on', async () => {
    const user = userEvent.setup(),
      submit = vi.fn();
    const { unmount } = render(<SchemaForm schema={schema} schemas={schemas} onSubmit={submit} />);
    expect(
      screen.queryByRole('button', { name: 'Adicionar limite de processo' }),
    ).not.toBeInTheDocument();
    unmount();
    render(
      <>
        <SchemaForm
          id="ulimits-test-form"
          layout="workload"
          schema={schema}
          schemas={schemas}
          onSubmit={submit}
          ulimitEditors
          initialValues={{ ulimits: [{ name: 'nofile', soft: '1024', hard: '2048' }] }}
        />
        <button type="submit" form="ulimits-test-form">
          Salvar
        </button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(submit).toHaveBeenCalledWith({ ulimits: [{ name: 'nofile', soft: 1024, hard: 2048 }] });
  });
});
