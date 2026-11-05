import { useEffect, useState } from 'react';

export function useSidebarPreference(identity: string) {
  const key = `rancher.console.sidebar.${identity}`;
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const tablet = matchMedia('(min-width: 768px) and (max-width: 1279px)');
    function restore() {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || 'null');
        setCollapsed(typeof stored?.collapsed === 'boolean' ? stored.collapsed : tablet.matches);
      } catch {
        setCollapsed(tablet.matches);
      }
    }
    restore();
    tablet.addEventListener('change', restore);
    return () => tablet.removeEventListener('change', restore);
  }, [key]);
  function toggle() {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(key, JSON.stringify({ version: 1, collapsed: next }));
      } catch {
        /* In-memory navigation remains usable. */
      }
      return next;
    });
  }
  return { collapsed, toggle };
}
