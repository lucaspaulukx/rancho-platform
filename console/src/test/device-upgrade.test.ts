import { describe, expect, it } from 'vitest';
import type { Resource, Schema } from '../api';
import {
  configurationUpgradePayload,
  editableSidecars,
  supportsSidecarDeviceUpgrade,
} from '../service-upgrade';
import contract from './fixtures/upgrade-schema.json';

const baseline = '/dev/null:/dev/rancho-null-base:r';
const replacement = '/dev/null:/dev/rancho-null-upgrade:r';
const fields = {
  imageUuid: { type: 'string', create: true },
  name: { type: 'string', create: true },
  environment: { type: 'map[string]', create: true },
  devices: { type: 'array[string]', create: true },
};
const schemas = {
  ...contract.schemas,
  launchConfig: { id: 'launchConfig', links: {}, resourceFields: fields },
  secondaryLaunchConfig: { id: 'secondaryLaunchConfig', links: {}, resourceFields: fields },
} as unknown as Record<string, Schema>;
const service: Resource = {
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
    devices: [baseline],
  },
  secondaryLaunchConfigs: [
    { name: 'helper', imageUuid: 'docker:alpine:3.20', devices: ['/dev/null:/dev/helper:wr'] },
  ],
};
const draft = {
  image: 'alpine:3.20',
  batchSize: '1',
  intervalMillis: '100',
  startFirst: false,
  editDevices: true,
  devices: [replacement],
};
const sidecarDraft = {
  ...draft,
  editDevices: false,
  editSidecars: true,
  editSidecarDevices: true,
  secondaryLaunchConfigs: [
    { name: 'helper', imageUuid: 'docker:alpine:3.20', devices: [replacement] },
  ],
};

