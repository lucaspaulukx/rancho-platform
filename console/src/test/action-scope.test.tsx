import { StrictMode } from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Resource } from '../api';
import { useActionScope } from '../hooks/useActionScope';

const state = vi.hoisted(() => ({ identity: 'admin', project: { id: 'p1' } }));
vi.mock('../state', () => ({ useApp: () => state }));
const resource = { id: 'c1', type: 'container', accountId: 'p1', links: {} } as Resource;
describe('Escopo de operações assíncronas', () => {
  beforeEach(() => {
    state.identity = 'admin';
    state.project = { id: 'p1' };
  });
  it('invalida callbacks antigos mesmo ao voltar ao environment original', () => {
    const { result, rerender } = renderHook(() => useActionScope());
    const original = result.current;
    state.project = { id: 'p2' };
    rerender();
    expect(() => original.assertCurrent()).toThrow('contexto mudou');
    state.project = { id: 'p1' };
    rerender();
    expect(() => original.assertCurrent()).toThrow('contexto mudou');
    expect(() => result.current.assertCurrent()).not.toThrow();
  });
  it('recusa resposta atrasada após trocar identidade ou desmontar', () => {
    const { result, rerender, unmount } = renderHook(() => useActionScope());
    const original = result.current;
    state.identity = 'reader';
    rerender();
    expect(() => original.resource(resource, resource)).toThrow('contexto mudou');
    const latest = result.current;
    const signal = latest.signal();
    unmount();
    expect(signal.aborted).toBe(true);
    expect(() => latest.assertCurrent()).toThrow('contexto mudou');
  });
  it('valida ID, tipo, environment e remoção antes de autorizar continuação', () => {
    const { result } = renderHook(() => useActionScope(), { wrapper: StrictMode });
    expect(() => result.current.resource(resource, resource)).not.toThrow();
    for (const change of [
      { id: 'c2' },
      { type: 'service' },
      { accountId: 'p2' },
      { removed: '2026-10-21' },
    ])
      expect(() => result.current.resource({ ...resource, ...change }, resource)).toThrow(
        'não está disponível',
      );
  });
});
