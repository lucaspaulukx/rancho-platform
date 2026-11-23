import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { memoryBytes, validateWorkloadResources } from '../workload-resources';
import { MemoryEditor } from '../components/MemoryEditor';
import type { Schema } from '../api';
const schema = {
  id: 'launchConfig',
  resourceFields: { memory: { type: 'int' }, memoryReservation: { type: 'int' } },
} as unknown as Schema;
describe('Memória em bytes exatos', () => {
  it('converte unidades e vazio sem arredondar bytes fracionários', () => {
    expect(memoryBytes('1.5', 'GiB')).toBe(1610612736);
    expect(memoryBytes('64', 'MiB')).toBe(67108864);
    expect(memoryBytes('', 'Bytes')).toBeUndefined();
    expect(memoryBytes('0', 'MiB')).toBe(0);
    for (const v of ['1e3', '-1', '0.1', '9007199254740992'])
      expect(() => memoryBytes(v, 'Bytes')).toThrow();
  });
  it('reserva não excede limite positivo e zero não vira limite mínimo', () => {
    expect(() =>
      validateWorkloadResources(schema, { memory: 64, memoryReservation: 65 }, {}),
    ).toThrow('reserva');
    expect(() =>
      validateWorkloadResources(schema, { memory: 0, memoryReservation: 65 }, {}),
    ).not.toThrow();
    expect(() => validateWorkloadResources(schema, { memory: -1 }, {})).toThrow();
  });
  it('valida configuração aninhada e auxiliares', () => {
    const service = {
      resourceFields: { secondaryLaunchConfigs: { type: 'array[launchConfig]' } },
    } as unknown as Schema;
    expect(() =>
      validateWorkloadResources(
        service,
        { secondaryLaunchConfigs: [{ memory: 5, memoryReservation: 10 }] },
        { launchConfig: schema },
      ),
    ).toThrow();
  });
  it('trocar unidade só muda apresentação e entrada inválida não envia valor arredondado', async () => {
    const user = userEvent.setup(),
      change = vi.fn();
    render(<MemoryEditor label="Limite de memória" value={67108864} onChange={change} />);
    await user.selectOptions(screen.getByLabelText('Limite de memória: unidade'), 'MiB');
    expect(screen.getByLabelText('Limite de memória: valor')).toHaveValue('64');
    expect(change).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Limite de memória: valor'));
    await user.type(screen.getByLabelText('Limite de memória: valor'), '128');
    expect(change).toHaveBeenLastCalledWith(134217728);
  });
});
