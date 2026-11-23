import { StrictMode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRequestScope } from '../hooks/useRequestScope';
describe('Escopo global e por environment de operações privadas', () => {
  it('aborta sinal e recusa commit após unmount', () => {
    const view = renderHook(() => useRequestScope('admin:account'));
    const scope = view.result.current,
      signal = scope.signal();
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(() => scope.assertCurrent()).toThrow('contexto mudou');
  });
  it('A→B→A não torna um snapshot antigo válido novamente', () => {
    const view = renderHook(({ scope }) => useRequestScope(scope), {
      initialProps: { scope: 'actor:1a12' },
    });
    const original = view.result.current;
    view.rerender({ scope: 'actor:1a8' });
    view.rerender({ scope: 'actor:1a12' });
    expect(() => original.assertCurrent()).toThrow();
    expect(() => view.result.current.assertCurrent()).not.toThrow();
  });
  it('trocar identidade invalida credenciais mesmo no mesmo environment', () => {
    const view = renderHook(({ scope }) => useRequestScope(scope), {
      initialProps: { scope: 'admin:1a12' },
    });
    const original = view.result.current;
    view.rerender({ scope: 'reader:1a12' });
    expect(() => original.signal()).toThrow();
  });
  it('StrictMode deixa o snapshot ativo com sinal utilizável', () => {
    const view = renderHook(() => useRequestScope('actor:account'), { wrapper: StrictMode });
    expect(view.result.current.signal().aborted).toBe(false);
  });
});
