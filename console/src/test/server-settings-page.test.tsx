import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Settings } from '../pages/Settings';
import { I18nProvider } from '../i18n/provider';
import type { Resource, Schema } from '../api';
const state = vi.hoisted(() => ({
  changed: false,
  denied: false,
  posts: [] as unknown[],
  fail: false,
}));
const raw = {
  id: 'console.lab.fixture.test',
  name: 'console.lab.fixture.test',
  type: 'setting',
  source: 'Database',
  inDb: true,
  value: 'synthetic-private\nline-two',
  activeValue: 'synthetic-private\nline-two',
  links: { self: '/v2-beta/settings/console.lab.fixture.test' },
} as Resource;
const schema: Schema = {
  id: 'setting',
  pluralName: 'settings',
  links: {},
  resourceFields: { value: { type: 'string', update: true, maxLength: 100 } },
  resourceMethods: ['GET', 'PUT', 'DELETE'],
};
vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'admin',
    admin: true,
    config: { modules: { settings: true, unsavedChangesGuard: true } },
  }),
}));
vi.mock('../hooks/useSchemas', () => ({ useSchemas: () => ({ data: { setting: schema } }) }));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
vi.mock('../api', async () => ({
  ...(await vi.importActual('../api')),
  allPages: vi.fn(async () => [structuredClone(raw)]),
  api: vi.fn(async (path: string, body?: unknown, method?: string) => {
    if (path === 'schemas/setting')
      return { ...schema, resourceMethods: state.denied ? ['GET'] : schema.resourceMethods };
    if (method === 'PUT' || method === 'DELETE') {
      state.posts.push(body);
      if (state.fail) throw new Error('synthetic-private failure');
      return structuredClone(raw);
    }
    return {
      ...structuredClone(raw),
      ...(state.changed ? { activeValue: 'external-private' } : {}),
    };
  }),
}));
function mount(localized = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <Settings /> }]);
  render(
    <QueryClientProvider client={client}>
      <I18nProvider
        policy={
          localized
            ? {
                enabled: true,
                defaultLocale: 'pt-BR',
                availableLocales: ['pt-BR', 'en-US'],
                selectable: true,
                detectBrowser: false,
                preview: true,
              }
            : undefined
        }
      >
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return client;
}
async function open() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Abrir configuração console.lab.fixture.test' }),
  );
  await screen.findByLabelText('Valor configurado');
  return user;
}
async function edit() {
  const user = await open();
  await user.click(screen.getByRole('button', { name: 'Mostrar valores' }));
  await user.clear(screen.getByLabelText('Valor configurado'));
  await user.type(screen.getByLabelText('Valor configurado'), 'new{Enter}multiline');
  await user.click(screen.getByRole('button', { name: 'Revisar alteração' }));
  return user;
}
beforeEach(() => {
  state.changed = false;
  state.denied = false;
  state.fail = false;
  state.posts = [];
});
describe('Página de configurações', () => {
  it('lista/cache não contêm valores; modal mascara e revela multiline só por solicitação', async () => {
    const client = mount(),
      user = await open();
    expect(screen.getByLabelText('Valor configurado')).toHaveAttribute('type', 'password');
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('synthetic-private');
    await user.click(screen.getByRole('button', { name: 'Mostrar valores' }));
    expect(screen.getByLabelText('Valor configurado')).toHaveValue('synthetic-private\nline-two');
  });
  it('envia multiline após revisão sem guardar resposta privada em cache de mutação', async () => {
    const client = mount(),
      user = await edit();
    expect(document.querySelector('textarea')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(state.posts).toEqual([{ value: 'new\nmultiline' }]));
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('synthetic-private');
  });
  it.each(['changed', 'denied'] as const)(
    'recusa %s depois da revisão preservando rascunho',
    async (kind) => {
      mount();
      const user = await edit();
      state[kind] = true;
      await user.click(screen.getByRole('button', { name: 'Confirmar' }));
      await screen.findByText(
        kind === 'changed'
          ? 'A configuração mudou. Reabra o editor.'
          : 'A operação não está mais disponível.',
      );
      expect(state.posts).toHaveLength(0);
    },
  );
  it('sanitiza mensagem de erro do servidor antes de exibir', async () => {
    mount();
    const user = await edit();
    state.fail = true;
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Não foi possível concluir a operação de configuração.');
    expect(screen.queryByText('synthetic-private failure')).not.toBeInTheDocument();
  });
  it('protege recarga com rascunho e não salva em storage', async () => {
    mount();
    await edit();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(
      'synthetic-private',
    );
  });
  it('traduz erro já aberto sem perder o rascunho nem repetir a mutação', async () => {
    localStorage.removeItem('rancho.console.locale.anonymous');
    mount(true);
    const user = await edit();
    state.fail = true;
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Não foi possível concluir a operação de configuração.');
    const draft = screen.getByLabelText('Valor configurado');
    const displayedValue = (draft as HTMLInputElement).value;
    act(() => {
      localStorage.setItem(
        'rancho.console.locale.anonymous',
        JSON.stringify({ version: 1, locale: 'en-US' }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: 'rancho.console.locale.anonymous' }));
    });
    expect(screen.getByText('Unable to complete the settings operation.')).toBeInTheDocument();
    expect(screen.getByLabelText('Configured value')).toBe(draft);
    expect(draft).toHaveValue(displayedValue);
    expect(state.posts).toEqual([{ value: 'new\nmultiline' }]);
    expect(state.posts).toHaveLength(1);
    expect(screen.queryByText('synthetic-private failure')).not.toBeInTheDocument();
    localStorage.removeItem('rancho.console.locale.anonymous');
  });
});
