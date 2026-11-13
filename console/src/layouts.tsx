import { useLogout } from './hooks/useLogout';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  LogOut,
  Info,
  Menu,
  Moon,
  Palette,
  PanelLeftClose,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import { environmentSearch, localizedNavigation } from './navigation';
import { useI18n } from './i18n/provider';
import { LanguageSelector } from './components/LanguageSelector';
import { useApp } from './state';
import { useTheme } from './theme';
import { useSidebarPreference } from './hooks/useSidebarPreference';
import { Button, Empty, Field, Loading, Modal } from './components/ui';
import { Brand } from './components/Brand';
export { Brand };
import { EnvironmentSwitcher } from './components/EnvironmentSwitcher';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { version } from '../package.json';
const About = lazy(() =>
  import('./components/About').then((module) => ({ default: module.About })),
);
const AccessDiagnostics = lazy(() =>
  import('./components/AccessDiagnostics').then((module) => ({
    default: module.AccessDiagnostics,
  })),
);

export function Appearance({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const { config } = useApp();
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={t('shell.appearance.title')}
      description={t('shell.appearance.description')}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('shell.appearance.done')}
        </Button>
      }
    >
      <div className="theme-options">
        {(['light', 'dark', 'system'] as const).map((mode, index) => (
          <button
            key={mode}
            className={theme.mode === mode ? 'theme-option selected' : 'theme-option'}
            disabled={!config.themeSelectable}
            onClick={() => theme.setMode(mode)}
          >
            <div className={`theme-preview ${mode}`}>
              <span />
              <span />
              <span />
            </div>
            <span>
              {
                [
                  t('shell.appearance.light'),
                  t('shell.appearance.dark'),
                  t('shell.appearance.system'),
                ][index]
              }
              {theme.mode === mode && <Check size={16} />}
            </span>
          </button>
        ))}
      </div>
      {!config.themeSelectable && <p className="muted">{t('shell.appearance.managed')}</p>}
      <Field label={t('shell.appearance.density')}>
        {(id) => (
          <select
            id={id}
            value={theme.dense ? 'compact' : 'comfortable'}
            onChange={(e) => theme.setDense(e.target.value === 'compact')}
          >
            <option value="comfortable">{t('shell.appearance.comfortable')}</option>
            <option value="compact">{t('shell.appearance.compact')}</option>
          </select>
        )}
      </Field>
    </Modal>
  );
}
export function AppShell() {
  const { t } = useI18n();
  const navigation = localizedNavigation(t);
  const { pending: loggingOut, signOut } = useLogout();
  const app = useApp();
  const { pathname, search, hash } = useLocation();
  const [mobile, setMobile] = useState(false);
  const { collapsed, toggle: toggleSidebar } = useSidebarPreference(app.identity);
  const [appearance, setAppearance] = useState(false);
  const [selfAccess, setSelfAccess] = useState(false);
  const [about, setAbout] = useState(false);
  const accessAccount =
    app.project && app.config.modules.groups && app.server.effective.LOCAL_RBAC_ENABLED
      ? 'self'
      : undefined;
  const { dark, setMode } = useTheme();
  useEffect(() => setMobile(false), [pathname]);
  useEffect(() => {
    const media = matchMedia('(max-width: 767px)');
    const update = () => {
      if (!media.matches) setMobile(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement;
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const controls = () =>
      [...(sidebar?.querySelectorAll<HTMLElement>('a,button,select,[tabindex="0"]') || [])].filter(
        (element) => element.offsetParent !== null,
      );
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobile(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const list = controls();
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [mobile]);
  const pending = !app.admin && !app.projects.length;
  const items = pending
    ? [
        {
          path: '/no-access',
          title: t('shell.access.title'),
          description: t('shell.access.waiting'),
          icon: ShieldCheck,
          section: 'SUA CONTA',
          scoped: false,
        },
      ]
    : navigation.filter(
        (item) =>
          (!item.admin || app.admin) &&
          (!item.scoped || !!app.project) &&
          (!item.module || app.config.modules[item.module]) &&
          (item.module !== 'groups' || app.server.effective.LOCAL_RBAC_ENABLED),
      );
  const current = navigation.find((item) => item.path !== '/' && pathname.startsWith(item.path));
  const groups = [...new Set(items.map((item) => item.section))];
  if (!app.authenticated)
    return <Navigate to="/login" replace state={{ from: pathname + search + hash }} />;
  if (!app.config.enabled)
    return (
      <Empty
        title={t('shell.disabled.title')}
        description={t('shell.disabled.description')}
        action={
          <a className="button secondary" href={app.config.classicUrl}>
            {t('shell.classic.open')} <ArrowUpRight size={16} />
          </a>
        }
      />
    );
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`} data-testid="app-shell">
      <a className="skip-link" href="#main-content">
        {t('shell.skipContent')}
      </a>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-hidden="true"
          tabIndex={-1}
          aria-label={t('shell.navigation.close')}
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`sidebar ${mobile ? 'mobile-open' : ''}`}
        aria-label={t('shell.navigation.main')}
        role={mobile ? 'dialog' : undefined}
        aria-modal={mobile || undefined}
      >
        <div className="sidebar-brand">
          <Link to="/" aria-label={t('shell.navigation.home')}>
            <Brand compact={collapsed} />
          </Link>
          <Button
            variant="ghost"
            className="mobile-only"
            aria-label={t('shell.navigation.close')}
            onClick={() => setMobile(false)}
          >
            <X size={19} />
          </Button>
        </div>
        <nav>
          {groups.map((section) => (
            <div className="nav-section" key={section}>
              <p>
                {section === 'OPERAÇÃO'
                  ? t('shell.section.operations')
                  : section === 'INFRAESTRUTURA'
                    ? t('shell.section.infrastructure')
                    : section === 'ADMINISTRAÇÃO'
                      ? t('shell.section.administration')
                      : section === 'INTEGRAÇÕES'
                        ? t('shell.section.integrations')
                        : section === 'SUA CONTA'
                          ? t('shell.section.account')
                          : section}
              </p>
              {items
                .filter((item) => item.section === section)
                .map((item) => (
                  <NavLink
                    key={item.path}
                    to={{
                      pathname: item.path,
                      search: item.scoped ? environmentSearch(search) : '',
                    }}
                    end={item.path === '/'}
                    title={collapsed ? item.title : undefined}
                  >
                    <item.icon size={19} />
                    <span>{item.title}</span>
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="product-signature">
            <span className="signature-mark">
              <img src="/console/brand/rancher-symbol.svg" alt="" />
            </span>
            <div>
              <strong>Rancher 1.6.30</strong>
              {app.config.branding && <span>Community Console</span>}
            </div>
          </div>
          <button
            className="collapse-button"
            onClick={toggleSidebar}
            aria-label={collapsed ? t('shell.navigation.expand') : t('shell.navigation.collapse')}
          >
            <PanelLeftClose size={17} />
            <span>{t('shell.navigation.collapse')}</span>
          </button>
        </div>
      </aside>
      <div className="workspace" inert={mobile}>
        <header className="navbar">
          <div className="navbar-leading">
            <Button
              variant="ghost"
              className="mobile-only"
              aria-label={t('shell.navigation.open')}
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </Button>
            <div className="breadcrumbs">
              <span>Console</span>
              <span>/</span>
              <strong>
                {pathname === '/no-access'
                  ? t('shell.access.pending')
                  : current?.title || t('shell.nav.overview.title')}
              </strong>
            </div>
          </div>
          <div className="navbar-actions">
            <EnvironmentSwitcher
              projects={app.projects}
              currentId={app.project?.id}
              onSelect={app.setProject}
              manageEnabled={app.config.modules.environments}
            />
            <LanguageSelector />
            <span className="navbar-divider" />
            <Button
              variant="ghost"
              aria-label={dark ? t('shell.theme.light') : t('shell.theme.dark')}
              onClick={() => setMode(dark ? 'light' : 'dark')}
              disabled={!app.config.themeSelectable}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </Button>
            <details className="profile-menu">
              <summary aria-label={t('shell.user.menu')}>
                <span className="avatar">
                  {(app.token.userIdentity?.name || app.token.userIdentity?.login || 'U')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div>
                  <strong>
                    {app.token.userIdentity?.name ||
                      app.token.userIdentity?.login ||
                      t('shell.user.name')}
                  </strong>
                  <span>{app.admin ? t('shell.user.admin') : t('shell.user.name')}</span>
                </div>
                <ChevronDown size={14} />
              </summary>
              <div className="profile-dropdown">
                {accessAccount && (
                  <button onClick={() => setSelfAccess(true)}>
                    <ShieldCheck size={17} />
                    {t('shell.user.access')}
                  </button>
                )}
                <button onClick={() => setAppearance(true)}>
                  <Palette size={17} /> {t('shell.user.appearance')}
                </button>
                <a href={app.config.classicUrl} target="_blank" rel="noreferrer">
                  <ArrowUpRight size={17} /> {t('shell.classic.title')}
                </a>
                {app.config.modules.about && (
                  <button onClick={() => setAbout(true)}>
                    <Info size={17} /> {t('shell.user.about')}
                  </button>
                )}
                <button onClick={() => void signOut()} disabled={loggingOut} aria-busy={loggingOut}>
                  <LogOut size={17} />{' '}
                  {loggingOut ? t('shell.user.signingOut') : t('shell.user.signOut')}
                </button>
              </div>
            </details>
          </div>
        </header>
        <main id="main-content" className="page-content">
          <PageErrorBoundary key={pathname}>
            <Outlet />
          </PageErrorBoundary>
        </main>
        <footer className="workspace-footer">
          <span>{app.config.branding ? 'Rancher Community Console' : 'Rancher'}</span>
          <span>
            {t('shell.footer.modern')} <span className="version-pill">v{version}</span>
          </span>
        </footer>
      </div>
      {about && app.config.modules.about && (
        <Suspense fallback={<Loading />}>
          <About open={about} onClose={() => setAbout(false)} />
        </Suspense>
      )}
      <Appearance open={appearance} onClose={() => setAppearance(false)} />
      {selfAccess && accessAccount && (
        <Suspense fallback={<Loading />}>
          <AccessDiagnostics
            key={`${app.identity}:${app.project?.id}`}
            account={{
              id: accessAccount,
              name:
                app.token.userIdentity?.name ||
                app.token.userIdentity?.login ||
                t('shell.user.account'),
              kind: app.admin ? 'admin' : 'user',
              state: 'active',
            }}
            projects={app.projects}
            onClose={() => setSelfAccess(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { dark, setMode } = useTheme();
  const { config } = useApp();
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <p className="eyebrow">{t('shell.story.eyebrow')}</p>
          <h2>
            {t('shell.story.environment')}
            <br />
            {t('shell.story.view')}
          </h2>
          <p>{t('shell.story.description')}</p>
          <div className="auth-diagram" aria-hidden="true">
            <div className="diagram-core">
              <img src="/console/brand/rancher-symbol.svg" alt="" />
            </div>
            <span className="diagram-node one" />
            <span className="diagram-node two" />
            <span className="diagram-node three" />
            <span className="diagram-line one" />
            <span className="diagram-line two" />
          </div>
        </div>
        <span className="auth-attribution">
          {config.branding ? 'Rancher Community Console' : 'Rancher Console'}
        </span>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-top">
          <span>Rancher Console</span>
          <LanguageSelector />
          {config.themeSelectable && (
            <Button
              variant="ghost"
              aria-label={dark ? t('shell.theme.light') : t('shell.theme.dark')}
              onClick={() => setMode(dark ? 'light' : 'dark')}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </Button>
          )}
        </div>
        <div className="auth-form-container">{children}</div>
        <p className="auth-footer">{t('shell.story.secure')}</p>
      </section>
    </div>
  );
}
