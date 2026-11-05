import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
function Draft({ enabled = true }: { enabled?: boolean }) {
  const [value, setValue] = useState(''),
    [pending, setPending] = useState(false);
  usePageLeaveGuard(!!value || pending, enabled);
  return (
    <>
      <label>
        Rascunho
        <input value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button
        onClick={() => {
          setValue('');
          setPending(true);
        }}
      >
        Enviar
      </button>
      <button onClick={() => setPending(false)}>Concluir</button>
    </>
  );
}
function leave() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
describe('Cobertura adicional de saída da página', () => {
  it('permite página limpa e protege o rascunho sem armazenar seu conteúdo', async () => {
    render(<Draft />);
    expect(leave()).toBe(false);
    await userEvent.type(screen.getByLabelText('Rascunho'), 'synthetic draft');
    expect(leave()).toBe(true);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
  it('protege envio pendente mesmo quando o rascunho foi limpo e libera ao terminar', async () => {
    render(<Draft />);
    await userEvent.click(screen.getByText('Enviar'));
    expect(screen.getByLabelText('Rascunho')).toHaveValue('');
    expect(leave()).toBe(true);
    await userEvent.click(screen.getByText('Concluir'));
    expect(leave()).toBe(false);
  });
  it('remove e repõe a cobertura ao mudar a flag sem perder o rascunho', () => {
    const view = render(<Draft />);
    fireEvent.change(screen.getByLabelText('Rascunho'), { target: { value: 'draft' } });
    expect(leave()).toBe(true);
    view.rerender(<Draft enabled={false} />);
    expect(leave()).toBe(false);
    expect(screen.getByLabelText('Rascunho')).toHaveValue('draft');
    view.rerender(<Draft enabled />);
    expect(leave()).toBe(true);
  });
  it('remove o listener ao desmontar o contexto e não deixa a próxima tela bloqueada', () => {
    const view = render(<Draft />);
    fireEvent.change(screen.getByLabelText('Rascunho'), { target: { value: 'draft' } });
    expect(leave()).toBe(true);
    view.unmount();
    expect(leave()).toBe(false);
  });
  it('retirar alterações libera o fechamento sem aguardar nova navegação', () => {
    render(<Draft />);
    fireEvent.change(screen.getByLabelText('Rascunho'), { target: { value: 'draft' } });
    expect(leave()).toBe(true);
    fireEvent.change(screen.getByLabelText('Rascunho'), { target: { value: '' } });
    expect(leave()).toBe(false);
  });
});
