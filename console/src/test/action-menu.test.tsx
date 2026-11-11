import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionMenu } from '../components/ActionMenu';
import { I18nProvider } from '../i18n/provider';

describe('Menu de ações compartilhado', () => {
  it('reposiciona um menu aberto em RTL preservando foco sem executar ações', async () => {
    const choose = vi.fn();
    render(
      <I18nProvider
        policy={{
          enabled: true,
          defaultLocale: 'pt-BR',
          availableLocales: ['pt-BR', 'fa-IR'],
          selectable: true,
          detectBrowser: false,
          preview: true,
        }}
      >
        <ActionMenu label="Ações" actions={[{ id: 'logs', label: 'Logs', onSelect: choose }]} />
      </I18nProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Ações' });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 100, 40, 30));
    await userEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '76px' });
    const item = screen.getByRole('menuitem', { name: 'Logs' });
    expect(item).toHaveFocus();
    act(() => {
      localStorage.setItem(
        'rancho.console.locale.anonymous',
        JSON.stringify({ version: 1, locale: 'fa-IR' }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: 'rancho.console.locale.anonymous' }));
    });
    expect(screen.getByRole('menu')).toBe(menu);
    await waitFor(() => expect(menu).toHaveStyle({ left: '300px' }));
    expect(item).toHaveFocus();
    expect(choose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });
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
