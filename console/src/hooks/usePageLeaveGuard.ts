import { useEffect } from 'react';

/** A browser-owned warning, not persistence or a guarantee against process termination. */
export function usePageLeaveGuard(active: boolean, enabled = true) {
  useEffect(() => {
    if (!active || !enabled) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [active, enabled]);
}
