import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { About } from '../components/About';
import { moduleNames } from '../config';
const state = vi.hoisted(() => ({ enabled: true, branding: true }));
vi.mock('../state', () => ({
  useApp: () => ({
    config: {
      branding: state.branding,
      classicUrl: 'http://localhost:18080/',
      modules: Object.fromEntries(
        moduleNames.map((n) => [n, n === 'about' ? state.enabled : false]),
      ),
    },
    server: {
      requested: { OIDC_ENABLED: true, SCHEMA_MIGRATIONS_ENABLED: false },
      effective: {
        OIDC_ENABLED: true,
        SCHEMA_MIGRATIONS_ENABLED: false,
        unexpectedSecret: 'synthetic-private',
      },
      available: { OIDC_ENABLED: true },
      clientSecret: 'synthetic-private',
    },
  }),
}));
vi.mock('../theme', () => ({ useTheme: () => ({ dark: true }) }));
beforeEach(() => {
  state.enabled = true;
  state.branding = true;
});
describe('Sobre e capacidades', () => {
  it('mantém identidade Rancher/comunidade e versão da console, sem afirmar versão detectada', () => {
    render(<About open onClose={vi.fn()} />);
    expect(screen.getByAltText('Rancher')).toBeInTheDocument();
    expect(screen.getByText('Community Console')).toBeInTheDocument();
    expect(screen.getByText('Base do laboratório')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir Rancher clássico' })).toHaveAttribute(
      'href',
      'http://localhost:18080/',
    );
  });
  it('capacidade só mostra chaves conhecidas booleanas sem segredo ou controles de edição', async () => {
    render(<About open onClose={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Capacidades' }));
    expect(screen.getByText('Autenticação OIDC')).toBeInTheDocument();
    expect(screen.getByText('Versionamento das tabelas da comunidade')).toBeInTheDocument();
    expect(screen.queryByText(/synthetic-private|unexpectedSecret/)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Chaves de API')).toBeInTheDocument();
  });
  it('flag bloqueia o modal mesmo com estado aberto', () => {
    state.enabled = false;
    render(<About open onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('branding desligado preserva Rancher e omite atribuição customizada', () => {
    state.branding = false;
    render(<About open onClose={vi.fn()} />);
    expect(screen.getByAltText('Rancher')).toBeInTheDocument();
    expect(screen.queryByText('Community Console')).not.toBeInTheDocument();
  });
});
