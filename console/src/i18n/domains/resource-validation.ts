export const enResourceValidation = {
  'resourceValidation.memoryFormat': 'Enter nonnegative memory without exponential notation.',
  'resourceValidation.memoryRange': 'Memory is outside the limits.',
  'resourceValidation.memoryBytes': 'Memory must represent whole bytes within the safe range.',
  'resourceValidation.depth': 'The configuration has too many nested levels.',
  'resourceValidation.memoryValues': 'Memory and reservation must be nonnegative whole bytes.',
  'resourceValidation.memoryReservation': 'The memory reservation cannot exceed the limit.',
  'resourceValidation.limitInteger': 'Enter an integer from -1 to 2147483647; -1 means unlimited.',
  'resourceValidation.limitRange': 'The limit exceeds the range accepted by this Rancher.',
  'resourceValidation.limitCount': 'Configure up to 32 process limits.',
  'resourceValidation.limitFormat': 'The process-limit list has an incompatible format.',
  'resourceValidation.limitNames': 'Choose known limit names without duplicates.',
  'resourceValidation.limitOrder': 'The soft limit cannot exceed the hard limit.',
  'resourceValidation.limitContract':
    'The current contract does not permit configuring process limits.',
} as const;
export const ptResourceValidation = {
  'resourceValidation.memoryFormat': 'Informe memória não negativa, sem notação exponencial.',
  'resourceValidation.memoryRange': 'Memória fora dos limites.',
  'resourceValidation.memoryBytes':
    'A memória precisa representar bytes inteiros dentro do limite seguro.',
  'resourceValidation.depth': 'A configuração tem níveis demais.',
  'resourceValidation.memoryValues': 'Memória e reserva precisam ser bytes inteiros não negativos.',
  'resourceValidation.memoryReservation': 'A reserva de memória não pode exceder o limite.',
  'resourceValidation.limitInteger':
    'Informe um inteiro entre -1 e 2147483647; -1 significa ilimitado.',
  'resourceValidation.limitRange': 'O limite excede o intervalo aceito por este Rancher.',
  'resourceValidation.limitCount': 'Configure até 32 limites de processo.',
  'resourceValidation.limitFormat': 'A lista de limites contém um formato incompatível.',
  'resourceValidation.limitNames': 'Escolha nomes de limites conhecidos e sem duplicatas.',
  'resourceValidation.limitOrder': 'O limite inicial não pode exceder o máximo.',
  'resourceValidation.limitContract':
    'O contrato atual não permite configurar limites de processo.',
} as const;
