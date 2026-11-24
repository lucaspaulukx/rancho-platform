import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { HostsPage } from '../pages/Hosts';

vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'demo',
    project: { id: 'p1', name: 'Ambiente de teste' },
    config: { modules: { workloads: false } },
  }),
  useDataKey: (...parts: unknown[]) => ['hosts-page-test', ...parts],
}));
vi.mock('../hooks/useSchemas', () => ({
  useSchemas: () => ({ isPending: false }),
}));
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  allPages: async () => {
    const { ApiError } = await import('../request-errors');
    throw new ApiError(503);
  },
}));

it('keeps a way back to the environment host list when the host inventory fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/hosts/1h7?env=p1']}>
        <Routes>
          <Route path="/hosts/:id" element={<HostsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  try {
    expect(screen.getByRole('heading', { level: 1, name: '1h7' })).toBeVisible();
    await screen.findByRole('alert');
    expect(screen.getByText('Ambiente de teste')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Voltar aos hosts' })).toHaveAttribute(
      'href',
      '/hosts?env=p1',
    );
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  } finally {
    view.unmount();
    client.clear();
  }
});
