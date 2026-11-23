export const enWorkloadControls = {
  'workloadControls.cpuShares.label': 'CPU weight',
  'workloadControls.cpuShares.hint':
    'Relative priority when competing for CPU, without limiting usage. A positive CPU reservation takes precedence over this weight. The Cattle agent applies a minimum of 2, including for zero.',
  'workloadControls.cpuPeriod.label': 'CPU period (µs)',
  'workloadControls.cpuPeriod.hint':
    'Limit window: 1,000 to 1,000,000 µs. Zero uses the Docker default (usually 100,000 µs).',
  'workloadControls.cpuQuota.label': 'CPU quota (µs)',
  'workloadControls.cpuQuota.hint':
    'Available time per period. For example, 50,000 / 100,000 equals 0.5 CPU. Zero or -1 imposes no explicit quota.',
  'workloadControls.cpuSet.label': 'Allowed CPUs',
  'workloadControls.cpuSet.hint':
    'CPU indices, such as 0,1 or 0-3. The host must make these CPUs available.',
  'workloadControls.blkioWeight.label': 'I/O weight',
  'workloadControls.blkioWeight.hint':
    'Relative weight from 10 to 1,000; zero uses the default. Depends on kernel support and does not define a rate in MB/s.',
  'workloadControls.milliCpuReservation.label': 'CPU reservation (millicores)',
  'workloadControls.milliCpuReservation.hint':
    'Scheduling reservation: 1,000 millicores = 1 CPU. When positive, also replaces the CPU weight (250 millicores → weight 256). Does not impose a runtime quota.',
  'workloadControls.capabilityHint':
    'Choose only the capabilities you need. ALL represents every option; Docker will apply the configuration.',
  'workloadControls.unknownCapability':
    'Value outside the current contract: {value}. Review before creating.',
  'workloadControls.capabilityLabel': '{label}: capability {index}',
  'workloadControls.select': 'Select…',
  'workloadControls.removeLabel': 'Remove {label} {index}',
  'workloadControls.removeCapability': 'Remove capability',
  'workloadControls.addLabel': 'Add {label}',
  'workloadControls.cpuInteger': 'Use an integer without fractions or exponential notation.',
  'workloadControls.cpuSafeInteger': 'Enter an integer within the safe range.',
  'workloadControls.cpuIndices': 'Use comma-separated CPU indices or ranges such as 0-3.',
  'workloadControls.cpuRanges': 'Use ascending ranges of safe integer CPU indices.',
  'workloadControls.cpuReview': 'Review {label}. {hint}',
} as const;

export const ptWorkloadControls = {
  'workloadControls.cpuShares.label': 'Peso de CPU',
  'workloadControls.cpuShares.hint':
    'Prioridade relativa em disputa por CPU, sem limitar o uso. Uma reserva de CPU positiva prevalece sobre este peso. O agente Cattle aplica no mínimo 2, inclusive para zero.',
  'workloadControls.cpuPeriod.label': 'Período de CPU (µs)',
  'workloadControls.cpuPeriod.hint':
    'Janela do limite: 1.000 a 1.000.000 µs. Zero usa o padrão do Docker (normalmente 100.000 µs).',
  'workloadControls.cpuQuota.label': 'Quota de CPU (µs)',
  'workloadControls.cpuQuota.hint':
    'Tempo disponível por período. Ex.: 50.000 / 100.000 equivale a 0,5 CPU. Zero ou -1 não impõe quota explícita.',
  'workloadControls.cpuSet.label': 'CPUs permitidas',
  'workloadControls.cpuSet.hint':
    'Índices de CPU, como 0,1 ou 0-3. O host precisa disponibilizar essas CPUs.',
  'workloadControls.blkioWeight.label': 'Peso de I/O',
  'workloadControls.blkioWeight.hint':
    'Peso relativo de 10 a 1.000; zero usa o padrão. Depende do suporte do kernel e não define uma taxa em MB/s.',
  'workloadControls.milliCpuReservation.label': 'Reserva de CPU (millicores)',
  'workloadControls.milliCpuReservation.hint':
    'Reserva no agendamento: 1.000 millicores = 1 CPU. Quando positiva, também substitui o peso de CPU (250 millicores → peso 256). Não impõe quota de execução.',
  'workloadControls.capabilityHint':
    'Escolha somente as capabilities necessárias. ALL representa todas as opções; a configuração será aplicada pelo Docker.',
  'workloadControls.unknownCapability':
    'Valor fora do contrato atual: {value}. Revise antes de criar.',
  'workloadControls.capabilityLabel': '{label}: capability {index}',
  'workloadControls.select': 'Selecionar…',
  'workloadControls.removeLabel': 'Remover {label} {index}',
  'workloadControls.removeCapability': 'Remover capability',
  'workloadControls.addLabel': 'Adicionar {label}',
  'workloadControls.cpuInteger': 'Use um inteiro, sem frações ou notação exponencial.',
  'workloadControls.cpuSafeInteger': 'Informe um número inteiro dentro do limite seguro.',
  'workloadControls.cpuIndices': 'Use índices de CPU separados por vírgula ou intervalos como 0-3.',
  'workloadControls.cpuRanges': 'Use intervalos ascendentes de índices de CPU inteiros seguros.',
  'workloadControls.cpuReview': 'Revise {label}. {hint}',
} satisfies Record<keyof typeof enWorkloadControls, string>;
