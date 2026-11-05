import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Schema } from '../api';
import {
  prepareStackCompose,
  validateStackCreation,
  composeByteLimit,
  type StackComposeDraft,
} from '../stack-compose';
import { StackComposeForm } from '../components/StackComposeForm';
const schema = {
  id: 'stack',
  pluralName: 'stacks',
  collectionMethods: ['GET', 'POST'],
  links: {},
  resourceFields: {
    name: { type: 'string', create: true, required: true, maxLength: 63, validChars: 'a-zA-Z0-9-' },
    description: { type: 'string', create: true, maxLength: 1024 },
    dockerCompose: { type: 'string', create: true },
    rancherCompose: { type: 'string', create: true },
    environment: { type: 'map[string]', create: true },
    startOnCreate: { type: 'boolean', create: true },
  },
} as Schema;
const draft: StackComposeDraft = {
  name: 'fixture',
  description: '',
  compose: true,
  dockerCompose: 'version: "2"\nservices:\n  web:\n    image: alpine:3.20\n',
  rancherCompose: 'version: "2"\nservices:\n  web:\n    scale: 0\n',
  startOnCreate: false,
  variables: [{ id: 1, name: 'MESSAGE', value: 'á\n${OTHER}' }],
};
describe('Criação contextual Compose', () => {
  it('não oferece importação quando o schema não permite controlar o início dos serviços', () => {
    render(
      <StackComposeForm
        schema={{
          ...schema,
          resourceFields: {
            ...schema.resourceFields,
            startOnCreate: { type: 'boolean', create: false },
          },
        }}
        onSubmit={vi.fn()}
        onDirtyChange={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    expect(screen.getByRole('option', { name: 'Importar Compose' })).toBeDisabled();
  });
  it('preserva arquivos, valores UTF-8 e início desmarcado sem interpretar YAML/interpolação', () => {
    const payload = prepareStackCompose(schema, draft);
    expect(payload).toEqual({
      name: 'fixture',
      dockerCompose: draft.dockerCompose,
      rancherCompose: draft.rancherCompose,
      environment: { MESSAGE: 'á\n${OTHER}' },
      startOnCreate: false,
    });
  });
  it('stack vazia não envia arquivos, variáveis nem estado de início guardados no rascunho', () => {
    expect(prepareStackCompose(schema, { ...draft, compose: false })).toEqual({ name: 'fixture' });
  });
  it.each(['', 'nome com espaços', 'a'.repeat(64)])('recusa nome inválido %j', (name) => {
    expect(() => prepareStackCompose(schema, { ...draft, name })).toThrow();
  });
  it('mede bytes UTF-8, recusa NUL e não aceita Docker Compose vazio', () => {
    expect(() =>
      prepareStackCompose(schema, {
        ...draft,
        dockerCompose: 'é'.repeat(composeByteLimit / 2 + 1),
      }),
    ).toThrow('512 KiB');
    expect(() => prepareStackCompose(schema, { ...draft, rancherCompose: 'x\0' })).toThrow('nulo');
    expect(() => prepareStackCompose(schema, { ...draft, dockerCompose: '  ' })).toThrow(
      'Docker Compose',
    );
  });
  it('recusa variáveis inválidas ou repetidas sem perder valores vazios', () => {
    expect(() =>
      prepareStackCompose(schema, {
        ...draft,
        variables: [{ id: 1, name: 'BAD-NAME', value: '' }],
      }),
    ).toThrow('nome válido');
    expect(() =>
      prepareStackCompose(schema, {
        ...draft,
        variables: [...draft.variables, { id: 2, name: 'MESSAGE', value: '' }],
      }),
    ).toThrow('duplicada');
    expect(
      prepareStackCompose(schema, { ...draft, variables: [{ id: 1, name: 'EMPTY', value: '' }] })
        .environment,
    ).toEqual({ EMPTY: '' });
  });
  it('recusa perda de POST ou de campo criável no schema relido', () => {
    const payload = prepareStackCompose(schema, draft);
    expect(() => validateStackCreation({ ...schema, collectionMethods: ['GET'] }, payload)).toThrow(
      'disponível',
    );
    expect(() =>
      validateStackCreation(
        {
          ...schema,
          resourceFields: {
            ...schema.resourceFields,
            dockerCompose: { type: 'string', create: false },
          },
        },
        payload,
      ),
    ).toThrow('dockerCompose');
    expect(() => validateStackCreation(schema, { ...payload, accountId: 'outro' })).toThrow(
      'accountId',
    );
  });
  it('mantém valores fora do DOM quando arquivo é oculto e remove campos de interpolação ao mudar para stack vazia', async () => {
    const submit = vi.fn();
    render(
      <StackComposeForm
        schema={schema}
        onSubmit={submit}
        onDirtyChange={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    fireEvent.change(screen.getByLabelText('Nome da stack'), { target: { value: 'fixture' } });
    await userEvent.selectOptions(screen.getByLabelText('Como criar a stack'), 'compose');
    expect(screen.getByLabelText('Iniciar os serviços após importar')).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Docker Compose'), {
      target: { value: draft.dockerCompose },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar Docker Compose' }));
    expect(screen.queryByDisplayValue(draft.dockerCompose)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar variável' }));
    fireEvent.change(screen.getByLabelText('Nome da variável 1'), { target: { value: 'MESSAGE' } });
    fireEvent.change(screen.getByLabelText('Valor da variável 1'), {
      target: { value: 'private-value' },
    });
    expect(screen.getByLabelText('Valor da variável 1')).toHaveAttribute('type', 'password');
    fireEvent.submit(document.getElementById('workspace-create-form')!);
    expect(submit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dockerCompose: draft.dockerCompose,
        startOnCreate: false,
        environment: { MESSAGE: 'private-value' },
      }),
    );
    await userEvent.selectOptions(screen.getByLabelText('Como criar a stack'), 'empty');
    fireEvent.submit(document.getElementById('workspace-create-form')!);
    expect(submit).toHaveBeenLastCalledWith({ name: 'fixture' });
  });
  it('preserva o rascunho em erro e bloqueia campos durante envio', () => {
    const props = { schema, onSubmit: vi.fn(), onDirtyChange: vi.fn(), busy: false, error: null };
    const { rerender } = render(<StackComposeForm {...props} />);
    fireEvent.change(screen.getByLabelText('Nome da stack'), { target: { value: 'keep-me' } });
    rerender(<StackComposeForm {...props} error={new Error('Sem permissão atual')} busy />);
    expect(screen.getByLabelText('Nome da stack')).toHaveValue('keep-me');
    expect(screen.getByLabelText('Nome da stack')).toBeDisabled();
    expect(screen.getByText('Sem permissão atual')).toBeInTheDocument();
    fireEvent.submit(document.getElementById('workspace-create-form')!);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
