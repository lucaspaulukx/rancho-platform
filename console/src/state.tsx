import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  allPages,
  api,
  ApiError,
  sessionUnauthorizedEvent,
  type Collection,
  type Project,
  type Token,
} from './api';
import { loadConfig, type ConsoleConfig, type ServerConfig } from './config';
import { ErrorState, Loading } from './components/ui';
import { ThemeProvider } from './theme';

interface AppState {
  config: ConsoleConfig;
  server: ServerConfig;
  token: Token;
  authenticated: boolean;
  admin: boolean;
  identity: string;
  projects: Project[];
  project?: Project;
  setProject: (id: string) => void;
  refresh: () => Promise<unknown>;
}
const AppContext = createContext<AppState | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const configuration = useQuery({
    queryKey: ['configuration'],
    queryFn: ({ signal }) => loadConfig(signal),
    staleTime: 60_000,
    retry: 1,
  });
  const session = useQuery({
    queryKey: ['session'],
    enabled: configuration.data?.console.enabled === true,
    queryFn: async ({ signal }) => {
      try {
        return (await api<Collection<Token>>('token', undefined, undefined, signal)).data[0] || {};
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return {};
        throw error;
      }
    },
    refetchInterval: 60_000,
    retry: 1,
  });
  const token = session.data || {};
  const authenticated = !!token.userIdentity;
  const identity = token.accountId || token.userIdentity?.externalId || 'anonymous';
  const previous = useRef(identity);
  useEffect(() => {
    let checking = false;
    const unauthorized = () => {
      if (checking) return;
      checking = true;
      void client.invalidateQueries({ queryKey: ['session'] }).finally(() => {
        checking = false;
      });
    };
    window.addEventListener(sessionUnauthorizedEvent, unauthorized);
    return () => window.removeEventListener(sessionUnauthorizedEvent, unauthorized);
  }, [client]);
  useEffect(() => {
    if (previous.current !== identity) {
      void client.cancelQueries({ predicate: (q) => q.queryKey[0] === 'data' });
      client.removeQueries({
        predicate: (q) => q.queryKey[0] === 'data' && q.queryKey[1] !== identity,
      });
      previous.current = identity;
    }
  }, [identity, client]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === 'accountId' || event.key === 'rancher.console.sessionChanged')
        void client.invalidateQueries({ queryKey: ['session'] });
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [client]);
  const projects = useQuery({
    queryKey: ['data', identity, 'projects'],
    queryFn: ({ signal }) => allPages<Project>('projects?limit=100', signal),
    enabled: authenticated && configuration.data?.console.enabled === true,
    refetchInterval: 30_000,
    retry: 1,
  });
  const key = `rancher.console.environment.${identity}`;
  const list = projects.data || [];
  const requested = params.get('env') || sessionStorage.getItem(key);
  const project = list.find((p) => p.id === requested) || list[0];
  useEffect(() => {
    if (project) sessionStorage.setItem(key, project.id);
  }, [key, project?.id]);
  const value = useMemo<AppState>(
    () => ({
      config: configuration.data?.console as ConsoleConfig,
      server: configuration.data?.server as ServerConfig,
      token,
      authenticated,
      identity,
      admin: token.userType === 'admin',
      projects: list,
      project,
      setProject(id) {
        if (!list.some((p) => p.id === id)) return;
        const next = new URLSearchParams(params);
        next.set('env', id);
        setParams(next);
        void client.cancelQueries({
          predicate: (q) => q.queryKey[0] === 'data' && q.queryKey[2] === 'project',
        });
      },
      refresh: async () => {
        await client.invalidateQueries({ queryKey: ['session'] });
        await client.invalidateQueries({ queryKey: ['data', identity] });
      },
    }),
    [
      configuration.data,
      token,
      authenticated,
      identity,
      list,
      project,
      key,
      params,
      setParams,
      client,
    ],
  );
  if (
    configuration.isPending ||
    (configuration.data?.console.enabled &&
      (session.isPending || (authenticated && projects.isPending)))
  )
    return <Loading label="Preparando sua console…" />;
  if (
    configuration.error ||
    (configuration.data?.console.enabled && (session.error || projects.error))
  )
    return (
      <ErrorState
        error={configuration.error || session.error || projects.error}
        retry={() => {
          void configuration.refetch();
          void session.refetch();
          void projects.refetch();
        }}
      />
    );
  return (
    <AppContext value={value}>
      <ThemeProvider config={value.config} identity={identity}>
        {children}
      </ThemeProvider>
    </AppContext>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider ausente');
  return value;
}
export function useDataKey(...parts: unknown[]) {
  const { identity, project } = useApp();
  return ['data', identity, 'project', project?.id || 'global', ...parts];
}
