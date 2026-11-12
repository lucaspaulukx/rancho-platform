import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { EnvironmentTemplates } from '../components/EnvironmentTemplates';
import {
  EnvironmentEditor,
  environmentTemplateMetadata,
  prepareEnvironmentTemplate,
} from '../components/EnvironmentEditor';
import type { Resource, Schema } from '../api';
import { frFR } from '../i18n/catalogs/fr-FR';
import { I18nProvider } from '../i18n/provider';
vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'fixture-admin',
    project: { id: '1a12' },
    projects: [],
    config: { modules: { catalog: true } },
  }),
}));
const template = {
  id: '1pt5',
  type: 'projectTemplate',
  name: 'Cattle',
  state: 'active',
  links: {},
  stacks: [
    {
      name: 'network-services',
      templateId: 'library:infra*network-services',
      answers: { privateFixture: 'hidden-answer' },
    },
  ],
};
const templateSchema: Schema = {
  id: 'projectTemplate',
  pluralName: 'projecttemplates',
  links: { self: '/v2-beta/schemas/projecttemplate', collection: '/v2-beta/projecttemplates' },
  collectionMethods: ['GET', 'POST'],
  resourceMethods: ['GET', 'PUT', 'DELETE'],
  resourceActions: { remove: {} },
  resourceFields: Object.fromEntries(
    ['name', 'description', 'stacks', 'isPublic'].map((name) => [
      name,
      { type: name === 'isPublic' ? 'boolean' : 'string', create: true, update: true },
    ]),
  ),
};
function managerFixture(
  options: {
    conflict?: boolean;
    schema?: Schema;
    revoke?: boolean;
    noAction?: boolean;
    twoStacks?: boolean;
  } = {},
) {
  const full: Resource & { stacks: Record<string, unknown>[] } = {
    ...template,
    isPublic: true,
    links: { self: '/v2-beta/projecttemplates/1pt5' },
    actions: { remove: '/v2-beta/projecttemplates/1pt5?action=remove' },
    stacks: [
      {
        ...template.stacks[0],
        answers: { ...template.stacks[0].answers, fixture_number: 3 },
        binding: { services: { source: 'native-binding' } },
        dockerCompose: 'fixture-compose',
      },
    ],
  };
  if (options.twoStacks)
    full.stacks.push({
      ...structuredClone(full.stacks[0]),
      name: 'second',
      templateId: 'fixture:second',
    });
  const writes: { path: string; method: string; body: unknown }[] = [];
  let reads = 0;
  const schema = options.schema || templateSchema;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const method = init.method || 'GET';
      if (method !== 'GET') {
        writes.push({ path: String(input), method, body: JSON.parse(String(init.body)) });
        return Response.json(full);
      }
      if (String(input).startsWith('/v1-catalog/templates?'))
        return Response.json({
          data: [
            {
              id: 'fixture:infra*test',
              name: 'Fixture Infra',
              templateBase: 'infra',
              defaultName: 'fixture-infra',
              links: { self: '/v1-catalog/templates/fixture' },
            },
          ],
        });
      if (String(input) === '/v1-catalog/templates/fixture')
        return Response.json({
          id: 'fixture:infra*test',
          name: 'Fixture Infra',
          defaultVersion: '1.0',
          links: {},
          versionLinks: { '1.0': '/v1-catalog/templateversions/fixture:1' },
        });
      if (String(input) === '/v1-catalog/templateversions/fixture:1')
        return Response.json({
          id: 'fixture:infra*test:1',
          templateId: 'fixture:infra*test',
          version: '1.0',
          files: { 'docker-compose.yml': 'services: {}' },
          questions: [
            { variable: 'replicas', label: 'Replicas', type: 'int', default: 2, required: true },
            { variable: 'password', label: 'Password', type: 'password', default: '' },
          ],
        });
      if (String(input).includes('/schemas/'))
        return Response.json(
          options.revoke
            ? { ...schema, resourceMethods: ['GET'], collectionMethods: ['GET'] }
            : schema,
        );
      if (String(input) === '/v2-beta/projecttemplates/1pt5') {
        reads++;
        return Response.json({
          ...full,
          ...(options.conflict && reads > 1 ? { name: 'Concurrent change' } : {}),
          ...(options.noAction ? { actions: {} } : {}),
        });
      }
      return Response.json({ data: [full] });
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([
    { path: '/', element: <EnvironmentTemplates schema={schema} onClose={vi.fn()} /> },
  ]);
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, view, writes, full };
}
describe('Gestao nativa de templates', () => {
  it('nao transfere um rascunho numerico vazio para a stack seguinte ao remover uma linha', async () => {
    const { writes } = managerFixture({ twoStacks: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir template Cattle' }));
    await userEvent.clear(await screen.findByLabelText('Parametro fixture_number da stack 1'));
    await userEvent.click(screen.getByRole('button', { name: 'Remover stack 1' }));
    expect(screen.getByLabelText('Parametro fixture_number da stack 1')).toHaveValue(3);
    expect(screen.getByLabelText('Nome da stack 1')).toHaveValue('second');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({
      stacks: [{ name: 'second', answers: { fixture_number: 3 } }],
    });
  });
  it('nao grava zero ao apagar um parametro numerico e aceita um decimal negativo', async () => {
    const { writes } = managerFixture();
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir template Cattle' }));
    const input = await screen.findByLabelText('Parametro fixture_number da stack 1');
    await userEvent.clear(input);
    expect(input).toHaveValue(null);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    expect(writes).toEqual([]);
    await userEvent.type(input, '-4.5');
    expect(input).toHaveValue(-4.5);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({ stacks: [{ answers: { fixture_number: -4.5 } }] });
  });
  it('cria um template Compose privado com os dois arquivos nativos', async () => {
    const { writes } = managerFixture();
    await userEvent.click(await screen.findByRole('button', { name: 'Criar template' }));
    await userEvent.type(screen.getByLabelText('Nome do template *'), 'Compose fixture');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar stack Compose' }));
    await userEvent.type(screen.getByLabelText('Nome da stack 1'), 'web');
    await userEvent.click(screen.getByLabelText('Docker Compose da stack 1'));
    await userEvent.paste('version: "2"\nservices:\n  web:\n    image: busybox:1.36.1\n');
    await userEvent.click(screen.getByLabelText('Rancher Compose da stack 1'));
    await userEvent.paste('version: "2"\nservices:\n  web:\n    scale: 0\n');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({
      name: 'Compose fixture',
      isPublic: false,
      stacks: [
        {
          name: 'web',
          dockerCompose: expect.stringContaining('busybox:1.36.1'),
          rancherCompose: expect.stringContaining('scale: 0'),
        },
      ],
    });
  });
  it('exige consentimento separado antes de tornar o template publico', async () => {
    const { writes } = managerFixture();
    await userEvent.click(await screen.findByRole('button', { name: 'Criar template' }));
    await userEvent.type(screen.getByLabelText('Nome do template *'), 'Public fixture');
    await userEvent.click(screen.getByLabelText('Visibilidade do template'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    expect(await screen.findByRole('heading', { name: 'Publicar template?' })).toBeInTheDocument();
    expect(writes).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(writes).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({ name: 'Public fixture', isPublic: true });
  });
  it('seleciona infraestrutura e versao do catalogo sem lancar a stack', async () => {
    const { writes } = managerFixture();
    await userEvent.click(await screen.findByRole('button', { name: 'Criar template' }));
    await userEvent.type(screen.getByLabelText('Nome do template *'), 'New');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar stack do catalogo' }));
    await userEvent.selectOptions(
      await screen.findByLabelText('Template de infraestrutura'),
      'fixture:infra*test',
    );
    expect(await screen.findByLabelText('Replicas *')).toHaveValue(2);
    await userEvent.type(screen.getByLabelText('Password'), 'catalog-private');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar stack' }));
    expect(writes).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toEqual({
      name: 'New',
      description: '',
      isPublic: false,
      stacks: [
        {
          name: 'fixture-infra',
          templateId: 'fixture:infra*test',
          templateVersionId: 'fixture:infra*test:1',
          answers: { replicas: 2, password: 'catalog-private' },
        },
      ],
    });
  });
  it('nao inicia a gravacao depois que o editor foi desmontado durante a releitura de permissao', async () => {
    const { writes, view } = managerFixture();
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir template Cattle' }));
    await screen.findByLabelText('Nome do template *');
    const originalFetch = globalThis.fetch;
    let release: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init: RequestInit = {}) =>
        String(input).includes('/schemas/')
          ? new Promise<Response>((resolve) => {
              release = resolve;
            })
          : originalFetch(input, init),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    await waitFor(() => expect(release).toBeDefined());
    view.unmount();
    await act(async () => {
      release!(Response.json(templateSchema));
    });
    expect(writes).toEqual([]);
  });
  it('confirma o descarte sem perder o rascunho ao cancelar a confirmacao', async () => {
    managerFixture();
    await userEvent.click(await screen.findByRole('button', { name: 'Criar template' }));
    await userEvent.type(screen.getByLabelText('Nome do template *'), 'Unsaved');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      await screen.findByRole('heading', { name: 'Descartar alteracoes?' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByLabelText('Nome do template *')).toHaveValue('Unsaved');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(screen.queryByLabelText('Nome do template *')).not.toBeInTheDocument(),
    );
  });
  it('edita o payload completo sem colocar respostas ou bindings no cache', async () => {
    const { client, writes, full } = managerFixture();
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir template Cattle' }));
    const name = await screen.findByLabelText('Nome do template *');
    expect(screen.getByLabelText('Parametro privateFixture da stack 1')).toHaveAttribute(
      'type',
      'password',
    );
    await userEvent.clear(name);
    await userEvent.type(name, 'Edited');
    const cache = JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
    );
    expect(cache).not.toContain('hidden-answer');
    expect(cache).not.toContain('native-binding');
    expect(cache).not.toContain('fixture-compose');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      path: '/v2-beta/projecttemplates/1pt5',
      method: 'PUT',
      body: { name: 'Edited', description: '', isPublic: true, stacks: full.stacks },
    });
    await waitFor(() =>
      expect(screen.queryByLabelText('Nome do template *')).not.toBeInTheDocument(),
    );
  });
  it('copia todas as stacks em um novo template privado', async () => {
    const { writes, full } = managerFixture();
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar template Cattle' }));
    expect(await screen.findByLabelText('Nome do template *')).toHaveValue('Cattle-copia');
    expect(screen.getByLabelText('Visibilidade do template')).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      path: '/v2-beta/projecttemplates',
      method: 'POST',
      body: { name: 'Cattle-copia', description: '', isPublic: false, stacks: full.stacks },
    });
  });
  it.each(['conflict', 'revoke'] as const)(
    'impede sobrescrita ou permissao revogada: %s',
    async (reason) => {
      const { writes } = managerFixture({ [reason]: true });
      await userEvent.click(await screen.findByRole('button', { name: 'Abrir template Cattle' }));
      await screen.findByLabelText('Nome do template *');
      await userEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        reason === 'conflict' ? 'alterado por outra operacao' : 'nao esta mais disponivel',
      );
      expect(writes).toEqual([]);
    },
  );
  it('remove somente pela acao nativa revalidada, nunca por DELETE', async () => {
    const { writes } = managerFixture();
    await userEvent.click(await screen.findByRole('button', { name: 'Remover template Cattle' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      path: '/v2-beta/projecttemplates/1pt5?action=remove',
      method: 'POST',
      body: {},
    });
  });
  it('recusa a remocao se o recurso deixou de anunciar a acao', async () => {
    const { writes } = managerFixture({ noAction: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Remover template Cattle' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByRole('alert');
    expect(writes).toEqual([]);
  });
  it('nao oferece comandos de alteracao para schema somente leitura', async () => {
    managerFixture({
      schema: {
        ...templateSchema,
        collectionMethods: ['GET'],
        resourceMethods: ['GET'],
        resourceActions: {},
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir template Cattle' }));
    expect(await screen.findByLabelText('Nome do template *')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Salvar template' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar template' })).not.toBeInTheDocument();
  });
});
describe('Editor de environments com templates nativos', () => {
  it('preserva respostas, bindings e Compose sem mutar as stacks originais', () => {
    const stacks = [
      {
        name: 'web',
        templateId: 'fixture:app',
        templateVersionId: 'fixture:app:1',
        answers: { password: 'private-answer', replicas: 2 },
        binding: { ports: { http: 8080 } },
        dockerCompose: 'services: {}',
        rancherCompose: 'version: 2',
      },
    ];
    const payload = prepareEnvironmentTemplate(' Template ', ' Description ', stacks, false);
    expect(payload).toEqual({
      name: 'Template',
      description: 'Description',
      stacks,
      isPublic: false,
    });
    expect(payload.stacks).not.toBe(stacks);
    (payload.stacks[0].answers as Record<string, unknown>).replicas = 3;
    expect(stacks[0].answers.replicas).toBe(2);
  });
  it('aceita um template vazio e nao envia a visibilidade sem permissao de campo', () => {
    expect(prepareEnvironmentTemplate('Empty', '', [])).toEqual({
      name: 'Empty',
      description: '',
      stacks: [],
    });
    expect(
      prepareEnvironmentTemplate('Compose', '', [{ dockerCompose: 'services: {}' }]).stacks,
    ).toHaveLength(1);
  });
  it('recusa nomes, stacks e respostas invalidos sem incluir valores no erro', () => {
    expect(() => prepareEnvironmentTemplate(' ', '', [])).toThrow('nome');
    expect(() => prepareEnvironmentTemplate('x'.repeat(256), '', [])).toThrow('255');
    expect(() => prepareEnvironmentTemplate('x', 'x'.repeat(1025), [])).toThrow('1024');
    expect(() => prepareEnvironmentTemplate('x', '', Array(101).fill({}))).toThrow('100');
    expect(() => prepareEnvironmentTemplate('x', '', [{}])).toThrow('Compose');
    expect(() =>
      prepareEnvironmentTemplate('x', '', [{ templateId: 'a', answers: ['private-answer'] }]),
    ).toThrow('respostas');
    expect(() =>
      prepareEnvironmentTemplate('x', '', [
        { name: 'same', templateId: 'a' },
        { name: 'same', templateId: 'b' },
      ]),
    ).toThrow('unicos');
  });
  it('retém somente a apresentação do template antes de colocá-lo no cache', () => {
    const metadata = environmentTemplateMetadata(template);
    expect(metadata.stacks).toEqual([
      {
        name: 'network-services',
        templateId: 'library:infra*network-services',
        templateVersionId: '',
      },
    ]);
    expect(JSON.stringify(metadata)).not.toContain('hidden-answer');
    expect(template.stacks[0].answers.privateFixture).toBe('hidden-answer');
  });
  it('preserva o nome e o template selecionado ao trocar o idioma', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ data: [template] })),
    );
    const submit = vi.fn();
    const schema: Schema = {
      id: 'project',
      pluralName: 'projects',
      links: {},
      resourceFields: {
        name: { type: 'string', create: true },
        projectTemplateId: { type: 'reference[projectTemplate]', create: true },
      },
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <I18nProvider
          policy={{
            enabled: true,
            defaultLocale: 'pt-BR',
            availableLocales: ['pt-BR', 'fr-FR'],
            selectable: true,
            detectBrowser: false,
            preview: true,
          }}
        >
          <EnvironmentEditor
            schema={schema}
            schemas={{
              projectTemplate: {
                id: 'projectTemplate',
                pluralName: 'projecttemplates',
                links: { collection: '/v2-beta/projecttemplates' },
                resourceFields: {},
              },
            }}
            onSubmit={submit}
            onDirtyChange={vi.fn()}
          />
        </I18nProvider>
        <button type="submit" form="resource-form">
          Salvar
        </button>
      </QueryClientProvider>,
    );
    const name = await screen.findByLabelText('Nome *');
    const select = screen.getByLabelText('Template do environment');
    await userEvent.type(name, 'new-environment');
    await userEvent.selectOptions(select, '1pt5');
    expect(screen.getByRole('region', { name: 'Infraestrutura do template' })).toHaveTextContent(
      'network-services',
    );
    const key = 'rancho.console.locale.anonymous';
    localStorage.setItem(key, JSON.stringify({ version: 1, locale: 'fr-FR' }));
    fireEvent(window, new StorageEvent('storage', { key }));
    const infrastructure = await screen.findByRole('region', {
      name: frFR['environmentEditor.infrastructure'],
    });
    expect(infrastructure).toHaveTextContent('network-services');
    expect(infrastructure).toHaveTextContent(frFR['environmentEditor.provisionNotice']);
    expect(screen.getByLabelText(`${frFR['schemaForm.label.name']} *`)).toBe(name);
    expect(name).toHaveValue('new-environment');
    expect(select).toHaveValue('1pt5');
    expect(submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(submit).toHaveBeenCalledWith({ name: 'new-environment', projectTemplateId: '1pt5' });
    await waitFor(() =>
      expect(
        JSON.stringify(client.getQueryData(['data', 'fixture-admin', 'environment-templates'])),
      ).not.toContain('hidden-answer'),
    );
    view.unmount();
    client.clear();
  });
});
