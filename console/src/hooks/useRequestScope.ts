import { useEffect, useRef } from 'react';
/** A generation boundary for account-global or environment-scoped private operations. */
export function useRequestScope(key: string) {
  const current = useRef({ key, alive: true, controller: new AbortController() });
  if (current.current.key !== key)
    current.current = { key, alive: true, controller: new AbortController() };
  const snapshot = current.current;
  useEffect(() => {
    snapshot.alive = true;
    if (snapshot.controller.signal.aborted) snapshot.controller = new AbortController();
    return () => {
      snapshot.alive = false;
      snapshot.controller.abort();
    };
  }, [snapshot]);
  function assertCurrent() {
    if (current.current !== snapshot || !snapshot.alive || snapshot.controller.signal.aborted)
      throw new Error('O contexto mudou. Reabra o painel antes de continuar.');
  }
  return {
    assertCurrent,
    signal: () => {
      assertCurrent();
      return AbortSignal.any([snapshot.controller.signal, AbortSignal.timeout(20000)]);
    },
  };
}
