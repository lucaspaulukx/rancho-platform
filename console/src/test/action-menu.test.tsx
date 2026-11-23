import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionMenu } from '../components/ActionMenu';

describe('Menu de ações compartilhado', () => {
  it('abre por teclado, ignora itens desabilitados e devolve foco com Escape', async () => {
    render(
      <ActionMenu
        label="Ações de web"
        actions={[
          { id: 'logs', label: 'Ver logs', onSelect: vi.fn() },
          { id: 'terminal', label: 'Terminal indisponível', disabled: true, onSelect: vi.fn() },
          { id: 'restart', label: 'Reiniciar', onSelect: vi.fn() },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Ações de web' });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Ver logs' })).toHaveFocus();
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Ver logs' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Reiniciar' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Ver logs' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('seleciona uma vez, fecha e não aciona ações ao clicar fora', async () => {
    const choose = vi.fn();
    render(
      <>
        <button>Outro controle</button>
        <ActionMenu label="Ações" actions={[{ id: 'logs', label: 'Ver logs', onSelect: choose }]} />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ações' }));
    expect(screen.getByRole('menuitem', { name: 'Ver logs' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Outro controle' }));
    expect(choose).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ações' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ver logs' }));
    expect(choose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
