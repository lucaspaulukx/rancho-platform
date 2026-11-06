import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PageErrorBoundary, PageRecovery, RouteRecovery } from '../components/PageErrorBoundary';
import { I18nProvider, useI18n } from '../i18n/provider';

function SwitchLanguage() {
  const { setLocale } = useI18n();
  return <button onClick={() => setLocale('en-US')}>English fixture</button>;
}
function Localized({ children }: { children: ReactNode }) {
  return (
    <I18nProvider
      identity="recovery-localization-fixture"
      policy={{
        enabled: true,
        defaultLocale: 'pt-BR',
        availableLocales: ['pt-BR', 'en-US'],
        selectable: true,
        detectBrowser: false,
        preview: true,
      }}
    >
      <SwitchLanguage />
      {children}
    </I18nProvider>
  );
}

describe('Localized sanitized page recovery', () => {
  it.each([
    [
      new TypeError('Failed to fetch dynamically imported module: sentinel-private-url'),
      'This page could not be loaded',
    ],
    [new Error('sentinel-private-url'), 'This page could not be opened'],
  ])('updates recovery labels in place for %s', async (error, title) => {
    const user = userEvent.setup();
    render(
      <Localized>
        <PageRecovery error={error} />
      </Localized>,
    );
    expect(screen.getByRole('button', { name: 'Recarregar console' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'English fixture' }));
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload console' })).toBeInTheDocument();
    expect(screen.getByText(/Unsaved changes in this tab may be lost/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('sentinel-private-url');
  });

  it('does not retry the failed component when changing language and still resets on a new route key', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let renders = 0;
    function Broken(): never {
      renders++;
      throw new Error('sentinel-private-component');
    }
    try {
      const user = userEvent.setup();
      const view = render(
        <Localized>
          <PageErrorBoundary key="groups">
            <Broken />
          </PageErrorBoundary>
        </Localized>,
      );
      const failedAttempts = renders;
      expect(failedAttempts).toBeGreaterThan(0);
      await user.click(screen.getByRole('button', { name: 'English fixture' }));
      expect(
        screen.getByRole('heading', { name: 'This page could not be opened' }),
      ).toBeInTheDocument();
      expect(renders).toBe(failedAttempts);
      expect(document.body).not.toHaveTextContent('sentinel-private-component');
      view.rerender(
        <Localized>
          <PageErrorBoundary key="users">
            <p>Fixture recovered route</p>
          </PageErrorBoundary>
        </Localized>,
      );
      expect(screen.getByText('Fixture recovered route')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reload console' })).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('uses safe pt-BR defaults when a root router error replaces the provider subtree', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        loader: () => {
          throw new Error('sentinel-private-route');
        },
        element: (
          <Localized>
            <p>Unreachable page</p>
          </Localized>
        ),
        errorElement: <RouteRecovery />,
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('button', { name: 'Recarregar console' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Não foi possível abrir esta página' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'English fixture' })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('sentinel-private-route');
  });
});
