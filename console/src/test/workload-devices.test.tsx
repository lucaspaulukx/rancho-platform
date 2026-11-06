import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Schema } from '../api';
import { DeviceEditor } from '../components/DeviceEditor';
import {
  deviceFields,
  DeviceValidationError,
  normalizeDevices,
  supportsDevices,
  validateWorkloadDevices,
} from '../workload-devices';

const container = {
  id: 'container',
  links: {},
  pluralName: 'containers',
  resourceFields: { devices: { type: 'array[string]', create: true } },
} as Schema;

describe('Explicit device mapping contracts', () => {
  it('requires the create string-array contract and preserves accepted values without canonical rewriting', () => {
    expect(supportsDevices(container.resourceFields.devices)).toBe(true);
    expect(supportsDevices({ type: 'array[string]', update: true })).toBe(false);
    expect(supportsDevices({ type: 'array[device]', create: true })).toBe(false);
    expect(supportsDevices(undefined)).toBe(false);
    const values = ['/dev/null:/dev/rancho-null:mwr', '/dev/null:/dev/other:r'];
    const original = [...values];
    expect(normalizeDevices(values)).toEqual(original);
    expect(values).toEqual(original);
    expect(normalizeDevices(values)).not.toBe(values);
    expect(normalizeDevices([])).toEqual([]);
  });

  it('rejects incomplete, nonabsolute, malformed or unbounded mappings rather than dropping rows', () => {
    for (const value of [
      null,
      {},
      'device',
      [null],
      ['/dev/null'],
      ['/dev/null:/dev/target'],
      ['::rwm'],
      ['relative:/dev/target:r'],
      ['/dev/null:relative:r'],
      ['/dev/null:/dev/target:'],
      ['/dev/null:/dev/target:rx'],
      ['/dev/null:/dev/target:rr'],
      ['/dev/null:/dev/target:r:w'],
      ['/dev/' + 'x'.repeat(8192) + ':/dev/target:r'],
      Array.from({ length: 33 }, (_, index) => `/dev/null:/dev/target${index}:r`),
    ])
      expect(() => normalizeDevices(value)).toThrow(DeviceValidationError);
    expect(
      normalizeDevices(Array.from({ length: 32 }, (_, index) => `/dev/null:/dev/target${index}:r`)),
    ).toHaveLength(32);
  });

  it('rejects control characters and duplicate destinations without echoing private paths', () => {
    for (const control of ['\0', '\n', '\r', '\t', '\x1f', '\x7f']) {
      expect(() => normalizeDevices([`/dev/private${control}:/dev/target:r`])).toThrow();
      expect(() => normalizeDevices([`/dev/null:/dev/private${control}:r`])).toThrow();
    }
    expect(() => normalizeDevices(['/dev/null:/dev/shared:r', '/dev/zero:/dev/shared:w'])).toThrow(
      'Cada mapeamento',
    );
    try {
      normalizeDevices(['sentinel-private-path:/dev/target:r']);
    } catch (error) {
      expect((error as Error).message).not.toContain('sentinel-private-path');
    }
  });

  it('validates nested primary and secondary contracts, including a fresh permission change', () => {
    const service = {
      ...container,
      id: 'service',
      resourceFields: {
        launchConfig: { type: 'launchConfig', create: true },
        secondaryLaunchConfigs: { type: 'array[secondaryLaunchConfig]', create: true },
      },
    } as Schema;
    const schemas = { launchConfig: container, secondaryLaunchConfig: container };
    const values = {
      launchConfig: { devices: ['/dev/null:/dev/primary:r'] },
      secondaryLaunchConfigs: [{ devices: ['/dev/zero:/dev/helper:rwm'] }],
    };
    expect(() => validateWorkloadDevices(service, values, schemas)).not.toThrow();
    expect(() =>
      validateWorkloadDevices(service, values, {
        ...schemas,
        secondaryLaunchConfig: { ...container, resourceFields: {} },
      }),
    ).toThrow('contrato atual');
    expect(() => validateWorkloadDevices(container, { devices: [] }, {}, 13)).toThrow(
      'níveis demais',
    );
  });

  it('recognizes editable incomplete drafts but leaves unsupported native strings opaque', () => {
    expect(deviceFields('::rwm')).toEqual({ host: '', container: '', permissions: 'rwm' });
    expect(deviceFields('/dev/null:/dev/target:')).toEqual({
      host: '/dev/null',
      container: '/dev/target',
      permissions: '',
    });
    expect(deviceFields('/legacy-device')).toBeUndefined();
    expect(deviceFields('/dev/null:/dev/target:future')).toBeUndefined();
    expect(deviceFields('/dev/null:/dev/target:rr')).toBeUndefined();
  });
});

