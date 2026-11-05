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
import { environmentSearch, navigation } from './navigation';
import { useApp } from './state';
import { useTheme } from './theme';
import { useSidebarPreference } from './hooks/useSidebarPreference';
import { logout } from './api';
import { Button, Empty, Field, Loading, Modal } from './components/ui';
import { Brand } from './components/Brand';
export { Brand };
import { EnvironmentSwitcher } from './components/EnvironmentSwitcher';
import { PageErrorBoundary } from './components/PageErrorBoundary';
const About = lazy(() =>
  import('./components/About').then((module) => ({ default: module.About })),
);
const AccessDiagnostics = lazy(() =>
  import('./components/AccessDiagnostics').then((module) => ({
    default: module.AccessDiagnostics,
  })),
);

export function Appearance({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { config } = useApp();
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Sua aparência"
      description="Preferências aplicadas a todas as telas desta console."
      footer={
        <Button variant="primary" onClick={onClose}>
          Concluir
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
              {['Claro', 'Escuro', 'Sistema'][index]}
              {theme.mode === mode && <Check size={16} />}
            </span>
          </button>
        ))}
      </div>
      {!config.themeSelectable && <p className="muted">O tema é definido pelo administrador.</p>}
      <Field label="Densidade">
        {(id) => (
          <select
            id={id}
            value={theme.dense ? 'compact' : 'comfortable'}
            onChange={(e) => theme.setDense(e.target.value === 'compact')}
          >
            <option value="comfortable">Confortável</option>
            <option value="compact">Compacta</option>
          </select>
        )}
      </Field>
    </Modal>
  );
}
export function AppShell() {
  const app = useApp();
  const { pathname, search } = useLocation();
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
          title: 'Seu acesso',
          description: 'Aguardando liberação de acesso.',
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
    return <Navigate to="/login" replace state={{ from: pathname + search }} />;
  if (!app.config.enabled)
    return (
      <Empty
        title="Console desativada"
        description="A console moderna está desativada na configuração desta instância."
        action={
          <a className="button secondary" href={app.config.classicUrl}>
            Abrir Rancher clássico <ArrowUpRight size={16} />
          </a>
        }
      />
    );
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`} data-testid="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-hidden="true"
          tabIndex={-1}
          aria-label="Fechar navegação"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`sidebar ${mobile ? 'mobile-open' : ''}`}
        aria-label="Navegação principal"
        role={mobile ? 'dialog' : undefined}
        aria-modal={mobile || undefined}
      >
        <div className="sidebar-brand">
          <Link to="/" aria-label="Página inicial">
            <Brand compact={collapsed} />
          </Link>
          <Button
            variant="ghost"
            className="mobile-only"
            aria-label="Fechar navegação"
            onClick={() => setMobile(false)}
          >
            <X size={19} />
          </Button>
        </div>
        <nav>
          {groups.map((section) => (
            <div className="nav-section" key={section}>
              <p>{section}</p>
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
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <PanelLeftClose size={17} />
            <span>Recolher menu</span>
          </button>
        </div>
      </aside>
      <div className="workspace" inert={mobile}>
        <header className="navbar">
          <div className="navbar-leading">
            <Button
              variant="ghost"
              className="mobile-only"
              aria-label="Abrir navegação"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </Button>
            <div className="breadcrumbs">
              <span>Console</span>
              <span>/</span>
              <strong>
                {pathname === '/no-access' ? 'Acesso pendente' : current?.title || 'Visão geral'}
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
            <span className="navbar-divider" />
            <Button
              variant="ghost"
              aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
              onClick={() => setMode(dark ? 'light' : 'dark')}
              disabled={!app.config.themeSelectable}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </Button>
            <details className="profile-menu">
              <summary aria-label="Menu do usuário">
                <span className="avatar">
                  {(app.token.userIdentity?.name || app.token.userIdentity?.login || 'U')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div>
                  <strong>
                    {app.token.userIdentity?.name || app.token.userIdentity?.login || 'Usuário'}
                  </strong>
                  <span>{app.admin ? 'Administrador' : 'Usuário'}</span>
                </div>
                <ChevronDown size={14} />
              </summary>
              <div className="profile-dropdown">
                {accessAccount && (
                  <button onClick={() => setSelfAccess(true)}>
                    <ShieldCheck size={17} />
                    Meu acesso
                  </button>
                )}
                <button onClick={() => setAppearance(true)}>
                  <Palette size={17} /> Aparência
                </button>
                <a href={app.config.classicUrl} target="_blank" rel="noreferrer">
                  <ArrowUpRight size={17} /> Rancher clássico
                </a>
                {app.config.modules.about && (
                  <button onClick={() => setAbout(true)}>
                    <Info size={17} /> Sobre esta console
                  </button>
                )}
                <button onClick={() => void logout()}>
                  <LogOut size={17} /> Sair
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
            Console moderna <span className="version-pill">v0.1.0</span>
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
              name: app.token.userIdentity?.name || app.token.userIdentity?.login || 'Minha conta',
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
  const { dark, setMode } = useTheme();
  const { config } = useApp();
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <p className="eyebrow">INFRAESTRUTURA, COM CONTEXTO</p>
          <h2>
            Seu ambiente.
            <br />
            Uma visão clara.
          </h2>
          <p>Recursos, aplicações e acesso em uma experiência conectada.</p>
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
          {config.themeSelectable && (
            <Button
              variant="ghost"
              aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
              onClick={() => setMode(dark ? 'light' : 'dark')}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </Button>
          )}
        </div>
        <div className="auth-form-container">{children}</div>
        <p className="auth-footer">Acesso seguro à sua infraestrutura.</p>
      </section>
    </div>
  );
}
