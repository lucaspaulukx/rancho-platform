import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import contract from './fixtures/upgrade-schema.json';
import type { Resource, Schema } from '../api';
import {
  configurationUpgradePayload,
  supportsUlimitUpgrade,
  imageUpgradePayload,
} from '../service-upgrade';
import { editableUlimits } from '../workload-ulimits';
import { ServiceUpgradeForm } from '../components/ServiceUpgradeForm';
import config from '../../public/console-config.json';
import { validateConfig } from '../config';

const fields = {
  imageUuid: { type: 'string', create: true },
  name: { type: 'string', create: true },
  environment: { type: 'map[string]', create: true },
  memory: { type: 'long', create: true },
  ulimits: { type: 'array[ulimit]', create: true },
};
const schemas = {
  ...contract.schemas,
  launchConfig: { id: 'launchConfig', links: {}, resourceFields: fields },
  secondaryLaunchConfig: { id: 'secondaryLaunchConfig', links: {}, resourceFields: fields },
  ulimit: {
    id: 'ulimit',
    links: {},
    resourceFields: {
      name: { type: 'string', create: true },
      soft: { type: 'int', create: true },
      hard: { type: 'int', create: true },
    },
  },
} as unknown as Record<string, Schema>;
const current = {
  id: '1s1',
  type: 'service',
  accountId: '1a12',
  stackId: '1st1',
  state: 'active',
  actions: { upgrade: '/upgrade' },
  links: {},
  launchConfig: {
    imageUuid: 'docker:alpine:3.20',
    environment: { MODE: 'preserved' },
    memory: 134217728,
    ulimits: [{ type: 'ulimit', name: 'nofile', soft: 1024, hard: 2048 }],
  },
  secondaryLaunchConfigs: [
    {
      name: 'helper',
      imageUuid: 'docker:alpine:3.20',
      ulimits: [{ name: 'nofile', soft: 128, hard: 256 }],
    },
  ],
} as unknown as Resource;
const draft = {
  image: 'alpine:3.20',
  batchSize: '1',
  intervalMillis: '100',
  startFirst: false,
  editUlimits: true,
  ulimits: [{ name: 'nofile', soft: 2048, hard: 4096 }],
};
describe('Contextual service process-limit upgrade', () => {
  it('changes only primary limits while preserving image, memory, environment and sidecars', () => {
    const before = JSON.stringify(current);
    expect(configurationUpgradePayload(current, current, draft, schemas)).toMatchObject({
      inServiceStrategy: {
        launchConfig: {
          imageUuid: 'docker:alpine:3.20',
          memory: 134217728,
          environment: { MODE: 'preserved' },
          ulimits: draft.ulimits,
        },
        secondaryLaunchConfigs: current.secondaryLaunchConfigs,
      },
    });
    expect(JSON.stringify(current)).toBe(before);
  });
  it('rejects revoked contract, concurrent changes, invalid values and no-op', () => {
    const revoked = { ...schemas, ulimit: { ...schemas.ulimit, resourceFields: {} } };
    expect(supportsUlimitUpgrade(current, revoked)).toBe(false);
    expect(() => configurationUpgradePayload(current, current, draft, revoked)).toThrow();
    const fresh = {
      ...current,
      launchConfig: { ...(current.launchConfig as object), memory: 268435456 },
    };
    expect(() => configurationUpgradePayload(current, fresh, draft, schemas)).toThrow(
      'outro cliente',
    );
    expect(() =>
      configurationUpgradePayload(
        current,
        current,
        { ...draft, ulimits: [{ name: 'nofile', soft: 5, hard: 3 }] },
        schemas,
      ),
    ).toThrow();
    expect(() =>
      configurationUpgradePayload(
        current,
        current,
        {
          ...draft,
          ulimits: editableUlimits((current.launchConfig as Record<string, unknown>).ulimits),
        },
        schemas,
      ),
    ).toThrow('Altere');
  });
  it('keeps an explicit empty reset and unlimited values without changing sidecars', () => {
    for (const ulimits of [[], [{ name: 'nofile', soft: -1, hard: -1 }]])
      expect(
        configurationUpgradePayload(current, current, { ...draft, ulimits }, schemas),
      ).toMatchObject({
        inServiceStrategy: {
          launchConfig: { ulimits },
          secondaryLaunchConfigs: current.secondaryLaunchConfigs,
        },
      });
  });
  it('image-only upgrade preserves existing process limits instead of applying an unselected draft', () => {
    expect(
      imageUpgradePayload(
        current,
        { ...draft, image: 'alpine:3.21', editUlimits: false, ulimits: [] },
        schemas,
      ),
    ).toMatchObject({
      inServiceStrategy: {
        launchConfig: { ulimits: [{ name: 'nofile', soft: 1024, hard: 2048 }] },
      },
    });
  });
  it('projects only the known native discriminator and preserves incompatible data', () => {
    expect(editableUlimits([{ type: 'ulimit', name: 'nofile', soft: 1, hard: 2 }])).toEqual([
      { name: 'nofile', soft: 1, hard: 2 },
    ]);
    const unknown = [{ type: 'future', name: 'nofile', soft: 1, hard: 2, extra: 'keep' }];
    expect(editableUlimits(unknown)).toEqual(unknown);
  });
  it('defaults upgrade off independently of the creation editor', () => {
    expect(validateConfig(config).modules.workloadUlimitUpgrades).toBe(false);
    expect(
      validateConfig({
        ...config,
        modules: { ...config.modules, workloadUlimitEditors: false, workloadUlimitUpgrades: true },
      }).modules.workloadUlimitUpgrades,
    ).toBe(true);
    expect(() =>
      validateConfig({ ...config, modules: { ...config.modules, workloadUlimitUpgrades: 'true' } }),
    ).toThrow();
  });
  it('requires explicit opt-in and confirmation; off hides the editor', async () => {
    const user = userEvent.setup(),
      submit = vi.fn();
    const view = render(
      <>
        <ServiceUpgradeForm
          resource={current}
          schemas={schemas}
          ulimitsEnabled
          onSubmit={submit}
          onDirtyChange={vi.fn()}
          busy={false}
          error={null}
        />
        <button type="submit" form="workspace-resource-form">
          Revisar limites
        </button>
      </>,
    );
    expect(screen.queryByLabelText('Limite inicial 1')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Editar limites de processo nesta atualização'));
    await user.clear(screen.getByLabelText('Limite máximo 1'));
    await user.type(screen.getByLabelText('Limite máximo 1'), '4096');
    await user.click(screen.getByRole('button', { name: 'Revisar limites' }));
    expect(submit).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: /^Confirmar$/ }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        editUlimits: true,
        ulimits: [{ name: 'nofile', soft: 1024, hard: '4096' }],
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
    expect(
      screen.queryByLabelText('Editar limites de processo nesta atualização'),
    ).not.toBeInTheDocument();
  });
});
