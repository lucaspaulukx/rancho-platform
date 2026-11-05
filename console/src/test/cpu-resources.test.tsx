import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cpuFields, parseCpuResource, validateCpuResource } from '../cpu-resources';
import { CpuResourceEditor } from '../components/CpuResourceEditor';
import { validateWorkloadResources } from '../workload-resources';
import type { Schema } from '../api';

describe('Recursos CPU e I/O em unidades nativas', () => {
  it('preserva omissão, zero, quota ilimitada e limites do período', () => {
    for (const name of Object.keys(cpuFields) as (keyof typeof cpuFields)[]) {
      expect(parseCpuResource(name, '')).toBeUndefined();
    }
    expect(parseCpuResource('cpuQuota', '-1')).toBe(-1);
    expect(parseCpuResource('cpuQuota', '0')).toBe(0);
    expect(parseCpuResource('cpuPeriod', '1000')).toBe(1000);
    expect(parseCpuResource('cpuPeriod', '1000000')).toBe(1000000);
    expect(parseCpuResource('cpuShares', '512')).toBe(512);
  });
  it('recusa frações, expoentes, inteiros inseguros e limites inválidos', () => {
    for (const text of ['1.5', '1e3', '9007199254740992', '-2', '999'])
      expect(() => parseCpuResource('cpuQuota', text)).toThrow();
    for (const text of ['-1', '999', '1000001'])
      expect(() => parseCpuResource('cpuPeriod', text)).toThrow();
    for (const value of [9, 1001, -1])
      expect(() => validateCpuResource('blkioWeight', value)).toThrow();
    expect(() => validateCpuResource('cpuShares', '512')).toThrow();
    expect(() => validateCpuResource('milliCpuReservation', -1)).toThrow();
  });
  it('valida cpuset sem expandir intervalos e deixa disponibilidade para o host', () => {
    expect(parseCpuResource('cpuSet', '0,2-4')).toBe('0,2-4');
    expect(parseCpuResource('cpuSet', '0-9007199254740991')).toBe('0-9007199254740991');
    for (const text of ['3-1', '0,,1', '-1', '0, 1', '9007199254740992', '0-1-2'])
      expect(() => parseCpuResource('cpuSet', text)).toThrow();
  });
  it('valida recursivamente sidecars usando o schema atual', () => {
    const launch = { resourceFields: { cpuQuota: { type: 'int' } } } as unknown as Schema;
    const service = {
      resourceFields: { secondaryLaunchConfigs: { type: 'array[launch]' } },
    } as unknown as Schema;
    expect(() =>
      validateWorkloadResources(
        service,
        { secondaryLaunchConfigs: [{ cpuQuota: 999 }] },
        { launch },
      ),
    ).toThrow();
    expect(() => validateWorkloadResources(launch, { cpuQuota: 50000 }, {})).not.toThrow();
  });
  it('entrada inválida fica no rascunho e bloqueia formulário sem arredondar', async () => {
    const user = userEvent.setup(),
      change = vi.fn();
    render(<CpuResourceEditor name="cpuQuota" value={50000} onChange={change} />);
    const input = screen.getByLabelText('Quota de CPU (µs)');
    await user.clear(input);
    expect(change).toHaveBeenLastCalledWith(undefined);
    await user.type(input, '1.5');
    expect(input).toBeInvalid();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(change).toHaveBeenLastCalledWith('1.5');
    await user.clear(input);
    await user.type(input, '-1');
    expect(input).toBeValid();
    expect(change).toHaveBeenLastCalledWith(-1);
  });
});
