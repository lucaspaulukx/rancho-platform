import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceUpgradeForm } from '../components/ServiceUpgradeForm';
import type { Resource, Schema } from '../api';
import contract from './fixtures/upgrade-schema.json';

const fields = {
  imageUuid: { type: 'string', create: true },
  name: { type: 'string', create: true },
  devices: { type: 'array[string]', create: true },
};
const schemas = {
  ...contract.schemas,
  launchConfig: { id: 'launchConfig', links: {}, resourceFields: fields },
  secondaryLaunchConfig: { id: 'secondaryLaunchConfig', links: {}, resourceFields: fields },
} as unknown as Record<string, Schema>;
const service = {
  id: '1s1',
  type: 'service',
  state: 'active',
  accountId: '1a12',
  actions: { upgrade: '/upgrade' },
  links: {},
  launchConfig: { imageUuid: 'docker:alpine:3.20', devices: ['/dev/null:/dev/primary:r'] },
  secondaryLaunchConfigs: [
    {
      name: 'helper',
      imageUuid: 'docker:alpine:3.20',
      devices: ['/dev/null:/dev/helper-base:r'],
    },
  ],
} as Resource;

describe('Structured sidecar devices in service upgrades', () => {
  it('requires review and sends only the independent sidecar device marker', async () => {
    const submit = vi.fn();
    const { container } = render(
      <ServiceUpgradeForm
        resource={service}
        schemas={schemas}
        sidecarsEnabled
        devicesEnabled
        onSubmit={submit}
        onDirtyChange={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    await userEvent.click(screen.getByLabelText('Editar sidecars nesta atualização'));
    const devices = screen.getByRole('group', { name: 'Dispositivo 1' });
    const target = within(devices).getByRole('textbox', { name: 'Caminho no container 1' });
    fireEvent.change(target, { target: { value: '/dev/helper-new' } });
    fireEvent.submit(container.querySelector('form')!);
    const review = await screen.findByRole('dialog', {
      name: 'Atualizar dispositivos do serviço?',
    });
    expect(submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole('button', { name: 'Confirmar' }));
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        editSidecars: true,
        editSidecarDevices: true,
        secondaryLaunchConfigs: [
          expect.objectContaining({ devices: ['/dev/null:/dev/helper-new:r'] }),
        ],
      }),
    );
    expect(submit.mock.calls[0][0]).not.toHaveProperty('editDevices');
    expect(submit.mock.calls[0][0]).not.toHaveProperty('devices');
    expect(service.launchConfig).toHaveProperty('devices', ['/dev/null:/dev/primary:r']);
  });

  it('keeps the generic compatibility editor when the device flag is off', async () => {
    render(
      <ServiceUpgradeForm
        resource={service}
        schemas={schemas}
        sidecarsEnabled
        onSubmit={vi.fn()}
        onDirtyChange={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    await userEvent.click(screen.getByLabelText('Editar sidecars nesta atualização'));
    expect(screen.queryByRole('group', { name: 'Dispositivo 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar dispositivo' })).not.toBeInTheDocument();
  });
});
