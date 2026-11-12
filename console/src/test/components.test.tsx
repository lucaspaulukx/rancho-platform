import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button, CheckboxField, DataTable, ErrorState, Modal, Tabs } from '../components/ui';
import { useSidebarPreference } from '../hooks/useSidebarPreference';
import { ThemeProvider, useTheme } from '../theme';
import config from '../../public/console-config.json';
import { validateConfig } from '../config';
import { SchemaForm } from '../components/SchemaForm';
import { allPages, type Schema } from '../api';
import { I18nProvider, useI18n } from '../i18n/provider';
import { SecretField } from '../components/SecretField';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BulkOperation } from '../components/BulkOperation';
import ServiceTopology from '../components/ServiceTopology';

vi.mock('../state', () => ({
  useApp: () => ({ identity: 'fixture', project: { id: 'p1', name: 'Operações' } }),
}));

it('translates a rejected pagination link in place without exposing or following it', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        data: [],
        pagination: { next: 'https://outside.invalid/v2-beta/projects?marker=synthetic-private' },
      }),
    ),
  );
  const storageKey = 'rancho.console.locale.anonymous';
  localStorage.removeItem(storageKey);
  try {
    const error = await allPages('projects').catch((caught: unknown) => caught);
    function Page() {
      const { setLocale } = useI18n();
      return (
        <>
          <button onClick={() => setLocale('en-US')}>English</button>
          <ErrorState error={error} />
        </>
      );
    }
    render(
      <I18nProvider
        policy={{
          enabled: true,
          preview: true,
          defaultLocale: 'pt-BR',
          availableLocales: ['pt-BR', 'en-US'],
          selectable: true,
          detectBrowser: false,
        }}
      >
        <Page />
      </I18nProvider>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('O servidor retornou um endereço de API não permitido.');
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('alert')).toBe(alert);
    expect(alert).toHaveTextContent('The server returned a disallowed API address.');
    expect(alert).not.toHaveTextContent('synthetic-private');
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally {
    fetcher.mockRestore();
    localStorage.removeItem(storageKey);
  }
});

describe('Checkbox compartilhada', () => {
  it('legenda clica, Space alterna, descrição é associada e disabled impede mudança', async () => {
    const change = vi.fn();
    const { rerender } = render(
      <CheckboxField
        label="Iniciar serviços"
        description="Pode criar containers."
        onChange={change}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Iniciar serviços' });
    expect(checkbox).toHaveAccessibleDescription('Pode criar containers.');
    await userEvent.click(screen.getByText('Iniciar serviços'));
    expect(checkbox).toBeChecked();
    await userEvent.keyboard(' ');
    expect(checkbox).not.toBeChecked();
    expect(change).toHaveBeenCalledTimes(2);
    rerender(
      <CheckboxField
        label="Iniciar serviços"
        description="Pode criar containers."
        disabled
        onChange={change}
      />,
    );
    await userEvent.click(screen.getByText('Iniciar serviços'));
    expect(change).toHaveBeenCalledTimes(2);
  });
});

describe('Confirmação de remoção em lote', () => {
  it('preserva o nome de confirmação ao trocar de idioma e envia a remoção uma vez', async () => {
    const target = {
      id: 'fixture',
      type: 'container',
      name: 'Descartável',
      accountId: 'p1',
      links: { self: '/v2-beta/projects/p1/containers/fixture' },
      actions: { remove: '/v2-beta/projects/p1/containers/fixture?action=remove' },
    };
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify(target), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <BulkOperation plan={{ action: 'remove', resources: [target] }} onClose={vi.fn()} />
        ),
      },
    ]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider
          policy={{
            enabled: true,
            preview: true,
            defaultLocale: 'pt-BR',
            availableLocales: ['pt-BR', 'fr-FR'],
            selectable: true,
            detectBrowser: false,
          }}
        >
          <RouterProvider router={router} />
        </I18nProvider>
      </QueryClientProvider>,
    );
    const confirm = screen.getByRole('button', { name: 'Confirmar 1 operação' });
    expect(confirm).toBeDisabled();
    const input = screen.getByLabelText('Confirme o nome do environment');
    await userEvent.type(input, 'Outro environment');
    expect(confirm).toBeDisabled();
    expect(transport).not.toHaveBeenCalled();
    await userEvent.clear(input);
    await userEvent.type(input, 'Opera');
    const key = 'rancho.console.locale.anonymous';
    localStorage.setItem(key, JSON.stringify({ version: 1, locale: 'fr-FR' }));
    fireEvent(window, new StorageEvent('storage', { key }));
    const translated = await screen.findByRole('button', { name: 'Confirmer 1 opération' });
    expect(translated).toBe(confirm);
    expect(translated).toBeDisabled();
    expect(screen.getByLabelText('Confirmer le nom de l’environnement')).toBe(input);
    expect(input).toHaveValue('Opera');
    expect(transport).not.toHaveBeenCalled();
    await userEvent.type(input, 'ções');
    await userEvent.click(translated);
    expect(await screen.findByText('Reçue', { exact: true })).toBeInTheDocument();
    expect(transport).toHaveBeenCalledTimes(2);
    expect(translated).not.toBeInTheDocument();
    router.dispose();
  });
});

