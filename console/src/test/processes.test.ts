import { describe, expect, it } from 'vitest';
import {
  processMetadata,
  processQuery,
  processNext,
  processReplayTarget,
  prepareReplay,
} from '../processes';
import type { Resource, Schema } from '../api';
const row = processMetadata({
  id: '1pi1',
  type: 'processInstance',
  links: { self: '/v2-beta/processinstances/1pi1' },
  actions: { replay: '/v2-beta/processinstances/1pi1/?action=replay' },
  processName: 'credential.update',
  resourceType: 'credential',
  resourceId: '1c1',
  phase: 'DONE',
  executionCount: 1,
  startTime: '2026-10-22T12:00:00Z',
  endTime: '2026-10-22T12:00:01Z',
  exitReason: 'DONE',
});
const schema: Schema = {
  id: 'processInstance',
  pluralName: 'processInstances',
  links: {},
  resourceFields: {},
  resourceMethods: ['GET'],
  resourceActions: { replay: {} },
};
describe('Processos administrativos', () => {
  it('DTO exclui data, result e campos desconhecidos antes do cache e limita links/actions', () => {
    const value = processMetadata({
      ...row,
      type: 'processInstance',
      data: { secret: 'private' },
      result: 'private',
      actions: { ...row.actions, export: '/private' },
      other: 'private',
    } as Resource);
    expect(JSON.stringify(value)).not.toContain('private');
    expect(value).not.toHaveProperty('data');
    expect(value).not.toHaveProperty('result');
    expect(value.actions).toEqual(row.actions);
  });
  it('rejeita valores inválidos sem exibir payload em campos identificadores', () => {
    const value = processMetadata({
      id: '1pi2',
      type: 'processInstance',
      links: {},
      processName: '<script>private',
      executionCount: -1,
      startTime: 'private',
    });
    expect(value.processName).toBe('');
    expect(value.executionCount).toBe(null);
    expect(value.startTime).toBe('');
  });
  it.each(['running', 'waiting', 'completed', 'all'] as const)(
    'filtra %s e limita página sem carregar histórico',
    (state) => {
      const url = new URL(
        processQuery({ state, process: 'credential.update', resource: 'credential', id: '1c1' }),
        location.origin,
      );
      expect(url.searchParams.get('limit')).toBe('100');
      expect(url.searchParams.get('resourceId')).toBe('1c1');
      if (state === 'running')
        expect(url.searchParams.get('runningProcessServerId_notnull')).toBe('true');
      if (state === 'waiting')
        expect(url.searchParams.get('runningProcessServerId_null')).toBe('true');
      if (state === 'completed') expect(url.searchParams.get('endTime_notnull')).toBe('true');
    },
  );
  it('não aceita filtros arbitrários nem cursores para outra API/origem', () => {
    expect(() =>
      processQuery({ state: 'all', process: 'x?secret=private', resource: '', id: '' }),
    ).toThrow();
    for (const path of [
      '/v2-beta/apikeys',
      'https://untrusted.example/v2-beta/processinstances',
      {},
    ])
      expect(() => processNext(path)).toThrow();
    expect(processNext('/v2-beta/processinstances?marker=1')).toContain('marker=1');
    expect(processNext(null)).toBe(null);
  });
  it('replay anunciado usa action nativa mesmo com resourceMethods somente GET', () => {
    expect(processReplayTarget(schema, row)).toBe('/v2-beta/processinstances/1pi1/?action=replay');
    expect(processReplayTarget({ ...schema, resourceActions: {} }, row)).toBeUndefined();
  });
  it('não segue replay para outro processo, operação, origem nem action com input não suportado', () => {
    for (const replay of [
      '/v2-beta/processinstances/1pi2?action=replay',
      '/v2-beta/processinstances/1pi1?action=remove',
      '/v2-beta/processinstances/1pi1?action=replay&token=private',
      'https://untrusted.example/v2-beta/processinstances/1pi1?action=replay',
    ])
      expect(processReplayTarget(schema, { ...row, actions: { replay } })).toBeUndefined();
    expect(
      processReplayTarget(
        { ...schema, resourceActions: { replay: { input: 'unsupported' } } },
        row,
      ),
    ).toBeUndefined();
  });
  it('revalida identidade do recurso, estado e contagem antes do replay e recusa concorrência', () => {
    expect(prepareReplay(schema, row, row)).toContain('action=replay');
    for (const delta of [
      { resourceId: '1c2' },
      { executionCount: 2 },
      { phase: 'STARTED' },
      { runAfter: '2026-10-23T00:00:00.000Z' },
    ])
      expect(() => prepareReplay(schema, row, { ...row, ...delta })).toThrow('mudou');
  });
});
