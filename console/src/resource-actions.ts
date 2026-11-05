// Cattle exposes internal state-machine transitions alongside user operations.
// The native UI uses PUT for editing and dedicated viewers for socket/proxy output.
const internalActions = new Set([
  'create',
  'update',
  'error',
  'provision',
  'allocate',
  'deallocate',
  'defaultnetworkid',
  'delete',
  'dockersocket',
  'proxy',
]);
export const isUserAction = (name: string) => !internalActions.has(name.toLowerCase());