it('translates the open service topology without changing the stack or fetching it again', async () => {
  const transport = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ data: [] }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  try {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider
          policy={{
            enabled: true,
            preview: true,
            defaultLocale: 'pt-BR',
            availableLocales: ['pt-BR', 'fr-FR'],
            selectable: true,
            detectBrowser: false,
          }}
        >
          <ServiceTopology
            services={[{ id: 's1', accountId: 'p1', stackId: 'st1', type: 'service', links: {} }]}
            stacks={[{ id: 'st1', accountId: 'p1', type: 'stack', name: 'Loja', links: {} }]}
            schema={{
              id: 'serviceConsumeMap',
              pluralName: 'serviceConsumeMaps',
              links: {},
              resourceFields: {},
              collectionMethods: ['GET'],
            }}
            onClose={vi.fn()}
          />
        </I18nProvider>
      </QueryClientProvider>,
    );
    const stack = await screen.findByRole('combobox', { name: 'Stack' });
    await userEvent.selectOptions(stack, 'st1');
    const graph = screen.getByRole('region', { name: 'Topologia de serviços do environment' });
    const key = 'rancho.console.locale.anonymous';
    localStorage.setItem(key, JSON.stringify({ version: 1, locale: 'fr-FR' }));
    fireEvent(window, new StorageEvent('storage', { key }));
    expect(await screen.findByRole('dialog', { name: 'Topologie des services' })).toBeVisible();
    expect(screen.getByRole('combobox')).toBe(stack);
    expect(stack).toHaveValue('st1');
    expect(graph).toHaveAccessibleName('Topologie des services de l’environnement');
    expect(
      within(graph).getByRole('button', { name: 'Ajuster la topologie à la vue' }),
    ).toBeVisible();
    expect(transport).toHaveBeenCalledTimes(1);
  } finally {
    transport.mockRestore();
  }
});

describe('Comandos de registro protegidos', () => {
  it('não coloca a credencial no campo multilinha antes de revelar', async () => {
    render(
      <SecretField label="Comando do agente" value="docker run fixture-private-token" multiline />,
    );
    const field = screen.getByLabelText('Comando do agente');
    expect(field).not.toHaveValue(expect.stringContaining('fixture-private-token'));
    await userEvent.click(screen.getByRole('button', { name: 'Revelar' }));
    expect(field).toHaveValue('docker run fixture-private-token');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(field).not.toHaveValue(expect.stringContaining('fixture-private-token'));
  });
});

describe('Configurações opcionais dos formulários Cattle', () => {
  it('trata o schema nativo password como campo escalar e preserva o texto no envio', async () => {
    const submit = vi.fn();
    const schema: Schema = {
      id: 'registryCredential',
      pluralName: 'registrycredentials',
      links: {},
      resourceFields: {
        secretValue: { type: 'password', create: true, label: 'Senha ou token' },
      },
    };
    render(
      <>
        <SchemaForm
          id="password-fixture"
          schema={schema}
          schemas={{
            password: { id: 'password', pluralName: 'passwords', links: {}, resourceFields: {} },
          }}
          onSubmit={submit}
        />
        <button type="submit" form="password-fixture">
          Salvar
        </button>
      </>,
    );
    const field = screen.getByLabelText('Senha ou token');
    expect(field).toHaveAttribute('type', 'password');
    await userEvent.type(field, 'synthetic-fixture-password');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(submit).toHaveBeenCalledWith({ secretValue: 'synthetic-fixture-password' });
  });
  it('não exige campos de uma configuração opcional que não foi ativada', async () => {
    const submit = vi.fn();
    const schema: Schema = {
      id: 'service',
      pluralName: 'services',
      links: {},
      resourceFields: {
        name: { type: 'string', required: true, create: true },
        scalePolicy: { type: 'scalePolicy', create: true, nullable: true },
      },
    };
    const scalePolicy: Schema = {
      id: 'scalePolicy',
      pluralName: 'scalePolicies',
      links: {},
      resourceFields: { min: { type: 'int', create: true, required: true } },
    };
    render(
      <>
        <SchemaForm
          schema={schema}
          schemas={{ scalePolicy }}
          initialValues={{ name: 'web' }}
          onSubmit={submit}
        />
        <Button type="submit" form="resource-form">
          Salvar teste
        </Button>
      </>,
    );
    expect(document.querySelector('form')!.checkValidity()).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar teste' }));
    expect(submit).toHaveBeenCalledWith({ name: 'web' });
    await userEvent.click(screen.getByText(/Configuração avançada/));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Configurar scale policy' }));
    expect(screen.getByRole('spinbutton', { name: 'Min *' })).toBeRequired();
    expect(document.querySelector('form')!.checkValidity()).toBe(false);
  });
});

