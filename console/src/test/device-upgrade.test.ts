import { describe, expect, it } from 'vitest';
import type { Resource, Schema } from '../api';
import { configurationUpgradePayload } from '../service-upgrade';
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

describe('Device upgrade contract', () => {
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
});
