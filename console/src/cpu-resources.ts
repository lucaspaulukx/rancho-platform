export const cpuFields = {
  cpuShares: {
    label: 'Peso de CPU',
    hint: 'Prioridade relativa em disputa por CPU, sem limitar o uso. Uma reserva de CPU positiva prevalece sobre este peso. O agente Cattle aplica no mínimo 2, inclusive para zero.',
  },
  cpuPeriod: {
    label: 'Período de CPU (µs)',
    hint: 'Janela do limite: 1.000 a 1.000.000 µs. Zero usa o padrão do Docker (normalmente 100.000 µs).',
  },
  cpuQuota: {
    label: 'Quota de CPU (µs)',
    hint: 'Tempo disponível por período. Ex.: 50.000 / 100.000 equivale a 0,5 CPU. Zero ou -1 não impõe quota explícita.',
  },
  cpuSet: {
    label: 'CPUs permitidas',
    hint: 'Índices de CPU, como 0,1 ou 0-3. O host precisa disponibilizar essas CPUs.',
  },
  blkioWeight: {
    label: 'Peso de I/O',
    hint: 'Peso relativo de 10 a 1.000; zero usa o padrão. Depende do suporte do kernel e não define uma taxa em MB/s.',
  },
  milliCpuReservation: {
    label: 'Reserva de CPU (millicores)',
    hint: 'Reserva no agendamento: 1.000 millicores = 1 CPU. Quando positiva, também substitui o peso de CPU (250 millicores → peso 256). Não impõe quota de execução.',
  },
} as const;
export type CpuField = keyof typeof cpuFields;
export function isCpuField(name: string): name is CpuField {
  return Object.prototype.hasOwnProperty.call(cpuFields, name);
}
export function cpuResourceDefaults(launch: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(cpuFields).map((name) => [name, launch[name] ?? (name === 'cpuSet' ? '' : 0)]),
  );
}
export function validatedCpuResources(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Revise os recursos de CPU e I/O.');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).length !== Object.keys(cpuFields).length ||
    Object.keys(data).some((name) => !isCpuField(name))
  )
    throw new Error('Revise os campos de CPU e I/O conforme o contrato atual.');
  for (const name of Object.keys(cpuFields) as CpuField[]) {
    if (
      name === 'cpuSet' ? typeof data[name] !== 'string' : data[name] == null || data[name] === ''
    )
      throw new Error('Informe os valores de CPU e I/O; use zero para retirar o valor explícito.');
    validateCpuResource(name, data[name]);
  }
  return { ...data };
}
export function validateCpuResource(name: CpuField, value: unknown) {
  if (value == null || value === '') return;
  if (name === 'cpuSet') {
    if (
      typeof value !== 'string' ||
      value.length > 4096 ||
      !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(value)
    )
      throw new Error('Use índices de CPU separados por vírgula ou intervalos como 0-3.');
    for (const range of value.split(',')) {
      const [start, end = start] = range.split('-').map(Number);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end)
        throw new Error('Use intervalos ascendentes de índices de CPU inteiros seguros.');
    }
    return;
  }
  if (!Number.isSafeInteger(value))
    throw new Error('Informe um número inteiro dentro do limite seguro.');
  const number = Number(value);
  if (name === 'cpuQuota' && (number === -1 || number === 0 || number >= 1000)) return;
  if (name === 'cpuPeriod' && (number === 0 || (number >= 1000 && number <= 1000000))) return;
  if (name === 'blkioWeight' && (number === 0 || (number >= 10 && number <= 1000))) return;
  if ((name === 'cpuShares' || name === 'milliCpuReservation') && number >= 0) return;
  throw new Error(`Revise ${cpuFields[name].label.toLowerCase()}. ${cpuFields[name].hint}`);
}
export function parseCpuResource(name: CpuField, text: string): unknown {
  if (text.trim() === '') return undefined;
  if (name === 'cpuSet') {
    validateCpuResource(name, text);
    return text;
  }
  if (!/^-?\d+$/.test(text)) throw new Error('Use um inteiro, sem frações ou notação exponencial.');
  const value = Number(text);
  validateCpuResource(name, value);
  return value;
}
