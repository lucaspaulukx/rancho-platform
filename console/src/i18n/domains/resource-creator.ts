export const enResourceCreator = {
  'resourceCreator.kind.stack': 'Stack',
  'resourceCreator.kind.service': 'Service',
  'resourceCreator.kind.loadBalancerService': 'Load balancer',
  'resourceCreator.kind.dnsService': 'Service alias',
  'resourceCreator.kind.externalService': 'External service',
  'resourceCreator.kind.container': 'Standalone container',
  'resourceCreator.kind.resource': 'Resource',
  'resourceCreator.title': 'Create {kind}',
  'resourceCreator.stackContext': 'Environment: {environment} · Stack: {stack}',
  'resourceCreator.create': 'Create',
  'resourceCreator.created': '{kind} {name} created. Track its status in the operation.',
  'resourceCreator.unavailable': 'Creation is unavailable in this context.',
  'resourceCreator.schemaUnavailable': 'The creation schema is unavailable.',
  'resourceCreator.permissionChanged': 'Your permission to create is no longer available.',
  'resourceCreator.stackUnavailable': 'The stack is unavailable for adding services.',
  'resourceCreator.schemaChanged': 'The creation schema is no longer available.',
  'resourceCreator.validation.unavailable': 'This workload can no longer be created.',
  'resourceCreator.validation.depth': 'The configuration is nested too deeply.',
  'resourceCreator.validation.fieldUnavailable':
    'The {name} field is no longer available for creation. Reopen the panel.',
  'resourceCreator.validation.schemaUnavailable':
    'The schema for {name} is no longer available. Reopen the panel.',
  'resourceCreator.creationDenied':
    'Your profile or the server does not allow creating this resource in the selected environment.',
  'resourceCreator.discardTitle': 'Discard draft?',
  'resourceCreator.discardDescription':
    'The resource has not been created yet. The information you entered will be discarded.',
  'resourceCreator.contextTitle': 'Switch context?',
  'resourceCreator.pending': 'Wait for Rancher to respond.',
  'resourceCreator.unsaved': 'There is an unsaved draft.',
} as const;

export const ptResourceCreator = {
  'resourceCreator.kind.stack': 'Stack',
  'resourceCreator.kind.service': 'Serviço',
  'resourceCreator.kind.loadBalancerService': 'Balanceador',
  'resourceCreator.kind.dnsService': 'Alias de serviço',
  'resourceCreator.kind.externalService': 'Serviço externo',
  'resourceCreator.kind.container': 'Container avulso',
  'resourceCreator.kind.resource': 'Recurso',
  'resourceCreator.title': 'Criar {kind}',
  'resourceCreator.stackContext': 'Environment: {environment} · Stack: {stack}',
  'resourceCreator.create': 'Criar',
  'resourceCreator.created': '{kind} {name} criado. Acompanhe o estado na operação.',
  'resourceCreator.unavailable': 'A criação não está disponível neste contexto.',
  'resourceCreator.schemaUnavailable': 'O schema de criação não está disponível.',
  'resourceCreator.permissionChanged': 'Sua permissão de criar não está mais disponível.',
  'resourceCreator.stackUnavailable': 'A stack não está disponível para receber serviços.',
  'resourceCreator.schemaChanged': 'O schema de criação não está mais disponível.',
  'resourceCreator.validation.unavailable': 'A criação deste workload não está mais disponível.',
  'resourceCreator.validation.depth': 'A configuração tem níveis demais.',
  'resourceCreator.validation.fieldUnavailable':
    'O campo {name} não está mais disponível para criação. Reabra o painel.',
  'resourceCreator.validation.schemaUnavailable':
    'O schema de {name} não está mais disponível. Reabra o painel.',
  'resourceCreator.creationDenied':
    'Seu perfil ou o servidor não disponibiliza a criação deste recurso no environment selecionado.',
  'resourceCreator.discardTitle': 'Descartar rascunho?',
  'resourceCreator.discardDescription':
    'O recurso ainda não foi criado. As informações preenchidas serão descartadas.',
  'resourceCreator.contextTitle': 'Mudar de contexto?',
  'resourceCreator.pending': 'Aguarde a resposta do Rancher.',
  'resourceCreator.unsaved': 'Há um rascunho que ainda não foi salvo.',
} as const satisfies Record<keyof typeof enResourceCreator, string>;
