import { describe, expect, it } from 'vitest';
import type { Resource } from '../api';
import { safeConfiguration } from '../components/ResourceDetails';
import {
  activeResources,
  containerStack,
  containersForService,
  imageName,
  stackContents,
} from '../workloads';
const resource = (id: string, extra: Record<string, unknown> = {}): Resource => ({
  id,
  type: 'service',
  links: {},
  ...extra,
});
describe('Vínculos operacionais dentro de um environment', () => {
  it('protege segredos aninhados e URLs de ações na configuração exibida', () => {
    expect(
      safeConfiguration({
        launchConfig: {
          environment: { API_TOKEN: 'sensitive', USER: 'fixture' },
          registryCredentialId: 'credential-id',
        },
        links: { self: 'private-url' },
        actions: { logs: 'private-action' },
      }),
    ).toEqual({
      launchConfig: {
        environment: { API_TOKEN: '[protegido]', USER: 'fixture' },
        registryCredentialId: '[protegido]',
      },
    });
  });
  const stacks = [resource('s1'), resource('s2')];
  const services = [resource('web', { stackId: 's1' }), resource('db', { stackId: 's2' })];
  const containers = [
    resource('c1', { serviceIds: ['web'] }),
    resource('c2', { serviceIds: ['db'] }),
    resource('standalone'),
    resource('multi', { serviceIds: ['web', 'db'] }),
  ];
  const inventory = { stacks, services, containers };
  it('não mistura containers de stacks diferentes nem inclui avulsos', () => {
    expect(stackContents(stacks[0], inventory).containers.map((c) => c.id)).toEqual([
      'c1',
      'multi',
    ]);
    expect(stackContents(stacks[1], inventory).services.map((s) => s.id)).toEqual(['db']);
  });
  it('usa serviceIds sem duplicar containers com mais de um vínculo', () => {
    expect(containersForService(services[0], containers).map((c) => c.id)).toEqual(['c1', 'multi']);
    expect(
      stackContents(resource('s3', { serviceIds: ['web', 'db'] }), inventory).containers.map(
        (c) => c.id,
      ),
    ).toEqual(['c1', 'c2', 'multi']);
  });
  it('resolve a stack pelos vínculos reais e preserva avulsos', () => {
    expect(containerStack(containers[0], inventory)?.id).toBe('s1');
    expect(containerStack(containers[2], inventory)).toBeUndefined();
  });
  it('omite removidos e mantém recursos parados e em erro', () => {
    expect(
      activeResources([
        resource('removed', { removed: 'today' }),
        resource('purged', { state: 'purged' }),
        resource('stopped', { state: 'stopped' }),
        resource('error', { state: 'error' }),
      ]).map((r) => r.id),
    ).toEqual(['stopped', 'error']);
  });
  it('extrai imagem de container e configuração de serviço', () => {
    expect(imageName(resource('c', { imageUuid: 'docker:alpine:3.23' }))).toBe('alpine:3.23');
    expect(imageName(resource('s', { launchConfig: { imageUuid: 'docker:nginx:alpine' } }))).toBe(
      'nginx:alpine',
    );
  });
});
