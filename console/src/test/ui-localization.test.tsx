import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, useI18n } from '../i18n/provider';
import { Confirm, DataTable, ErrorState, Loading, ToastProvider, useToast } from '../components/ui';

function English({ children }: { children: ReactNode }) {
  return (
    <I18nProvider
      identity="ui-localization-test"
      policy={{
        enabled: true,
        defaultLocale: 'en-US',
        selectable: true,
        availableLocales: ['pt-BR', 'en-US'],
        detectBrowser: false,
        preview: true,
      }}
    >
      {children}
    </I18nProvider>
  );
}
function SwitchToPortuguese() {
  const { setLocale } = useI18n();
  return <button onClick={() => setLocale('pt-BR')}>Switch to Portuguese</button>;
}

describe('Shared UI localization', () => {
  it('retains pt-BR defaults outside a provider and preserves an explicit loading label', () => {
    const { rerender } = render(<Loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando dados…');
    rerender(
      <English>
        <Loading label="Waiting for an owned fixture" />
      </English>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for an owned fixture');
  });

  it('localizes loading and unknown-error fallback without displaying untrusted object content', async () => {
    const retry = vi.fn(),
      user = userEvent.setup();
    render(
      <English>
        <Loading />
        <ErrorState error={{ privatePayload: 'must-not-be-shown' }} retry={retry} />
      </English>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading data…');
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the data.');
    expect(screen.queryByText('must-not-be-shown')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('preserves caller-supplied empty-state text instead of interpreting it as a translation key', () => {
    render(
      <English>
        <DataTable
          rows={[] as { id: string }[]}
          columns={[]}
          rowKey={(row) => row.id}
          emptyTitle="Synthetic empty title"
          emptyDescription="Keep caller wording."
        />
      </English>,
    );
    expect(screen.getByRole('heading', { name: 'Synthetic empty title' })).toBeInTheDocument();
    expect(screen.getByText('Keep caller wording.')).toBeInTheDocument();
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
  });

  it('updates table defaults and accessibility labels while preserving search, sort, page and selected IDs', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 25 }, (_, index) => ({
      id: String(index),
      name: `host${index + 1}`,
    })).reverse();
    function Table() {
      const [selection, setSelection] = useState(new Set<string>());
      return (
        <>
          <SwitchToPortuguese />
          <DataTable
            rows={rows}
            columns={[
              {
                key: 'name',
                label: 'Name',
                render: (row) => row.name,
                sortValue: (row) => row.name,
              },
            ]}
            rowKey={(row) => row.id}
            searchText={(row) => row.name}
            selection={selection}
            onSelection={setSelection}
          />
        </>
      );
    }
    render(
      <English>
        <Table />
      </English>,
    );
    expect(screen.getByRole('region', { name: 'Data table' })).toBeInTheDocument();
    expect(screen.getByText('25 records')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search records' }), 'host');
    await user.click(screen.getByRole('button', { name: /Name/ }));
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select host21' }));
    await user.click(screen.getByRole('button', { name: 'Switch to Portuguese' }));
    expect(screen.getByRole('textbox', { name: 'Buscar registros' })).toHaveValue('host');
    expect(screen.getByRole('region', { name: 'Tabela de dados' })).toBeInTheDocument();
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getByText('21–25 de 25')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Selecionar host21' })).toBeChecked();
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('localizes empty defaults and retains the existing Portuguese zero-record plural', async () => {
    const user = userEvent.setup();
    render(
      <English>
        <SwitchToPortuguese />
        <DataTable
          rows={[] as { id: string }[]}
          columns={[]}
          rowKey={(row) => row.id}
          searchText={(row) => row.id}
        />
      </English>,
    );
    expect(screen.getByRole('heading', { name: 'No results' })).toBeInTheDocument();
    expect(screen.getByText('0 records')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch to Portuguese' }));
    expect(screen.getByRole('heading', { name: 'Nenhum resultado' })).toBeInTheDocument();
    expect(screen.getByText('0 registros')).toBeInTheDocument();
  });

  it('changes confirmation/close labels without closing the dialog or discarding its input', async () => {
    const confirm = vi.fn(),
      user = userEvent.setup();
    render(
      <English>
        <Confirm
          open
          onOpenChange={vi.fn()}
          title="Owned confirmation"
          description="Synthetic description"
          onConfirm={confirm}
        >
          <label>
            Operator note
            <input />
          </label>
          <SwitchToPortuguese />
        </Confirm>
      </English>,
    );
    await user.type(screen.getByRole('textbox', { name: 'Operator note' }), 'Preserve this draft');
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch to Portuguese' }));
    expect(screen.getByRole('dialog', { name: 'Owned confirmation' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Operator note' })).toHaveValue(
      'Preserve this draft',
    );
    expect(screen.getByRole('button', { name: 'Fechar diálogo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('translates notification dismissal without replacing an existing caller-supplied message', async () => {
    const user = userEvent.setup();
    function Notification() {
      const toast = useToast();
      return (
        <>
          <button onClick={() => toast('Synthetic native name preserved')}>Notify</button>
          <SwitchToPortuguese />
        </>
      );
    }
    render(
      <English>
        <ToastProvider>
          <Notification />
        </ToastProvider>
      </English>,
    );
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch to Portuguese' }));
    expect(screen.getByText('Synthetic native name preserved')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dispensar notificação' }));
    expect(screen.queryByText('Synthetic native name preserved')).not.toBeInTheDocument();
  });
});
