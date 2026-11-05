import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ResourceMetrics } from '../components/ResourceMetrics';
import { ResourceStream } from '../components/ResourceStream';
import type { Resource } from '../api';
const context = vi.hoisted(() => ({
  identity: 'fixture',
  project: { id: '1a12', name: 'Fixture' },
  config: {
    classicUrl: 'http://localhost:18080',
    modules: { observability: true, metrics: true },
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
  onclose: (() => void) | null = null;
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
  const fetcher = vi.fn(async (input: string) =>
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
});
describe('Revogação de conexões já abertas', () => {
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
