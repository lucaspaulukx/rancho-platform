import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import contract from './fixtures/upgrade-schema.json';
import type { Resource, Schema } from '../api';
import { cpuFields, cpuResourceDefaults } from '../cpu-resources';
import { configurationUpgradePayload, supportsCpuResourceUpgrade } from '../service-upgrade';
import { ServiceUpgradeForm } from '../components/ServiceUpgradeForm';

const fields = {
  imageUuid: { type: 'string', create: true },
  ports: { type: 'array[string]', create: true },
  dataVolumes: { type: 'array[string]', create: true },
  memory: { type: 'int', create: true },
  environment: { type: 'map[string]', create: true },
  privileged: { type: 'boolean', create: true },
  ...Object.fromEntries(
    Object.keys(cpuFields).map((name) => [
      name,
      { type: name === 'cpuSet' ? 'string' : 'int', create: true },
    ]),
  ),
};
const schemas = {
  ...contract.schemas,
  launchConfig: { id: 'launchConfig', resourceFields: fields, links: {} },
} as unknown as Record<string, Schema>;
const current = {
  id: 's1',
  type: 'service',
  accountId: 'p1',
  stackId: 'st1',
  state: 'active',
  actions: { upgrade: '/upgrade' },
  links: {},
  launchConfig: {
    imageUuid: 'docker:alpine:3.20',
    cpuShares: 512,
    cpuPeriod: 100000,
    cpuQuota: 50000,
    cpuSet: '0',
    blkioWeight: 100,
    milliCpuReservation: 0,
    ports: ['8080:80'],
    dataVolumes: ['store:/data'],
    memory: 134217728,
    environment: { MODE: 'preserved' },
    privileged: false,
  },
} as Resource;
const cpu = cpuResourceDefaults(current.launchConfig as Record<string, unknown>);
const draft = {
  image: 'alpine:3.20',
  batchSize: '1',
  intervalMillis: '100',
  startFirst: false,
  editCpuResources: true,
  cpuResources: { ...cpu, cpuQuota: 25000 },
};

describe('Upgrade contextual de CPU e I/O', () => {
  it('modifica CPU na mesma imagem e preserva memória segurança portas volumes e variáveis', () => {
    expect(configurationUpgradePayload(current, current, draft, schemas)).toMatchObject({
      inServiceStrategy: { launchConfig: { ...(current.launchConfig as object), cpuQuota: 25000 } },
    });
    expect(current.launchConfig).toHaveProperty('cpuQuota', 50000);
  });
  it('recusa contrato incompleto, campos extras e quota inválida', () => {
    const missing = {
      ...schemas,
      launchConfig: {
        ...schemas.launchConfig,
        resourceFields: { ...fields, cpuQuota: { type: 'int', create: false } },
      },
    };
    expect(supportsCpuResourceUpgrade(current, missing)).toBe(false);
    expect(() => configurationUpgradePayload(current, current, draft, missing)).toThrow();
    for (const patch of [
      { ...cpu, cpuQuota: 999 },
      { ...cpu, readOnly: true },
      { ...cpu, cpuShares: undefined },
    ])
      expect(() =>
        configurationUpgradePayload(current, current, { ...draft, cpuResources: patch }, schemas),
      ).toThrow();
  });
  it('recusa ausência de mudança e conflito em outra opção do serviço', () => {
    expect(() =>
      configurationUpgradePayload(current, current, { ...draft, cpuResources: cpu }, schemas),
    ).toThrow('Altere');
    const changed = {
      ...current,
      launchConfig: { ...(current.launchConfig as object), memory: 268435456 },
    };
    expect(() => configurationUpgradePayload(current, changed, draft, schemas)).toThrow(
      'outro cliente',
    );
  });
  it('permite retirar seleção de CPU e reserva com valores explícitos sem apagar memória', () => {
    expect(
      configurationUpgradePayload(
        current,
        current,
        { ...draft, cpuResources: { ...cpu, cpuSet: '', cpuQuota: -1, milliCpuReservation: 0 } },
        schemas,
      ),
    ).toMatchObject({
      inServiceStrategy: {
        launchConfig: { cpuSet: '', cpuQuota: -1, milliCpuReservation: 0, memory: 134217728 },
      },
    });
  });
  it('exige revisão para CPU e flag off remove opt-in', async () => {
    const user = userEvent.setup(),
      submit = vi.fn();
    const view = render(
      <>
        <ServiceUpgradeForm
          resource={current}
          schemas={schemas}
          resourcesEnabled
          onSubmit={submit}
          onDirtyChange={vi.fn()}
          busy={false}
          error={null}
        />
        <button type="submit" form="workspace-resource-form">
          Revisar CPU
        </button>
      </>,
    );
    await user.click(screen.getByLabelText('Editar CPU e I/O nesta atualização'));
    await user.clear(screen.getByLabelText('Quota de CPU (µs)'));
    await user.type(screen.getByLabelText('Quota de CPU (µs)'), '25000');
    await user.click(screen.getByRole('button', { name: 'Revisar CPU' }));
    expect(submit).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: /^Confirmar$/ }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        editCpuResources: true,
        cpuResources: { ...cpu, cpuQuota: 25000 },
      }),
    );
    view.unmount();
    render(
      <ServiceUpgradeForm
        resource={current}
        schemas={schemas}
        onSubmit={submit}
        onDirtyChange={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    expect(screen.queryByLabelText('Editar CPU e I/O nesta atualização')).not.toBeInTheDocument();
  });
});
