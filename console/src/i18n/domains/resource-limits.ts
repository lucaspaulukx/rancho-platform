export const enResourceLimits = {
  'resourceLimits.process.title': 'Process limits',
  'resourceLimits.process.description':
    'With no rows, limits are inherited from Docker. Units depend on the resource; -1 means unlimited. Changes apply to new containers.',
  'resourceLimits.process.legacy':
    'Incompatible legacy format. Reopen with the native editor to preserve the configuration.',
  'resourceLimits.process.row': 'Limit {index}',
  'resourceLimits.process.resource': 'Limit resource {index}',
  'resourceLimits.process.select': 'Select…',
  'resourceLimits.process.unrecognized': 'Unrecognized: {name}',
  'resourceLimits.process.soft': 'Soft limit {index}',
  'resourceLimits.process.hard': 'Hard limit {index}',
  'resourceLimits.process.integerHint': 'Integer from -1 to 2147483647.',
  'resourceLimits.process.removeRow': 'Remove limit {index}',
  'resourceLimits.process.remove': 'Remove',
  'resourceLimits.process.add': 'Add process limit',
  'resourceLimits.memory.value': '{label}: value',
  'resourceLimits.memory.unit': '{label}: unit',
  'resourceLimits.memory.hint':
    'Zero keeps the behavior without an explicit limit. The reservation cannot exceed a positive limit.',
} as const;

export const ptResourceLimits = {
  'resourceLimits.process.title': 'Limites de processo',
  'resourceLimits.process.description':
    'Sem linhas, os limites são herdados do Docker. As unidades dependem do recurso; -1 significa ilimitado. Alterações valem para novos containers.',
  'resourceLimits.process.legacy':
    'Formato legado incompatível. Reabra com o editor nativo para preservar a configuração.',
  'resourceLimits.process.row': 'Limite {index}',
  'resourceLimits.process.resource': 'Recurso do limite {index}',
  'resourceLimits.process.select': 'Selecionar…',
  'resourceLimits.process.unrecognized': 'Não reconhecido: {name}',
  'resourceLimits.process.soft': 'Limite inicial {index}',
  'resourceLimits.process.hard': 'Limite máximo {index}',
  'resourceLimits.process.integerHint': 'Inteiro de -1 a 2147483647.',
  'resourceLimits.process.removeRow': 'Remover limite {index}',
  'resourceLimits.process.remove': 'Remover',
  'resourceLimits.process.add': 'Adicionar limite de processo',
  'resourceLimits.memory.value': '{label}: valor',
  'resourceLimits.memory.unit': '{label}: unidade',
  'resourceLimits.memory.hint':
    'Zero mantém o comportamento sem limite explícito. Reserva não pode exceder um limite positivo.',
} as const;
