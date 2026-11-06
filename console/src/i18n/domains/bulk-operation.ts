export const enBulkOperation = {
  'bulkOperation.title': 'Bulk {action}',
  'bulkOperation.resources': { one: '{count} resource', other: '{count} resources' },
  'bulkOperation.description': 'Environment: {name} · {resources}',
  'bulkOperation.confirm': {
    one: 'Confirm {count} operation',
    other: 'Confirm {count} operations',
  },
  'bulkOperation.closeResults': 'Close results',
  'bulkOperation.warning':
    'The operation will apply to each listed resource. A failure does not undo operations already received by Rancher. Check the targets before confirming.',
  'bulkOperation.restartHint':
    'Services restart in batches of 1 container with a 2-second interval between batches. Submission is tracked per resource. Check the final state in the operations view.',
  'bulkOperation.removeWarning':
    'Removal may stop containers and remove dependent resources as part of the Rancher lifecycle. There is no automatic undo.',
  'bulkOperation.confirmEnvironment': 'Confirm the environment name',
  'bulkOperation.sending': 'Sending operations',
  'bulkOperation.finished': 'Submission ended',
  'bulkOperation.progress':
    '{status} · {received} of {total} responses. Track the final state in the operations view.',
  'bulkOperation.resource': 'Resource',
  'bulkOperation.result': 'Result',
  'bulkOperation.status.accepted': 'Accepted',
  'bulkOperation.status.failed': 'Failed',
  'bulkOperation.status.unknown': 'Check state',
  'bulkOperation.queued': 'Waiting to submit',
  'bulkOperation.pending': 'Pending confirmation',
  'bulkOperation.runningTitle': 'Operation in progress',
  'bulkOperation.runningDescription':
    'Wait for the batch to finish submitting before changing views or environments.',
  'bulkOperation.stay': 'Stay on this view',
  'bulkOperation.message.startFailed': 'Could not start the batch.',
  'bulkOperation.message.invalidSelection':
    'Select between 1 and 100 resources for a valid operation.',
  'bulkOperation.message.duplicateResources': 'The batch contains duplicate resources.',
  'bulkOperation.message.mixedRemoval': 'Bulk removal requires resources of the same type.',
  'bulkOperation.message.wrongEnvironment':
    'The resource does not belong to this batch’s environment.',
  'bulkOperation.message.actionUnavailable':
    'The action is no longer available. Check the state and your permissions.',
  'bulkOperation.message.accepted': 'Received by Rancher. Track the resource state.',
  'bulkOperation.message.unknown':
    'No response was confirmed. Check the state before trying again.',
  'bulkOperation.message.timeout': 'Could not query the resource in time.',
  'bulkOperation.message.failed': 'Could not apply the operation.',
} as const;

export const ptBulkOperation = {
  'bulkOperation.title': '{action} em lote',
  'bulkOperation.resources': { one: '{count} recurso', other: '{count} recursos' },
  'bulkOperation.description': 'Environment: {name} · {resources}',
  'bulkOperation.confirm': {
    one: 'Confirmar {count} operação',
    other: 'Confirmar {count} operações',
  },
  'bulkOperation.closeResults': 'Fechar resultados',
  'bulkOperation.warning':
    'A operação será aplicada a cada recurso listado. Uma falha não desfaz as operações já recebidas pelo Rancher. Confira os alvos antes de confirmar.',
  'bulkOperation.restartHint':
    'O reinício dos serviços usa lotes de 1 container e intervalo de 2 segundos entre lotes. O envio é acompanhado por recurso; confirme o estado final na operação.',
  'bulkOperation.removeWarning':
    'A remoção pode encerrar containers e remover recursos dependentes pelo lifecycle do Rancher. Não há desfazer automático.',
  'bulkOperation.confirmEnvironment': 'Confirme o nome do environment',
  'bulkOperation.sending': 'Enviando operações',
  'bulkOperation.finished': 'Envio encerrado',
  'bulkOperation.progress':
    '{status} · {received} de {total} respostas. O estado final continua sendo acompanhado na tela de operação.',
  'bulkOperation.resource': 'Recurso',
  'bulkOperation.result': 'Resultado',
  'bulkOperation.status.accepted': 'Recebida',
  'bulkOperation.status.failed': 'Falhou',
  'bulkOperation.status.unknown': 'Verificar estado',
  'bulkOperation.queued': 'Aguardando envio',
  'bulkOperation.pending': 'A confirmar',
  'bulkOperation.runningTitle': 'Operação em andamento',
  'bulkOperation.runningDescription':
    'Aguarde o envio do lote antes de trocar de tela ou environment.',
  'bulkOperation.stay': 'Permanecer nesta tela',
  'bulkOperation.message.startFailed': 'Não foi possível iniciar o lote.',
  'bulkOperation.message.invalidSelection':
    'Selecione entre 1 e 100 recursos para uma operação válida.',
  'bulkOperation.message.duplicateResources': 'O lote contém recursos duplicados.',
  'bulkOperation.message.mixedRemoval': 'A remoção em lote exige recursos do mesmo tipo.',
  'bulkOperation.message.wrongEnvironment': 'O recurso não pertence ao environment deste lote.',
  'bulkOperation.message.actionUnavailable':
    'A ação deixou de estar disponível. Revise o estado e suas permissões.',
  'bulkOperation.message.accepted': 'Recebida pelo Rancher. Acompanhe o estado do recurso.',
  'bulkOperation.message.unknown':
    'Sem confirmação da resposta. Verifique o estado antes de tentar novamente.',
  'bulkOperation.message.timeout': 'Não foi possível consultar o recurso a tempo.',
  'bulkOperation.message.failed': 'Não foi possível aplicar a operação.',
} as const;
