import { useState } from 'react';
import { logout } from '../api';
import { useApp } from '../state';

export function useLogout() {
  const app = useApp();
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    try {
      await logout(app.server?.effective.OIDC_FEDERATED_LOGOUT_ENABLED === true);
    } finally {
      setPending(false);
    }
  }
  return { pending, signOut };
}