describe('Tabela compartilhada', () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: String(i),
    name: `Equipe ${String(i).padStart(2, '0')}`,
  }));
  const columns = [
    {
      key: 'name',
      label: 'Grupo',
      sortValue: (r: (typeof rows)[number]) => r.name,
      render: (r: (typeof rows)[number]) => r.name,
    },
  ];
  it('pagina e busca sem manter página inválida', async () => {
    const user = userEvent.setup();
    render(
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} searchText={(r) => r.name} />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(21);
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getAllByRole('row')).toHaveLength(6);
    await user.type(screen.getByRole('textbox'), 'Equipe 01');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
  });
  it('ordena e apresenta estado vazio', async () => {
    const user = userEvent.setup();
    render(
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} searchText={(r) => r.name} />,
    );
    await user.click(screen.getByRole('button', { name: /Grupo/ }));
    await user.click(screen.getByRole('button', { name: /Grupo/ }));
    expect(within(screen.getAllByRole('row')[1]).getByText('Equipe 24')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), 'inexistente');
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument();
  });
});
describe('Interações e temas compartilhados', () => {
  it('abas compartilham navegação por setas, Home e End', async () => {
    function Example() {
      const [selected, setSelected] = useState(0);
      return (
        <Tabs
          labels={['Membros', 'Environments', 'Revisão']}
          selected={selected}
          onChange={setSelected}
          panelId="panel"
          idPrefix="test-tab"
          label="Grupo"
        />
      );
    }
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole('tab', { name: 'Membros' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Environments' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Revisão' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Membros' })).toHaveFocus();
  });
  it('preferência de sidebar é persistida e isolada por usuário', async () => {
    function Example({ identity }: { identity: string }) {
      const sidebar = useSidebarPreference(identity);
      return (
        <button onClick={sidebar.toggle}>{sidebar.collapsed ? 'recolhido' : 'expandido'}</button>
      );
    }
    const { rerender } = render(<Example identity="admin" />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('recolhido');
    expect(JSON.parse(localStorage.getItem('rancher.console.sidebar.admin')!).collapsed).toBe(true);
    rerender(<Example identity="outro" />);
    expect(screen.getByRole('button')).toHaveTextContent('expandido');
  });
  it('bloqueia envio duplicado enquanto ocupado', async () => {
    const click = vi.fn();
    render(
      <Button busy onClick={click}>
        Salvar
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(click).not.toHaveBeenCalled();
  });
  it('drawer tem título acessível e fecha pelo teclado', async () => {
    const close = vi.fn();
    render(
      <Modal
        open
        onOpenChange={close}
        drawer
        title="Editar grupo"
        description="Configure os membros."
      >
        <input aria-label="Nome" />
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Editar grupo' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(close).toHaveBeenCalledWith(false);
  });
  it('isola preferências por identidade e aplica tema no documento', async () => {
    function Controls() {
      const theme = useTheme();
      return <button onClick={() => theme.setMode('dark')}>{theme.mode}</button>;
    }
    const { rerender } = render(
      <ThemeProvider config={validateConfig(config)} identity="a">
        <Controls />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(JSON.parse(localStorage.getItem('rancher.console.preferences.a')!).mode).toBe('dark');
    rerender(
      <ThemeProvider config={validateConfig(config)} identity="b">
        <Controls />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('dark');
  });
});
