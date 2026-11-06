export const enWorkloadStreams = {
  'workloadStreams.logs': 'Resource logs',
  'workloadStreams.terminal': 'Resource terminal',
  'workloadStreams.emptyTitle': 'No containers available',
  'workloadStreams.emptyDescription':
    'Rancher did not make this operation available for the containers in this resource.',
  'workloadStreams.stack': 'Stack:',
  'workloadStreams.service': 'Service:',
  'workloadStreams.container': 'Container',
  'workloadStreams.selectionHint':
    'Showing only the selected container. Switching containers closes the previous connection.',
} as const;

export const ptWorkloadStreams = {
  'workloadStreams.logs': 'Logs do recurso',
  'workloadStreams.terminal': 'Terminal do recurso',
  'workloadStreams.emptyTitle': 'Nenhum container disponível',
  'workloadStreams.emptyDescription':
    'O Rancher não disponibilizou esta operação para os containers deste recurso.',
  'workloadStreams.stack': 'Stack:',
  'workloadStreams.service': 'Serviço:',
  'workloadStreams.container': 'Container',
  'workloadStreams.selectionHint':
    'Exibindo apenas o container selecionado. A troca encerra a conexão anterior.',
} satisfies Record<keyof typeof enWorkloadStreams, string>;
