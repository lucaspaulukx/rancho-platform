import { useEffect, useRef } from 'react';
import type { Resource } from '../api';
import { useApp } from '../state';

export function useActionScope() {
  const app = useApp();
  const environment = app.project?.id;
  const key = `${app.identity}:${environment || ''}`;
  const current = useRef(key);
  const generation = useRef(0);
  if (current.current !== key) generation.current += 1;
  current.current = key;
  const version = generation.current;
  const alive = useRef(true);
  const controller = useRef(new AbortController());
  useEffect(() => {
    alive.current = true;
    if (controller.current.signal.aborted) controller.current = new AbortController();
    return () => {
      alive.current = false;
      controller.current.abort();
    };
  }, []);
  function assertCurrent() {
    if (
      !environment ||
      !alive.current ||
      current.current !== key ||
      generation.current !== version ||
      controller.current.signal.aborted
    )
      throw new Error('O contexto mudou. Reabra o painel antes de continuar.');
  }
  return {
    environment,
    assertCurrent,
    signal: () => {
      assertCurrent();
      return AbortSignal.any([controller.current.signal, AbortSignal.timeout(20_000)]);
    },
    resource: (actual: Resource, expected: Resource) => {
      assertCurrent();
      if (
        actual.id !== expected.id ||
        actual.type !== expected.type ||
        actual.accountId !== environment ||
        actual.removed
      )
        throw new Error('O recurso não está disponível neste environment.');
    },
  };
}
