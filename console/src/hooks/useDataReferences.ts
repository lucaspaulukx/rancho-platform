import { useQuery } from '@tanstack/react-query';
import { allPages, type Resource, type Schema } from '../api';
import { useDataKey } from '../state';
import { dataResourceMetadata } from '../data-resources';
export function useDataReferences(enabled: boolean, schemas: Record<string, Schema>) {
  return useQuery({
    queryKey: useDataKey('data-references'),
    enabled,
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      Object.fromEntries(
        await Promise.all(
          ['host', 'stack', 'storageDriver'].map(async (type) => {
            const collection = schemas[type]?.links.collection;
            const values = collection
              ? (await allPages<Resource>(collection, signal))
                  .filter(
                    (value) => !value.removed && !['removed', 'purged'].includes(value.state || ''),
                  )
                  .map(dataResourceMetadata)
              : [];
            return [
              type,
              values.map((value) => ({
                ...value,
                name:
                  value.name || (typeof value.hostname === 'string' ? value.hostname : value.id),
              })),
            ];
          }),
        ),
      ),
  });
}
