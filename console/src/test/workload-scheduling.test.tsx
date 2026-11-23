import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  affinityPrefix as P,
  decodeScheduling,
  encodeScheduling,
  globalLabel,
  validateSchedulingLabels,
  validateWorkloadScheduling,
} from '../workload-scheduling';
import { SchedulingEditor } from '../components/SchedulingEditor';
import { SchemaForm } from '../components/SchemaForm';
import type { Schema } from '../api';
const schema: Schema = {
  id: 'container',
  links: {},
  pluralName: 'containers',
  collectionMethods: ['POST'],
  resourceFields: { labels: { type: 'map[string]', create: true } },
};

describe('Afinidades nativas de criação', () => {
  it('preserva campos externos e todas as variantes, inclusive valores com igual', () => {
    const labels = {
      custom: 'unchanged',
      [P + 'host_label']: 'disk=ssd,region=west',
      [P + 'container_label_soft_ne']: 'app=job=worker',
      [P + 'container_ne']: 'database',
      [P + 'future']: 'opaque',
    };
    const decoded = decodeScheduling(labels);
    expect(decoded.rules).toHaveLength(4);
    expect(encodeScheduling(decoded.rules, decoded.other)).toEqual(labels);
    const unusual = JSON.parse('{"__proto__":"kept","constructor":"also-kept"}');
    expect(encodeScheduling([], decodeScheduling(unusual).other)).toEqual(unusual);
  });
  it('bloqueia expressão incompleta, vírgulas e caracteres de controle sem conversão silenciosa', () => {
    for (const value of ['disk', '=ssd', 'disk=', 'a=b,', 'key with space=value', 'a=line\nbreak'])
      expect(() => decodeScheduling({ [P + 'host_label']: value })).toThrow();
    const row = { id: 'own', kind: 'container' as const, mode: '' as const, key: '', value: 'a,b' };
    expect(() => encodeScheduling([row], {})).toThrow();
    expect(() => validateSchedulingLabels({ custom: 1 })).toThrow();
  });
  it('aplica restrições globais sem remover labels desconhecidas', () => {
    expect(() =>
      validateSchedulingLabels({ [globalLabel]: 'true', [P + 'host_label_ne']: 'disk=hdd' }),
    ).not.toThrow();
    for (const key of ['host_label_soft', 'host_label_soft_ne', 'container', 'container_label'])
      expect(() =>
        validateSchedulingLabels({
          [globalLabel]: 'true',
          [P + key]: key === 'container' ? 'db' : 'disk=ssd',
        }),
      ).toThrow('global');
  });
  it('valida afinidades aninhadas no primário e em sidecars', () => {
    const service: Schema = {
      ...schema,
      id: 'service',
      resourceFields: {
        launchConfig: { type: 'launchConfig' },
        secondaryLaunchConfigs: { type: 'array[secondaryLaunchConfig]' },
      },
    };
    const schemas = {
      launchConfig: { ...schema, id: 'launchConfig' },
      secondaryLaunchConfig: { ...schema, id: 'secondaryLaunchConfig' },
    };
    for (const values of [
      { launchConfig: { labels: { [P + 'host_label']: 'invalid' } } },
      { secondaryLaunchConfigs: [{ labels: { [P + 'host_label']: 'invalid' } }] },
    ])
      expect(() => validateWorkloadScheduling(service, values, schemas)).toThrow();
  });
  it('adiciona e remove regra preservando outras labels e estado de digitação', async () => {
    function Editor() {
      const [value, setValue] = useState<Record<string, string>>({ custom: 'kept' });
      return (
        <>
          <SchedulingEditor
            value={value}
            onChange={setValue}
            renderLabels={(labels) => <p>{labels.custom}</p>}
          />
          <output>{JSON.stringify(value)}</output>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Adicionar afinidade' }));
    const row = screen.getByRole('group', { name: 'Afinidade 1' });
    await user.type(within(row).getByLabelText('Chave da label'), 'disk');
    await user.type(within(row).getByLabelText('Valor da label'), 'ssd');
    expect(screen.getByRole('status')).toHaveTextContent(
      '"io.rancher.scheduler.affinity:host_label":"disk=ssd"',
    );
    await user.click(within(row).getByRole('button', { name: 'Remover afinidade 1' }));
    expect(screen.getByRole('status')).toHaveTextContent('{"custom":"kept"}');
  });
  it('regras não decodificáveis usam mapa nativo e não são perdidas', () => {
    render(
      <SchedulingEditor
        value={{ [P + 'host_label']: 'legacy' }}
        onChange={() => {}}
        renderLabels={(labels) => <output>{JSON.stringify(labels)}</output>}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('nada foi convertido');
    expect(screen.getByRole('status')).toHaveTextContent('legacy');
    expect(screen.queryByRole('button', { name: 'Adicionar afinidade' })).not.toBeInTheDocument();
  });
  it('flag off mantém editor genérico de labels', () => {
    render(
      <SchemaForm
        schema={schema}
        schemas={{ container: schema }}
        onSubmit={() => {}}
        layout="workload"
        schedulingEditors={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Adicionar afinidade' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar', hidden: true })).toBeInTheDocument();
  });
});
