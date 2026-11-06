import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ResourceMetrics } from '../components/ResourceMetrics';
import { ResourceStream } from '../components/ResourceStream';
import type { Resource } from '../api';
import { I18nProvider, useI18n } from '../i18n/provider';
const context = vi.hoisted(() => ({
  server: { effective: { METRICS_PAYLOAD_TRANSPORT_ENABLED: false } },
  identity: 'fixture',
  project: { id: '1a12', name: 'Fixture' },
  config: {
    classicUrl: 'http://localhost:18080',
    modules: {
      observability: true,
      metrics: true,
      metricsPayloadTransport: false,
      serviceMetrics: false,
      workloads: true,
      contextActions: true,
    },
  },
}));
vi.mock('../state', () => ({
  useApp: () => context,
}));
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    loadAddon() {}
    open() {}
    onData() {}
    focus() {}
    write() {}
    dispose() {}
  },
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
  },
}));
class Socket {
  static instances: Socket[] = [];
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: ((event?: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });
  constructor() {
    Socket.instances.push(this);
  }
}
const resource: Resource = {
  id: '1i1',
  type: 'container',
  name: 'fixture',
  state: 'running',
  accountId: '1a12',
  externalId: 'fixture-docker',
  links: {
    self: '/v2-beta/projects/1a12/containers/1i1',
    stats: '/v2-beta/projects/1a12/containers/1i1/stats',
  },
  actions: {
    execute: '/v2-beta/projects/1a12/containers/1i1?action=execute',
    logs: '/v2-beta/projects/1a12/containers/1i1?action=logs',
  },
};
function setup() {
  Socket.instances = [];
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.stubGlobal('WebSocket', Socket);
  const fetcher = vi.fn(async (input: string, _options?: RequestInit) =>
    input === resource.links.self
      ? response(resource)
      : response({ url: `${window.location.origin}/v1/connect`, token: 'synthetic-fixture' }),
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
function response(data: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  context.identity = 'fixture';
  context.project = { id: '1a12', name: 'Fixture' };
  context.config.modules.observability = true;
  context.config.modules.metrics = true;
  context.config.modules.metricsPayloadTransport = false;
  context.config.modules.serviceMetrics = false;
  context.server.effective.METRICS_PAYLOAD_TRANSPORT_ENABLED = false;
});
describe('Revogação de conexões já abertas', () => {
  it('preserva a conexão de logs e o filtro ao trocar de idioma', async () => {
    const fetcher = setup();
    function Viewer() {
      const { setLocale } = useI18n();
      return (
        <ResourceStream
          resource={resource}
          mode="logs"
          onClose={vi.fn()}
          context={<button onClick={() => setLocale('en-US')}>English</button>}
        />
      );
    }
    const view = render(
      <I18nProvider
        policy={{
          enabled: true,
          defaultLocale: 'pt-BR',
          availableLocales: ['pt-BR', 'en-US'],
          selectable: true,
          detectBrowser: false,
          preview: true,
        }}
      >
        <Viewer />
      </I18nProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(Socket.instances).toHaveLength(1));
    const socket = Socket.instances[0];
    const filter = screen.getByRole('textbox', { name: 'Filtrar logs' });
    fireEvent.change(filter, { target: { value: 'fixture' } });
    fetcher.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('textbox', { name: 'Filter logs' })).toBe(filter);
    expect(filter).toHaveValue('fixture');
    expect(Socket.instances).toEqual([socket]);
    expect(socket.close).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    view.unmount();
  });
  it.each(['logs', 'execute', 'metrics'] as const)(
    'encerra %s ao desativar observabilidade sem novas requisições',
    async (mode) => {
      const fetcher = setup();
      const panel = () =>
        mode === 'metrics' ? (
          <ResourceMetrics resource={resource} onClose={vi.fn()} />
        ) : (
          <ResourceStream resource={resource} mode={mode} onClose={vi.fn()} />
        );
      const view = render(panel());
      if (mode === 'execute')
        fireEvent.click(screen.getByRole('button', { name: 'Conectar ao container' }));
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => expect(Socket.instances).toHaveLength(1));
      fetcher.mockClear();
      context.config.modules.observability = false;
      view.rerender(panel());
      expect(Socket.instances[0].close).toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      view.unmount();
    },
  );
  it('troca de identidade encerra terminal e exige novo consentimento para executar', async () => {
    const fetcher = setup();
    const panel = () => <ResourceStream resource={resource} mode="execute" onClose={vi.fn()} />;
    const view = render(panel());
    fireEvent.click(screen.getByRole('button', { name: 'Conectar ao container' }));
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(Socket.instances).toHaveLength(1));
    fetcher.mockClear();
    context.identity = 'other-user';
    view.rerender(panel());
    expect(Socket.instances[0].close).toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Conectar ao container' })).toBeVisible();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('limpa histórico e não reconecta métricas do environment anterior', async () => {
    const fetcher = setup();
    const view = render(<ResourceMetrics resource={resource} onClose={vi.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(Socket.instances).toHaveLength(1));
    act(() =>
      Socket.instances[0].onmessage?.({
        data: JSON.stringify([
          {
            id: resource.externalId,
            resourceType: 'container',
            timestamp: '2026-10-21T12:00:00Z',
            memory: { usage: 0, limit: 0 },
          },
        ]),
      }),
    );
    expect(screen.getByText('Limite reportado: 0 MiB.')).toBeInTheDocument();
    fetcher.mockClear();
    context.project = { id: '1a7', name: 'Other environment' };
    view.rerender(<ResourceMetrics resource={resource} onClose={vi.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(Socket.instances[0].close).toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.queryByText('Limite reportado: 0 MiB.')).not.toBeInTheDocument();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('limpa logs e não reconecta o recurso ao trocar de environment', async () => {
    const fetcher = setup();
    const view = render(<ResourceStream resource={resource} mode="logs" onClose={vi.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(Socket.instances).toHaveLength(1));
    act(() => Socket.instances[0].onmessage?.({ data: '01previous-environment-log' }));
    expect(screen.getByText('previous-environment-log')).toBeInTheDocument();
    fetcher.mockClear();
    context.project = { id: '1a7', name: 'Other environment' };
    view.rerender(<ResourceStream resource={resource} mode="logs" onClose={vi.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(Socket.instances[0].close).toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.queryByText('previous-environment-log')).not.toBeInTheDocument();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['logs', 'execute'] as const)(
    'descarta revalidação de %s quando o servidor encerra a conexão',
    async (mode) => {
      setup();
      const view = render(<ResourceStream resource={resource} mode={mode} onClose={vi.fn()} />);
      if (mode === 'execute')
        fireEvent.click(screen.getByRole('button', { name: 'Conectar ao container' }));
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => expect(Socket.instances).toHaveLength(1));
      expect(vi.getTimerCount()).toBe(1);
      act(() => Socket.instances[0].onclose?.());
      expect(vi.getTimerCount()).toBe(0);
      view.unmount();
    },
  );
  it.each(['logs', 'execute', 'metrics'] as const)(
    'explica a revogação de %s sem reconectar automaticamente',
    async (mode) => {
      setup();
      const view = render(
        mode === 'metrics' ? (
          <ResourceMetrics resource={resource} onClose={vi.fn()} />
        ) : (
          <ResourceStream resource={resource} mode={mode} onClose={vi.fn()} />
        ),
      );
      if (mode === 'execute')
        fireEvent.click(screen.getByRole('button', { name: 'Conectar ao container' }));
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => expect(Socket.instances).toHaveLength(1));
      act(() => Socket.instances[0].onclose?.({ code: 1008 }));
      expect(
        screen.getByText(/sua sessão ou permissão não está mais disponível/),
      ).toBeInTheDocument();
      expect(vi.getTimerCount()).toBe(0);
      await act(async () => {
        await Promise.resolve();
      });
      expect(Socket.instances).toHaveLength(1);
      view.unmount();
    },
  );
  it.each([
    [false, false],
    [true, false],
    [false, true],
  ])(
    'mantém transporte legado sem opt-in quando frontend=%s e backend=%s',
    async (frontend, backend) => {
      const fetcher = setup();
      context.config.modules.metricsPayloadTransport = frontend;
      context.server.effective.METRICS_PAYLOAD_TRANSPORT_ENABLED = backend;
      const view = render(<ResourceMetrics resource={resource} onClose={vi.fn()} />);
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => expect(Socket.instances).toHaveLength(1));
      const request = fetcher.mock.calls.find(([input]) => input === resource.links.stats);
      expect((request?.[1] as RequestInit).headers).not.toHaveProperty('X-Rancher-Stats-Payload');
      act(() => Socket.instances[0].onopen?.());
      expect(Socket.instances[0].send).not.toHaveBeenCalled();
      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it.each(['open', 'closed-before-open', 'unmounted-before-open'] as const)(
    'envia o payload de métricas uma vez e o descarta: %s',
    async (caseName) => {
      const fetcher = setup();
      context.config.modules.metricsPayloadTransport = true;
      context.server.effective.METRICS_PAYLOAD_TRANSPORT_ENABLED = true;
      const part = (value: unknown) =>
        btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const envelope = `${part({ alg: 'RS256' })}.${part({ payload: true })}.publicFixtureSignature`;
      const payload = `${part({ alg: 'RS256' })}.${part({ service: [], fixture: 'x'.repeat(10000) })}.publicFixtureSignature`;
      fetcher.mockImplementation(async (input: string) =>
        response(
          input === resource.links.self
            ? resource
            : { url: `${location.origin}/v1/containerstats/service/`, token: envelope, payload },
        ),
      );
      const view = render(<ResourceMetrics resource={resource} onClose={vi.fn()} />);
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => expect(Socket.instances).toHaveLength(1));
      const request = fetcher.mock.calls.find(([input]) => input === resource.links.stats);
      expect((request?.[1] as RequestInit).headers).toMatchObject({
        'X-Rancher-Stats-Payload': '1',
      });
      const socket = Socket.instances[0];
      if (caseName === 'closed-before-open') act(() => socket.onclose?.());
      if (caseName === 'unmounted-before-open') view.unmount();
      act(() => {
        socket.onopen?.();
        socket.onopen?.();
      });
      expect(socket.send).toHaveBeenCalledTimes(caseName === 'open' ? 1 : 0);
      if (caseName === 'open') expect(socket.send).toHaveBeenCalledWith(payload);
      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it('distingue limite de memória zero de limite ausente no painel', async () => {
    setup();
    const view = render(<ResourceMetrics resource={resource} onClose={vi.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(Socket.instances).toHaveLength(1));
    act(() => {
      Socket.instances[0].onmessage?.({
        data: JSON.stringify([
          {
            id: resource.externalId,
            resourceType: 'container',
            timestamp: '2026-10-21T12:00:00Z',
            memory: { usage: 0, limit: 0 },
          },
        ]),
      });
    });
    expect(screen.getByText('Limite reportado: 0 MiB.')).toBeInTheDocument();
    expect(screen.queryByText('O agente não reportou limite de memória.')).not.toBeInTheDocument();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('fecha métricas após o endpoint perder a permissão e descarta o socket ao desmontar', async () => {
    const fetcher = setup();
    const view = render(<ResourceMetrics resource={resource} onClose={vi.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(Socket.instances).toHaveLength(1));
    act(() => Socket.instances[0].onopen?.());
    fetcher.mockImplementation(async () => response({ code: 'PermissionDenied' }, 403));
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });
    await screen.findByText(/métricas foram encerradas/);
    expect(Socket.instances[0].close).toHaveBeenCalled();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('fecha terminal após downgrade para readonly mesmo com GET do container autorizado', async () => {
    const fetcher = setup();
    const view = render(<ResourceStream resource={resource} mode="execute" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conectar ao container' }));
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(Socket.instances).toHaveLength(1));
    act(() => Socket.instances[0].onopen?.());
    fetcher.mockImplementation(async () =>
      response({ ...resource, actions: { logs: resource.actions!.logs } }),
    );
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });
    await screen.findByText(/recurso não está mais disponível ou seu acesso expirou/);
    expect(Socket.instances[0].close).toHaveBeenCalled();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Drawer de métricas de serviço', () => {
  const base = '/v2-beta/projects/1a12/services/1s1';
  const service: Resource = {
    id: '1s1',
    type: 'service',
    name: 'web',
    accountId: '1a12',
    state: 'active',
    links: { self: base, instances: base + '/instances', containerStats: base + '/containerstats' },
  };
  const a: Resource = { ...resource, name: 'web-1', serviceIds: ['1s1'] };
  const b: Resource = { ...a, id: '1i2', name: 'web-2', externalId: 'docker-fixture-two' };
  const install = (rows: () => Resource[]) => {
    setup();
    const fetcher = vi.fn(async (input: string) => {
      if (input === base) return response(service);
      if (input === base + '/instances?limit=65') return response({ data: rows() });
      if (input === base + '/containerstats')
        return response({
          url: location.origin + '/v1/containerstats/service',
          token: 'synthetic-service',
        });
      throw new Error('Unexpected fixture endpoint');
    });
    vi.stubGlobal('fetch', fetcher);
    return fetcher;
  };
  it('não busca descritores nem conecta quando a flag está desligada', () => {
    const fetcher = install(() => [a]);
    render(<ResourceMetrics resource={service} onClose={vi.fn()} />);
    expect(screen.getByText('Métricas desativadas')).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    expect(Socket.instances).toHaveLength(0);
  });
  it('seleciona séries do mesmo socket sem misturar réplicas nem sair do drawer', async () => {
    context.config.modules.serviceMetrics = true;
    install(() => [a, b]);
    const view = render(<ResourceMetrics resource={service} onClose={vi.fn()} />);
    await waitFor(() => expect(Socket.instances).toHaveLength(1));
    const socket = Socket.instances[0];
    act(() =>
      socket.onmessage?.({
        data: JSON.stringify([
          {
            resourceType: 'container',
            id: a.externalId,
            timestamp: '2026-11-05T12:00:01Z',
            memory: { usage: 4 * 1048576 },
          },
          {
            resourceType: 'container',
            id: b.externalId,
            timestamp: '2026-11-05T12:00:01Z',
            memory: { usage: 9 * 1048576 },
          },
          {
            resourceType: 'container',
            id: 'foreign',
            timestamp: '2026-11-05T12:00:01Z',
            memory: { usage: 99 * 1048576 },
          },
        ]),
      }),
    );
    const select = screen.getByLabelText('Container do serviço');
    const memory = screen.getByRole('heading', { name: 'Memória' }).closest('section');
    expect(memory).toHaveTextContent('4MiB');
    expect(screen.getByText(/2 de 2 com amostras/)).toBeInTheDocument();
    fireEvent.change(select, { target: { value: '1i2' } });
    expect(memory).toHaveTextContent('9MiB');
    expect(Socket.instances).toHaveLength(1);
    view.unmount();
    expect(socket.close).toHaveBeenCalled();
  });
  it('encerra o lote se uma réplica é substituída, sem reconectar sozinha', async () => {
    context.config.modules.serviceMetrics = true;
    let rows = [a, b];
    install(() => rows);
    render(<ResourceMetrics resource={service} onClose={vi.fn()} />);
    await waitFor(() => expect(Socket.instances).toHaveLength(1));
    rows = [a, { ...b, externalId: 'replacement-docker' }];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(screen.getByText(/Os containers do serviço mudaram/)).toBeInTheDocument();
    expect(Socket.instances[0].close).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(Socket.instances).toHaveLength(1);
  });
  it('não emite acesso para uma lista que contém container de outro escopo', async () => {
    context.config.modules.serviceMetrics = true;
    const fetcher = install(() => [{ ...a, accountId: '1a99' }]);
    render(<ResourceMetrics resource={service} onClose={vi.fn()} />);
    expect(await screen.findByText(/lista de containers não corresponde/)).toBeInTheDocument();
    expect(fetcher.mock.calls.map(([path]) => path)).not.toContain(base + '/containerstats');
    expect(Socket.instances).toHaveLength(0);
  });
});
