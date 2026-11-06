import { lazy, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { AppProvider, useApp } from './state';
import { useI18n } from './i18n/provider';
import { AppShell, AuthLayout } from './layouts';
import { Empty, Loading, ToastProvider } from './components/ui';
import { PageErrorBoundary, RouteRecovery } from './components/PageErrorBoundary';
import { Login, Missing, NoAccess } from './pages/Auth';
const CatalogRepositories = lazy(() =>
  import('./pages/CatalogRepositories').then((module) => ({ default: module.CatalogRepositories })),
);
const MachineDrivers = lazy(() =>
  import('./pages/MachineDrivers').then((module) => ({ default: module.MachineDrivers })),
);
const ClusterMonitoring = lazy(() =>
  import('./pages/EngineMonitoring').then((module) => ({ default: module.ClusterMonitoring })),
);
const Webhooks = lazy(() =>
  import('./pages/Webhooks').then((module) => ({ default: module.Webhooks })),
);
const Settings = lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.Settings })),
);
const Processes = lazy(() =>
  import('./pages/Processes').then((module) => ({ default: module.Processes })),
);
const Audit = lazy(() => import('./pages/Audit').then((module) => ({ default: module.Audit })));
const ApiKeys = lazy(() =>
  import('./pages/ApiKeys').then((module) => ({ default: module.ApiKeys })),
);
const Groups = lazy(() => import('./pages/Groups').then((module) => ({ default: module.Groups })));
const Users = lazy(() => import('./pages/Users').then((module) => ({ default: module.Users })));
const HostsPage = lazy(() =>
  import('./pages/Hosts').then((module) => ({ default: module.HostsPage })),
);
const Overview = lazy(() =>
  import('./pages/Resources').then((module) => ({ default: module.Overview })),
);
const ResourcePage = lazy(() =>
  import('./pages/Resources').then((module) => ({ default: module.ResourcePage })),
);
const CatalogPage = lazy(() =>
  import('./pages/Catalog').then((module) => ({ default: module.CatalogPage })),
);
import { navigation, type NavItem } from './navigation';
import './styles.css';

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
function RuntimeGate() {
  const app = useApp();
  const { t } = useI18n();
  return app.config.enabled ? (
    <Outlet />
  ) : (
    <AuthLayout>
      <Empty
        title={t('runtime.disabledTitle')}
        description={t('runtime.disabledDescription')}
        action={
          <a className="button primary" href={app.config.classicUrl}>
            {t('runtime.classic')}
          </a>
        }
      />
    </AuthLayout>
  );
}
function Providers() {
  return (
    <AppProvider>
      <ToastProvider>
        <RuntimeGate />
      </ToastProvider>
    </AppProvider>
  );
}
function AccessBoundary() {
  const app = useApp();
  const { pathname } = useLocation();
  if (app.authenticated && !app.admin && !app.projects.length && pathname !== '/no-access')
    return <Navigate to="/no-access" replace />;
  return <AppShell />;
}
function Gate({ item, children }: { item: NavItem; children: ReactNode }) {
  const app = useApp();
  if (item.admin && !app.admin) return <Missing forbidden />;
  if (item.module && !app.config.modules[item.module]) return <Missing disabled />;
  if (item.module === 'groups' && !app.server.effective.LOCAL_RBAC_ENABLED)
    return <Missing disabled />;
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
const usersItem = navigation.find((item) => item.path === '/users')!;
const environments: NavItem = {
  ...navigation.find((n) => n.path === '/environments')!,
  collection: 'projects',
  schema: 'project',
};
const routes = navigation
  .filter((item) => item.collection && item.path !== '/users')
  .flatMap((item) => [
    {
      path: item.path.slice(1),
      element: (
        <Gate item={item}>
          {item.path === '/settings' ? (
            <Settings />
          ) : item.path === '/processes' ? (
            <Processes />
          ) : item.path === '/audit' ? (
            <Audit />
          ) : item.path === '/api-keys' ? (
            <ApiKeys />
          ) : item.path === '/hosts' ? (
            <Suspense fallback={<Loading />}>
              <HostsPage />
            </Suspense>
          ) : (
            <ResourcePage item={item} />
          )}
        </Gate>
      ),
    },
    {
      path: `${item.path.slice(1)}/:id`,
      element: (
        <Gate item={item}>
          {item.path === '/settings' ? (
            <Settings />
          ) : item.path === '/processes' ? (
            <Processes />
          ) : item.path === '/audit' ? (
            <Audit />
          ) : item.path === '/api-keys' ? (
            <ApiKeys />
          ) : item.path === '/hosts' ? (
            <Suspense fallback={<Loading />}>
              <HostsPage />
            </Suspense>
          ) : (
            <ResourcePage item={item} />
          )}
        </Gate>
      ),
    },
  ]);
const router = createBrowserRouter(
  [
    {
      element: <Providers />,
      errorElement: <RouteRecovery />,
      children: [
        { path: 'login', element: <Login /> },
        {
          element: <AccessBoundary />,
          children: [
            {
              index: true,
              element: (
                <Suspense fallback={<Loading />}>
                  <Overview />
                </Suspense>
              ),
            },
            { path: 'no-access', element: <NoAccess /> },
            {
              path: 'groups',
              element: (
                <Gate item={navigation.find((n) => n.path === '/groups')!}>
                  <Groups />
                </Gate>
              ),
            },
            {
              path: 'environments',
              element: (
                <Gate item={environments}>
                  <ResourcePage item={environments} />
                </Gate>
              ),
            },
            {
              path: 'environments/:id',
              element: (
                <Gate item={environments}>
                  <ResourcePage item={environments} />
                </Gate>
              ),
            },
            {
              path: 'users',
              element: (
                <Gate item={usersItem}>
                  <Users />
                </Gate>
              ),
            },
            {
              path: 'users/:id',
              element: (
                <Gate item={usersItem}>
                  <Users />
                </Gate>
              ),
            },
            {
              path: 'webhooks',
              element: (
                <Gate item={navigation.find((item) => item.path === '/webhooks')!}>
                  <Webhooks />
                </Gate>
              ),
            },
            {
              path: 'catalog-repositories',
              element: (
                <Gate item={navigation.find((item) => item.path === '/catalog-repositories')!}>
                  <CatalogRepositories />
                </Gate>
              ),
            },
            {
              path: 'drivers',
              element: (
                <Gate item={navigation.find((item) => item.path === '/drivers')!}>
                  <MachineDrivers />
                </Gate>
              ),
            },
            {
              path: 'ha',
              element: (
                <Gate item={navigation.find((item) => item.path === '/ha')!}>
                  <ClusterMonitoring />
                </Gate>
              ),
            },
            ...routes,
            {
              path: 'catalog',
              element: (
                <Gate item={navigation.find((item) => item.path === '/catalog')!}>
                  <Suspense fallback={<Loading />}>
                    <CatalogPage />
                  </Suspense>
                </Gate>
              ),
            },
            { path: '*', element: <Missing /> },
          ],
        },
      ],
    },
  ],
  { basename: '/console' },
);
createRoot(document.getElementById('root')!).render(
  <PageErrorBoundary>
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </PageErrorBoundary>,
);
