import { useEffect, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import configuration from '../../public/console-config.json';
import { AppShell, AuthLayout } from '../layouts';
import { EnvironmentSwitcher } from '../components/EnvironmentSwitcher';
import { I18nProvider, useI18n } from '../i18n/provider';
import type { LocalizationPolicy } from '../i18n/policy';
import { createTranslator } from '../i18n/messages';
import { localizedNavigation, navigation } from '../navigation';

const projects = [
  { id: '1a12', name: 'Desenvolvimento', state: 'active', orchestration: 'cattle' },
  { id: '1a13', name: 'Produção', state: 'active', orchestration: 'cattle' },
];
const app = {
  identity: 'shell-localization-test',
  config: configuration,
  admin: true,
  authenticated: true,
  server: { effective: {} },
  token: { userIdentity: { name: 'Sandbox admin' } },
  projects,
  project: projects[0],
  setProject: vi.fn(),
};
vi.mock('../state', () => ({ useApp: () => app }));
vi.mock('../hooks/useLogout', () => ({ useLogout: () => ({ pending: false, signOut: vi.fn() }) }));
vi.mock('../theme', () => ({
  useTheme: () => ({
    dark: false,
    mode: 'light',
    dense: false,
    setMode: vi.fn(),
    setDense: vi.fn(),
  }),
}));
const policy: LocalizationPolicy = {
  enabled: true,
  defaultLocale: 'pt-BR',
  selectable: true,
  availableLocales: ['pt-BR', 'en-US'],
  detectBrowser: false,
  preview: true,
};

describe('Localized shared shell', () => {
  it('copies navigation labels without changing routes, grouping or native contracts', () => {
    const original = navigation.map((item) => ({ ...item }));
    const translated = localizedNavigation(createTranslator('en-US').t);
    expect(translated.find((item) => item.path === '/services')?.title).toBe('Services');
    expect(translated.find((item) => item.path === '/groups')?.description).toBe(
      'Centralize members and environment permissions.',
    );
    expect(translated.map(({ title: _title, description: _description, ...item }) => item)).toEqual(
      original.map(({ title: _title, description: _description, ...item }) => item),
    );
    expect(navigation).toEqual(original);
    expect(translated.some((item) => item.title.startsWith('shell.'))).toBe(false);
  });

  it('switches header/sidebar language without remounting the page, losing drafts or changing the URL', async () => {
    const mounted = vi.fn(),
      unmounted = vi.fn();
    function Draft() {
      const [draft, setDraft] = useState('');
      const location = useLocation();
      useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return (
        <>
          <input
            aria-label="Workload draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <output aria-label="Current URL">{location.pathname + location.search}</output>
        </>
      );
    }
    render(
      <I18nProvider policy={policy} identity="shell-localization-test">
        <MemoryRouter initialEntries={['/stacks?env=1a12&filter=foo']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="stacks" element={<Draft />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );
    const user = userEvent.setup();
    const draft = screen.getByLabelText('Workload draft');
    await user.type(draft, 'keep this workload');
    await user.click(screen.getByRole('button', { name: 'Recolher menu' }));
    expect(screen.getByTestId('app-shell')).toHaveClass('sidebar-collapsed');
    await user.selectOptions(screen.getByLabelText('Idioma'), 'en-US');
    expect(screen.getByRole('complementary', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute(
      'href',
      '/services?env=1a12',
    );
    expect(screen.getByRole('button', { name: 'Expand menu' })).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toHaveClass('sidebar-collapsed');
    expect(screen.getByLabelText('Workload draft')).toBe(draft);
    expect(draft).toHaveValue('keep this workload');
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/stacks?env=1a12&filter=foo');
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Environment: Desenvolvimento' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toHaveValue('en-US');
  });

  it('makes the shared selector available before login without replacing entered fields', async () => {
    render(
      <I18nProvider policy={policy} identity="anonymous">
        <AuthLayout>
          <input aria-label="Account draft" defaultValue="existing-user" />
        </AuthLayout>
      </I18nProvider>,
    );
    const input = screen.getByLabelText('Account draft');
    await userEvent.selectOptions(screen.getByLabelText('Idioma'), 'en-US');
    expect(
      screen.getByRole('heading', { name: /Your environment\.\s*A clear view\./ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Secure access to your infrastructure.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use dark theme' })).toBeInTheDocument();
    expect(screen.getByLabelText('Account draft')).toBe(input);
    expect(input).toHaveValue('existing-user');
    expect(screen.getByRole('img', { name: 'Rancher' })).toBeInTheDocument();
  });

  it('preserves the open environment search and focus across a locale change, selecting only the native ID', async () => {
    const select = vi.fn();
    let changeLocale: ReturnType<typeof useI18n>['setLocale'] = () => {};
    function Harness() {
      changeLocale = useI18n().setLocale;
      return <EnvironmentSwitcher projects={projects} currentId="1a12" onSelect={select} />;
    }
    render(
      <I18nProvider policy={policy} identity="switcher-test">
        <MemoryRouter>
          <Harness />
        </MemoryRouter>
      </I18nProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Environment: Desenvolvimento' }));
    const search = screen.getByRole('combobox', { name: 'Buscar environment' });
    await user.type(search, 'producao');
    act(() => changeLocale('en-US'));
    expect(screen.getByRole('dialog', { name: 'Select environment' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search environments' })).toBe(search);
    expect(search).toHaveValue('producao');
    expect(search).toHaveFocus();
    expect(select).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: /Produção/ })).toHaveTextContent('Active');
    await user.keyboard('{Enter}');
    expect(select).toHaveBeenCalledExactlyOnceWith('1a13');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Environment: Desenvolvimento' })).toHaveFocus();
  });
});
