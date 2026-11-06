import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { Resource, Schema } from '../api';
import { SchemaForm } from '../components/SchemaForm';
import { ResourceCreator } from '../components/ResourceCreator';
import { I18nProvider, useI18n } from '../i18n/provider';
import type { Locale } from '../i18n/locales';

const backend = vi.hoisted(() => ({
  devicesEnabled: true,
  current: {} as Schema,
  refreshed: [] as Schema[],
  posts: [] as Record<string, unknown>[],
  allPages: vi.fn(),
}));
const container = {
  id: 'container',
  pluralName: 'containers',
  collectionMethods: ['GET', 'POST'],
  resourceMethods: ['GET', 'PUT'],
  links: { self: '/container-schema', collection: '/containers' },
  resourceFields: {
    name: { type: 'string', create: true },
    imageUuid: { type: 'string', create: true },
    devices: { type: 'array[string]', create: true },
  },
} as Schema;

vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'device-fixture-admin',
    project: { id: 'p1', name: 'Owned test environment' },
    config: { modules: { workloadDeviceEditors: backend.devicesEnabled } },
  }),
}));
vi.mock('../hooks/useSchemas', () => ({
  useSchemas: () => ({ data: { container }, isPending: false }),
}));
vi.mock('../api', async () => ({
  ...(await vi.importActual<typeof import('../api')>('../api')),
  allPages: (path: string) => {
    backend.allPages(path);
    return Promise.resolve(structuredClone(backend.refreshed));
  },
  api: vi.fn(async (path: string, payload?: Record<string, unknown>, method?: string) => {
    if (method === 'POST' && path === '/containers') {
      backend.posts.push(payload!);
      return { id: 'c1', type: 'container', accountId: 'p1', name: payload!.name, links: {} };
    }
    if (path === '/container-schema') return structuredClone(backend.current);
    throw new Error('Unexpected fixture request.');
  }),
}));

const localization = {
  enabled: true,
  defaultLocale: 'en-US' as Locale,
  availableLocales: ['pt-BR', 'en-US'] as Locale[],
  selectable: true,
  detectBrowser: false,
  preview: true,
};
function renderCreator(locale: Locale = 'pt-BR') {
  const router = createMemoryRouter([
    { path: '/', element: <ResourceCreator selection={{ kind: 'container' }} onClose={vi.fn()} /> },
  ]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider
        policy={{ ...localization, defaultLocale: locale }}
        identity="device-fixture-admin"
      >
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  backend.devicesEnabled = true;
  backend.current = container;
  backend.refreshed = [container];
  backend.posts = [];
});