describe('Device upgrade contract', () => {
  it.each([{ devices: [replacement] }, { devices: [] }])(
    'edits sidecar mappings explicitly while preserving primary (%j)',
    ({ devices }) => {
      const input = {
        ...sidecarDraft,
        secondaryLaunchConfigs: [{ ...sidecarDraft.secondaryLaunchConfigs[0], devices }],
      };
      const original = structuredClone(service);
      expect(supportsSidecarDeviceUpgrade(service, schemas)).toBe(true);
      expect(configurationUpgradePayload(service, service, input, schemas)).toMatchObject({
        inServiceStrategy: {
          launchConfig: service.launchConfig,
          secondaryLaunchConfigs: input.secondaryLaunchConfigs,
        },
      });
      expect(service).toEqual(original);
    },
  );

  it('supports combined primary edits, new helpers, reordered helpers and deliberate removal', () => {
    const secondaryLaunchConfigs = [
      {
        name: 'new-helper',
        imageUuid: 'docker:alpine:3.20',
        devices: ['/dev/zero:/dev/other:rwm'],
      },
      ...sidecarDraft.secondaryLaunchConfigs,
    ];
    expect(
      configurationUpgradePayload(
        service,
        service,
        { ...sidecarDraft, ...draft, secondaryLaunchConfigs },
        schemas,
      ),
    ).toMatchObject({
      inServiceStrategy: { launchConfig: { devices: [replacement] }, secondaryLaunchConfigs },
    });
    expect(
      configurationUpgradePayload(
        service,
        service,
        { ...sidecarDraft, secondaryLaunchConfigs: [] },
        schemas,
      ),
    ).toMatchObject({
      inServiceStrategy: {
        secondaryLaunchConfigs: [{ name: 'helper', imageUuid: 'rancher/none' }],
      },
    });
  });

  it('preserves unchanged opaque mappings, but validates deliberately changed and new mappings', () => {
    const opaque = {
      ...service,
      secondaryLaunchConfigs: [
        { name: 'helper', imageUuid: 'docker:alpine:3.20', devices: ['native-opaque'] },
      ],
    };
    const input = {
      ...sidecarDraft,
      secondaryLaunchConfigs: [
        { ...opaque.secondaryLaunchConfigs[0], environment: { UPDATED: 'yes' } },
      ],
    };
    expect(configurationUpgradePayload(opaque, opaque, input, schemas)).toMatchObject({
      inServiceStrategy: { secondaryLaunchConfigs: input.secondaryLaunchConfigs },
    });
    for (const devices of [
      ['native-opaque'],
      ['/dev/null:/dev/x:rr'],
      ['/dev/null:/dev/x:r', '/dev/zero:/dev/x:w'],
    ])
      expect(() =>
        configurationUpgradePayload(
          service,
          service,
          {
            ...sidecarDraft,
            secondaryLaunchConfigs: [{ ...sidecarDraft.secondaryLaunchConfigs[0], devices }],
          },
          schemas,
        ),
      ).toThrow();
    expect(() =>
      configurationUpgradePayload(
        service,
        service,
        {
          ...sidecarDraft,
          secondaryLaunchConfigs: [{ name: 'helper', imageUuid: 'docker:alpine:3.20' }],
        },
        schemas,
      ),
    ).toThrow(expect.objectContaining({ key: 'deviceUpgrade.error.unavailable' }));
  });

  it('rejects missing opt-in, sidecar-only no-op and fresh snapshot conflict', () => {
    expect(() =>
      configurationUpgradePayload(
        service,
        service,
        { ...sidecarDraft, editSidecars: false },
        schemas,
      ),
    ).toThrow(expect.objectContaining({ key: 'deviceUpgrade.error.unavailable' }));
    expect(() =>
      configurationUpgradePayload(
        service,
        service,
        { ...sidecarDraft, secondaryLaunchConfigs: service.secondaryLaunchConfigs },
        schemas,
      ),
    ).toThrow(expect.objectContaining({ key: 'deviceUpgrade.error.noChange' }));
    expect(() =>
      configurationUpgradePayload(
        service,
        { ...service, secondaryLaunchConfigs: [] },
        sidecarDraft,
        schemas,
      ),
    ).toThrow(expect.objectContaining({ key: 'deviceUpgrade.error.conflict' }));
  });

  it.each([
    undefined,
    { type: 'array[string]', create: false },
    { type: 'array[int]', create: true },
  ])('retains draft data and rejects unavailable fresh sidecar devices (%j)', (devices) => {
    const changed = {
      ...schemas,
      secondaryLaunchConfig: {
        ...schemas.secondaryLaunchConfig,
        resourceFields: { ...fields, devices },
      },
    } as unknown as Record<string, Schema>;
    if (!devices) delete changed.secondaryLaunchConfig.resourceFields.devices;
    expect(editableSidecars(service, changed)[0].devices).toEqual(
      (service.secondaryLaunchConfigs as Record<string, unknown>[])[0].devices,
    );
    expect(supportsSidecarDeviceUpgrade(service, changed)).toBe(false);
    expect(() => configurationUpgradePayload(service, service, sidecarDraft, changed)).toThrow(
      expect.objectContaining({ key: 'deviceUpgrade.error.unavailable' }),
    );
  });

  it('rejects a fresh primary schema that would silently lose untouched mappings', () => {
    const { devices: _devices, ...withoutDevices } = fields;
    const changed = {
      ...schemas,
      launchConfig: { ...schemas.launchConfig, resourceFields: withoutDevices },
    };
    expect(() => configurationUpgradePayload(service, service, sidecarDraft, changed)).toThrow(
      expect.objectContaining({ key: 'deviceUpgrade.error.unavailable' }),
    );
  });

  it.each([{ devices: [replacement] }, { devices: [] }])(
    'updates only explicitly selected primary devices ($devices)',
    ({ devices }) => {
      const original = structuredClone(service);
      expect(
        configurationUpgradePayload(service, service, { ...draft, devices }, schemas),
      ).toMatchObject({
        inServiceStrategy: {
          launchConfig: { ...(service.launchConfig as object), devices },
          secondaryLaunchConfigs: service.secondaryLaunchConfigs,
        },
      });
      expect(service).toEqual(original);
    },
  );

  it('rejects an unchanged mapping, a missing contract and fresh sidecar drift', () => {
    expect(() =>
      configurationUpgradePayload(service, service, { ...draft, devices: [baseline] }, schemas),
    ).toThrow(expect.objectContaining({ key: 'deviceUpgrade.error.noChange' }));
    const changedContract = {
      ...schemas,
      launchConfig: {
        ...schemas.launchConfig,
        resourceFields: { ...fields, devices: { ...fields.devices, create: false } },
      },
    };
    expect(() => configurationUpgradePayload(service, service, draft, changedContract)).toThrow(
      expect.objectContaining({ key: 'deviceUpgrade.error.unavailable' }),
    );
    expect(() =>
      configurationUpgradePayload(
        service,
        { ...service, secondaryLaunchConfigs: [] },
        draft,
        schemas,
      ),
    ).toThrow(expect.objectContaining({ key: 'deviceUpgrade.error.conflict' }));
  });

  it('rejects a primary-only change when the current serializer would remove a sidecar mapping', () => {
    const { devices: _devices, ...withoutDevices } = fields;
    const changed = {
      ...schemas,
      secondaryLaunchConfig: {
        ...schemas.secondaryLaunchConfig,
        resourceFields: withoutDevices,
      },
    };
    expect(() => configurationUpgradePayload(service, service, draft, changed)).toThrow(
      expect.objectContaining({ key: 'deviceUpgrade.error.unavailable' }),
    );
  });
});
