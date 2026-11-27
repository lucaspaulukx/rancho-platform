import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CpuValidationError,
  cpuFields,
  parseCpuResource,
  validatedCpuResources,
  validateCpuResource,
} from '../cpu-resources';
import { CpuResourceEditor } from '../components/CpuResourceEditor';
import { validateWorkloadResources } from '../workload-resources';
import type { Schema } from '../api';
import { createTranslator } from '../i18n/messages';
import { workloadValidationMessage } from '../workload-validation-message';

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
  it.each([
    [() => parseCpuResource('cpuQuota', '1.5'), 'Use an integer without fractions'],
    [
      () => validateCpuResource('cpuQuota', Number.MAX_SAFE_INTEGER + 1),
      'Enter an integer within the safe range.',
    ],
    [() => validateCpuResource('cpuSet', '0, 1'), 'Use comma-separated CPU indices'],
    [() => validateCpuResource('cpuSet', '3-1'), 'Use ascending ranges'],
    [
      () => validateCpuResource('blkioWeight', 9),
      'Review i/o weight. Relative weight from 10 to 1,000',
    ],
    [() => validatedCpuResources({}), 'Review the fields.'],
    [
      () =>
        validatedCpuResources({
          cpuShares: 0,
          cpuPeriod: 0,
          cpuQuota: '',
          cpuSet: '',
          blkioWeight: 0,
          milliCpuReservation: 0,
        }),
      'Fill in CPU quota (µs). Available time per period.',
    ],
  ])(
    'formats CPU and I/O errors before they reach the English forms (%#)',
    (validate, expected) => {
      const { t, locale } = createTranslator('en-US');
      try {
        validate();
      } catch (error) {
        if (!(error instanceof CpuValidationError)) throw error;
        expect(workloadValidationMessage(error, t, locale)).toContain(expected);
        return;
      }
      throw new Error('Expected CPU validation to fail.');
    },
  );
  it('retains the native exception message and renders the localized field hint', () => {
    const { t, locale } = createTranslator('pt-BR');
    try {
      validateCpuResource('blkioWeight', 9);
    } catch (error) {
      if (!(error instanceof CpuValidationError)) throw error;
      expect(error.code).toBe('cpuReview');
      expect(error.message).toContain('Revise peso de i/o.');
      expect(workloadValidationMessage(error, t, locale)).toBe(error.message);
      return;
    }
    throw new Error('Expected I/O validation to fail.');
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
