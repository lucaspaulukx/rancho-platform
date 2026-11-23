import { useQuery } from '@tanstack/react-query';
import { allPages, type Schema } from '../api';
import { useApp } from '../state';

export function useSchemas(scoped: boolean) {
  const app = useApp();
  const base = scoped ? `projects/${app.project?.id}/` : '';
  return useQuery({
    queryKey: ['data', app.identity, 'schemas', scoped ? app.project?.id : 'global'],
    queryFn: async ({ signal }) =>
      Object.fromEntries(
        (await allPages<Schema>(`${base}schemas`, signal)).map((schema) => [schema.id, schema]),
      ),
    enabled: !scoped || !!app.project,
    staleTime: 30_000,
  });
}
export function canManageResource(schema?: Schema) {
  return !!schema?.resourceMethods?.some((method) => ['PUT', 'POST', 'DELETE'].includes(method));
}
