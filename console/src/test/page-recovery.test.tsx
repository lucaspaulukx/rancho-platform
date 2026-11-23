import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import {
  isModuleLoadError,
  PageErrorBoundary,
  PageRecovery,
  RouteRecovery,
} from '../components/PageErrorBoundary';

describe('Recuperação de página', () => {
  it('reconhece falhas de módulos de diferentes navegadores e CSS sem confundir erros de API', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: /console/assets/Groups-old.js',
      'Importing a module script failed.',
      'error loading dynamically imported module',
      'Loading chunk group-1 failed.',
      'Unable to preload CSS for /console/assets/old.css',
    ])
      expect(isModuleLoadError(new TypeError(message))).toBe(true);
    expect(isModuleLoadError(new Error('HTTP403'))).toBe(false);
    expect(isModuleLoadError(null)).toBe(false);
  });
  it('não expõe mensagem, URL privada ou stacktrace recebida', () => {
    render(<PageRecovery error={new Error('synthetic-private-url-and-payload')} />);
    expect(screen.getByRole('button', { name: 'Recarregar console' })).toBeVisible();
    expect(screen.queryByText(/synthetic-private/)).not.toBeInTheDocument();
    expect(screen.getByText(/Alterações não salvas/)).toBeVisible();
  });
  it('captura falha de render e permite recuperação ao mudar a chave de rota', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never {
      throw new TypeError('Failed to fetch dynamically imported module: synthetic-private');
    }
    try {
      const view = render(
        <PageErrorBoundary key="groups">
          <Broken />
        </PageErrorBoundary>,
      );
      expect(
        screen.getByRole('heading', { name: 'Não foi possível carregar esta página' }),
      ).toBeVisible();
      view.rerender(
        <PageErrorBoundary key="users">
          <p>Outra página</p>
        </PageErrorBoundary>,
      );
      expect(screen.getByText('Outra página')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Recarregar console' })).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
  it('substitui o erro padrão do router por recuperação sanitizada', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        loader: () => {
          throw new Error('synthetic-private');
        },
        errorElement: <RouteRecovery />,
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('button', { name: 'Recarregar console' })).toBeVisible();
    expect(
      screen.queryByText(/Unexpected Application Error|synthetic-private/),
    ).not.toBeInTheDocument();
  });
});