describe('Shared structured device editor', () => {
  it('keeps a complete draft with explicit paths and permission choices', async () => {
    const changed = vi.fn();
    function Controlled() {
      const [value, setValue] = useState<unknown>();
      return (
        <DeviceEditor
          value={value}
          onChange={(next) => {
            changed(next);
            setValue(next);
          }}
        />
      );
    }
    const user = userEvent.setup();
    render(<Controlled />);
    expect(screen.getByText(/permissões padrão de dispositivos do runtime/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Adicionar dispositivo' }));
    expect(changed).toHaveBeenLastCalledWith(['::rwm']);
    expect(screen.getByLabelText('Caminho no host 1')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Dispositivo 1: leitura (r)' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Dispositivo 1: escrita (w)' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Dispositivo 1: criar nós (m)' })).toBeChecked();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Caminho no host 1'), '/dev/null');
    await user.type(screen.getByLabelText('Caminho no container 1'), '/dev/rancho-null');
    await user.click(screen.getByRole('checkbox', { name: 'Dispositivo 1: escrita (w)' }));
    await user.click(screen.getByRole('checkbox', { name: 'Dispositivo 1: criar nós (m)' }));
    expect(changed).toHaveBeenLastCalledWith(['/dev/null:/dev/rancho-null:r']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Dispositivo 1: leitura (r)' }));
    expect(changed).toHaveBeenLastCalledWith(['/dev/null:/dev/rancho-null:']);
    expect(screen.getByRole('alert')).toHaveTextContent('pelo menos uma permissão');
  });

  it('preserves opaque legacy strings when another row changes and removes only an explicit selection', async () => {
    const changed = vi.fn();
    function Controlled() {
      const [value, setValue] = useState<unknown>(['/legacy-device', '/dev/null:/dev/known:mwr']);
      return (
        <DeviceEditor
          value={value}
          onChange={(next) => {
            changed(next);
            setValue(next);
          }}
        />
      );
    }
    const user = userEvent.setup();
    render(<Controlled />);
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Valor nativo do dispositivo 1')).toHaveValue('/legacy-device');
    expect(screen.getByLabelText('Valor nativo do dispositivo 1')).toHaveAttribute('readonly');
    await user.clear(screen.getByLabelText('Caminho no container 2'));
    await user.type(screen.getByLabelText('Caminho no container 2'), '/dev/changed');
    expect(changed).toHaveBeenLastCalledWith(['/legacy-device', '/dev/null:/dev/changed:mwr']);
    await user.click(screen.getByRole('button', { name: 'Adicionar dispositivo' }));
    expect(changed).toHaveBeenLastCalledWith([
      '/legacy-device',
      '/dev/null:/dev/changed:mwr',
      '::rwm',
    ]);
    await user.click(screen.getByRole('button', { name: 'Remover dispositivo 1' }));
    expect(changed).toHaveBeenLastCalledWith(['/dev/null:/dev/changed:mwr', '::rwm']);
    expect(screen.getByLabelText('Caminho no container 1')).toHaveValue('/dev/changed');
  });

  it('keeps invalid path text editable across row removal instead of freezing it as opaque legacy data', async () => {
    const changed = vi.fn();
    function Controlled() {
      const [value, setValue] = useState<unknown>([
        '/dev/zero:/dev/first:r',
        '/dev/null:/dev/second:r',
      ]);
      return (
        <DeviceEditor
          value={value}
          onChange={(next) => {
            changed(next);
            setValue(next);
          }}
        />
      );
    }
    const user = userEvent.setup();
    render(<Controlled />);
    await user.clear(screen.getByLabelText('Caminho no host 2'));
    await user.type(screen.getByLabelText('Caminho no host 2'), '/dev/invalid:host');
    expect(screen.getByLabelText('Caminho no host 2')).toHaveValue('/dev/invalid:host');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(() => normalizeDevices(changed.mock.lastCall![0])).toThrow();
    await user.click(screen.getByRole('button', { name: 'Remover dispositivo 1' }));
    expect(screen.getByLabelText('Caminho no host 1')).toHaveValue('/dev/invalid:host');
    expect(screen.queryByLabelText('Valor nativo do dispositivo 1')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Caminho no host 1'));
    await user.type(screen.getByLabelText('Caminho no host 1'), '/dev/null');
    expect(changed).toHaveBeenLastCalledWith(['/dev/null:/dev/second:r']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not replace incompatible values or allow additions beyond the editor budget', () => {
    const changed = vi.fn();
    const { rerender } = render(<DeviceEditor value={{ unexpected: true }} onChange={changed} />);
    expect(screen.getByText(/formato legado incompatível/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar dispositivo' })).not.toBeInTheDocument();
    rerender(
      <DeviceEditor
        value={Array.from({ length: 32 }, (_, index) => `/dev/null:/dev/target${index}:r`)}
        onChange={changed}
      />,
    );
    expect(screen.getByRole('button', { name: 'Adicionar dispositivo' })).toBeDisabled();
    expect(changed).not.toHaveBeenCalled();
  });
});
