import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchemaForm } from '../components/SchemaForm';
import type { Schema } from '../api';

describe('Rascunho inválido nos recursos compartilhados', () => {
  it.each([
    ['cpuQuota', 'Quota de CPU (µs)'],
    ['memory', 'Limite de memória: valor'],
  ])('primeira entrada inválida em %s marca alteração e bloqueia envio', async (name, label) => {
    const user = userEvent.setup(),
      dirty = vi.fn(),
      submit = vi.fn();
    const schema = {
      id: 'launchConfig',
      links: {},
      resourceFields: { [name]: { type: 'int', create: true, nullable: true } },
    } as unknown as Schema;
    render(
      <>
        <SchemaForm
          schema={schema}
          schemas={{ launchConfig: schema }}
          resourceEditors
          layout="workload"
          id="resource-draft"
          onDirtyChange={dirty}
          onSubmit={submit}
        />
        <button type="submit" form="resource-draft">
          Salvar rascunho
        </button>
      </>,
    );
    await user.click(screen.getByText('Recursos', { exact: true }));
    const input = screen.getByLabelText(label);
    await user.type(input, 'x');
    expect(input).toHaveValue('x');
    expect(input).toBeInvalid();
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(submit).not.toHaveBeenCalled();
  });
});
