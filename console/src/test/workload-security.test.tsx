import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapabilityEditor } from '../components/CapabilityEditor';
import { validateWorkloadSecurity } from '../workload-security';
import { SchemaForm } from '../components/SchemaForm';
import type { Schema } from '../api';
const field = {
  type: 'array[enum]',
  create: true,
  options: ['ALL', 'NET_BIND_SERVICE', 'NET_RAW'],
};
const schema = {
  id: 'container',
  links: {},
  pluralName: 'containers',
  resourceFields: { capAdd: field, capDrop: field },
} as Schema;
describe('Capabilities conforme contrato atual', () => {
  it('aceita drop ALL com add específico sem inventar conflito', () => {
    expect(() =>
      validateWorkloadSecurity(schema, { capAdd: ['NET_BIND_SERVICE'], capDrop: ['ALL'] }, {}),
    ).not.toThrow();
  });
  it('rejeita desconhecido, duplicado, valor não array e contrato revogado', () => {
    for (const value of [['UNKNOWN'], ['NET_RAW', 'NET_RAW'], 'NET_RAW', ['']])
      expect(() => validateWorkloadSecurity(schema, { capAdd: value }, {})).toThrow();
    expect(() =>
      validateWorkloadSecurity({ ...schema, resourceFields: {} }, { capAdd: ['ALL'] }, {}),
    ).toThrow();
  });
  it('valida sidecars recursivamente', () => {
    expect(() =>
      validateWorkloadSecurity(
        { ...schema, resourceFields: { secondaryLaunchConfigs: { type: 'array[container]' } } },
        { secondaryLaunchConfigs: [{ capDrop: ['UNKNOWN'] }] },
        { container: schema },
      ),
    ).toThrow();
  });
  it('linhas adicionam/removem valores sem selecionar privilégio implicitamente', async () => {
    const user = userEvent.setup(),
      change = vi.fn();
    render(
      <CapabilityEditor
        label="Capabilities adicionais"
        value={[]}
        options={field.options}
        onChange={change}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Adicionar capabilities adicionais' }));
    expect(change).toHaveBeenLastCalledWith(['']);
    await user.selectOptions(
      screen.getByLabelText('Capabilities adicionais: capability 1'),
      'NET_BIND_SERVICE',
    );
    expect(change).toHaveBeenLastCalledWith(['NET_BIND_SERVICE']);
    await user.click(screen.getByRole('button', { name: 'Remover Capabilities adicionais 1' }));
    expect(change).toHaveBeenLastCalledWith([]);
  });
  it('valor legado desconhecido permanece visível com aviso', () => {
    render(
      <CapabilityEditor
        label="Capabilities"
        value={['FUTURE']}
        options={field.options}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('FUTURE');
    expect(screen.getByLabelText('Capabilities: capability 1')).toHaveValue('FUTURE');
  });
  it('flag off preserva formulário nativo JSON', () => {
    render(<SchemaForm schema={schema} schemas={{}} onSubmit={vi.fn()} securityEditors={false} />);
    expect(
      screen.queryByRole('button', { name: 'Adicionar capabilities adicionais' }),
    ).not.toBeInTheDocument();
  });
});
