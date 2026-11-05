import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EnvironmentSwitcher } from '../components/EnvironmentSwitcher';
const projects = [
  { id: '1a1', name: 'Produção', state: 'active', orchestration: 'cattle' },
  { id: '1a2', name: 'Desenvolvimento', state: 'active' },
];
describe('Seletor compartilhado de environment', () => {
  it('busca sem exigir acentos e troca pelo ID usando o teclado', async () => {
    const select = vi.fn();
    render(
      <MemoryRouter>
        <EnvironmentSwitcher projects={projects} currentId="1a2" onSelect={select} />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Environment: Desenvolvimento' });
    await userEvent.click(trigger);
    const search = screen.getByRole('combobox', { name: 'Buscar environment' });
    expect(search).toHaveFocus();
    expect(screen.getByRole('option', { name: /Desenvolvimento/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.type(search, 'producao');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    expect(select).toHaveBeenCalledWith('1a1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('fecha com Escape ou clique externo sem mudar o environment', async () => {
    const select = vi.fn();
    render(
      <MemoryRouter>
        <EnvironmentSwitcher projects={projects} currentId="1a1" onSelect={select} />
        <button>Outro controle</button>
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Environment: Produção' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}{Escape}');
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Outro controle' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
  });
  it('não seleciona uma opção inexistente e respeita a flag de environments', async () => {
    const select = vi.fn();
    render(
      <MemoryRouter>
        <EnvironmentSwitcher
          projects={projects}
          currentId="1a1"
          onSelect={select}
          manageEnabled={false}
        />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Environment: Produção' }));
    await userEvent.type(screen.getByRole('combobox'), 'inexistente');
    expect(screen.getByRole('status')).toHaveTextContent('Nenhum environment encontrado.');
    await userEvent.keyboard('{Enter}');
    expect(select).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /Gerenciar/ })).not.toBeInTheDocument();
  });
  it('mantém o seletor desabilitado quando a conta não tem environments', () => {
    render(
      <MemoryRouter>
        <EnvironmentSwitcher projects={[]} onSelect={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Environment: Sem acesso' })).toBeDisabled();
  });
});
