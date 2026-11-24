import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/provider';
import { CatalogPage } from '../pages/Catalog';

vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'demo',
    project: { id: 'p1', name: 'Demo environment', orchestration: 'cattle' },
  }),
  useDataKey: (...parts: unknown[]) => ['catalog-test', ...parts],
}));
vi.mock('../hooks/useEnvironmentCatalogAccess', () => ({
  useEnvironmentCatalogAccess: () => ({ allowed: true }),
}));
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  allPages: async () => {
    const { ApiError } = await import('../request-errors');
    throw new ApiError(503);
  },
}));

it('keeps the localized catalog heading and environment visible when the service fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <I18nProvider
          policy={{
            enabled: true,
            defaultLocale: 'en-US',
            availableLocales: ['en-US'],
            preview: true,
            selectable: false,
            detectBrowser: false,
          }}
        >
          <CatalogPage />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  try {
    expect(screen.getByRole('heading', { name: 'Catalog', level: 1 })).toBeVisible();
    await screen.findByText('The request could not be completed.');
    expect(screen.getByRole('heading', { name: 'Catalog', level: 1 })).toBeVisible();
    expect(screen.getByText('Demo environment')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  } finally {
    view.unmount();
    client.clear();
  }
});
