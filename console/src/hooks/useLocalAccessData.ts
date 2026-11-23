import { useQuery } from '@tanstack/react-query';
import { allPages, type Account, type Group, type Project } from '../api';
import { useApp } from '../state';

export function useLocalAccessData() {
  const app = useApp();
  const groupsEnabled = app.config.modules.groups && app.server.effective.LOCAL_RBAC_ENABLED;
  return useQuery({
    queryKey: ['data', app.identity, 'access', groupsEnabled],
    queryFn: async ({ signal }) => {
      const [groups, users, projects] = await Promise.all([
        groupsEnabled ? allPages<Group>('localGroups', signal) : Promise.resolve([] as Group[]),
        allPages<Account>('accounts?limit=100', signal),
        allPages<Project>('projects?all=true&limit=100', signal),
      ]);
      return {
        groups,
        groupsEnabled,
        users: users.filter((user) => ['user', 'admin'].includes(user.kind) && !user.removed),
        projects: projects.filter((project) => !project.removed),
      };
    },
    refetchInterval: (query) =>
      query.state.data?.users.some(
        (user) => !['active', 'inactive', 'removed', 'purged'].includes(user.state),
      )
        ? 1500
        : false,
  });
}