describe('Structured device creation integration', () => {
  it('keeps the native textarea when off and when the current field contract is incompatible', () => {
    const { unmount } = render(<SchemaForm schema={container} schemas={{}} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Dispositivos').tagName).toBe('TEXTAREA');
    expect(
      screen.queryByRole('button', { name: 'Adicionar dispositivo', hidden: true }),
    ).not.toBeInTheDocument();
    unmount();
    render(
      <SchemaForm
        schema={{ ...container, resourceFields: { devices: { type: 'array[int]', create: true } } }}
        schemas={{}}
        onSubmit={vi.fn()}
        deviceEditors
      />,
    );
    expect(screen.getByLabelText('Dispositivos').tagName).toBe('TEXTAREA');
    expect(
      screen.queryByRole('button', { name: 'Adicionar dispositivo', hidden: true }),
    ).not.toBeInTheDocument();
  });

  it('does not enable device editing in an existing-resource PUT form', () => {
    const updating = {
      ...container,
      resourceFields: { devices: { type: 'array[string]', create: true, update: true } },
    } as Schema;
    render(
      <SchemaForm
        schema={updating}
        schemas={{}}
        original={
          { id: 'c1', type: 'container', links: {}, devices: ['/dev/null:/dev/test:r'] } as Resource
        }
        onSubmit={vi.fn()}
        deviceEditors
      />,
    );
    expect(screen.getByLabelText('Dispositivos').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Dispositivos')).toHaveValue('/dev/null:/dev/test:r');
    expect(
      screen.queryByRole('button', { name: 'Adicionar dispositivo', hidden: true }),
    ).not.toBeInTheDocument();
  });

  it('propagates the same editor into primary launch config and sidecars without mixing their values', () => {
    const launch = { ...container, id: 'launchConfig' } as Schema;
    const secondary = { ...container, id: 'secondaryLaunchConfig' } as Schema;
    const service = {
      ...container,
      id: 'service',
      resourceFields: {
        name: { type: 'string', create: true },
        launchConfig: { type: 'launchConfig', create: true, required: true },
        secondaryLaunchConfigs: { type: 'array[secondaryLaunchConfig]', create: true },
      },
    } as Schema;
    const submit = vi.fn();
    render(
      <SchemaForm
        id="device-service-form"
        schema={service}
        schemas={{ launchConfig: launch, secondaryLaunchConfig: secondary }}
        layout="workload"
        deviceEditors
        sidecarEditors
        onSubmit={submit}
        initialValues={{
          name: 'device-service',
          launchConfig: { imageUuid: 'docker:alpine:3.20', devices: ['/dev/null:/dev/main:r'] },
          secondaryLaunchConfigs: [
            {
              name: 'helper',
              imageUuid: 'docker:alpine:3.20',
              devices: ['/dev/null:/dev/helper:rwm'],
            },
          ],
        }}
      />,
    );
    const hosts = screen.getAllByLabelText('Caminho no host 1');
    const targets = screen.getAllByLabelText('Caminho no container 1');
    expect(hosts).toHaveLength(2);
    expect(targets.map((input) => (input as HTMLInputElement).value)).toEqual([
      '/dev/main',
      '/dev/helper',
    ]);
    fireEvent.change(hosts[0], { target: { value: '/dev/zero' } });
    fireEvent.submit(document.getElementById('device-service-form')!);
    expect(submit).toHaveBeenCalledWith({
      name: 'device-service',
      launchConfig: { imageUuid: 'docker:alpine:3.20', devices: ['/dev/zero:/dev/main:r'] },
      secondaryLaunchConfigs: [
        { name: 'helper', imageUuid: 'docker:alpine:3.20', devices: ['/dev/null:/dev/helper:rwm'] },
      ],
    });
  });

  it('rechecks the native create schema and persists the unchanged mapping through the actual creation component', async () => {
    const user = userEvent.setup();
    renderCreator();
    await user.type(screen.getByLabelText('Nome'), 'device-fixture');
    await user.type(screen.getByLabelText('Imagem *'), 'alpine:3.20');
    await user.click(screen.getByText(/Configuração avançada/));
    await user.click(screen.getByRole('button', { name: 'Adicionar dispositivo' }));
    await user.type(screen.getByLabelText('Caminho no host 1'), '/dev/null');
    await user.type(screen.getByLabelText('Caminho no container 1'), '/dev/fixture');
    await user.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(backend.posts).toHaveLength(1));
    expect(backend.allPages).toHaveBeenCalledWith('projects/p1/schemas');
    expect(backend.posts[0]).toEqual({
      name: 'device-fixture',
      imageUuid: 'docker:alpine:3.20',
      devices: ['/dev/null:/dev/fixture:rwm'],
    });
  });

  it('rejects loss of the fresh devices type before native POST and retains the draft', async () => {
    const user = userEvent.setup();
    renderCreator('en-US');
    await user.type(screen.getByLabelText('Nome'), 'device-fixture');
    await user.type(screen.getByLabelText('Imagem *'), 'alpine:3.20');
    await user.click(screen.getByText(/Configuração avançada/));
    await user.click(screen.getByRole('button', { name: 'Add device' }));
    await user.type(screen.getByLabelText('Host path 1'), '/dev/null');
    await user.type(screen.getByLabelText('Container path 1'), '/dev/fixture');
    backend.refreshed = [
      {
        ...container,
        resourceFields: {
          ...container.resourceFields,
          devices: { type: 'array[int]', create: true },
        },
      },
    ];
    await user.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The current contract does not allow device mappings during creation.',
    );
    expect(backend.allPages).toHaveBeenCalledWith('projects/p1/schemas');
    expect(backend.posts).toEqual([]);
    expect(screen.getByLabelText('Host path 1')).toHaveValue('/dev/null');
    expect(screen.getByLabelText('Container path 1')).toHaveValue('/dev/fixture');
    expect(screen.getByLabelText('Nome')).toHaveValue('device-fixture');
  });

  it('keeps device validation errors as keys so inline and submit feedback follow a language change', async () => {
    const submit = vi.fn(),
      user = userEvent.setup();
    function ChangeLanguage() {
      const { setLocale } = useI18n();
      return <button onClick={() => setLocale('pt-BR')}>Change language</button>;
    }
    render(
      <I18nProvider policy={localization} identity="device-fixture-admin">
        <ChangeLanguage />
        <SchemaForm
          id="device-error-form"
          schema={container}
          schemas={{}}
          deviceEditors
          onSubmit={submit}
          initialValues={{ devices: ['/dev/null:/dev/shared:r', '/dev/zero:/dev/shared:r'] }}
        />
      </I18nProvider>,
    );
    fireEvent.submit(document.getElementById('device-error-form')!);
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    for (const alert of screen.getAllByRole('alert'))
      expect(alert).toHaveTextContent('Each device mapping must have a different container path.');
    await user.click(screen.getByRole('button', { name: 'Change language' }));
    for (const alert of screen.getAllByRole('alert'))
      expect(alert).toHaveTextContent(
        'Cada mapeamento de dispositivo precisa ter um caminho de container diferente.',
      );
    expect(screen.getByLabelText('Caminho no host 1')).toHaveValue('/dev/null');
  });
});
