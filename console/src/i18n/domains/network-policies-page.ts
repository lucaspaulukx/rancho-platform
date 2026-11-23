export const enNetworkPoliciesPage = {
  'networkPoliciesPage.title': 'Network policies',
  'networkPoliciesPage.noNetwork': 'No compatible network',
  'networkPoliciesPage.noNetworkDescription':
    'Native policies require an ipsec or vxlan network in this environment.',
  'networkPoliciesPage.defaultScope': 'Other communication',
  'networkPoliciesPage.allow': 'Allow',
  'networkPoliciesPage.deny': 'Deny',
  'networkPoliciesPage.confirmTitle': 'Apply network policies?',
  'networkPoliciesPage.discardTitle': 'Discard network changes?',
  'networkPoliciesPage.discardDescription': 'Changes have not been sent to Rancher yet.',
  'networkPoliciesPage.titleHeading': 'Network policies',
  'networkPoliciesPage.description':
    'Control communication between stacks, services and containers in this environment.',
  'networkPoliciesPage.view': 'View network policies',
  'networkPoliciesPage.close': 'Close',
  'networkPoliciesPage.managerWarning':
    'The network-policy-manager is not active and healthy. Rules can be viewed; changes remain unavailable until this infrastructure is validated.',
  'networkPoliciesPage.advancedNotice':
    'This network has advanced or unrecognized rules. The simplified editor does not replace them.',
  'networkPoliciesPage.allowOption': 'Allow',
  'networkPoliciesPage.denyOption': 'Deny',
  'networkPoliciesPage.discard': 'Discard changes',
  'networkPoliciesPage.review': 'Review change',
  'networkPoliciesPage.cancel': 'Cancel',
  'networkPoliciesPage.confirm': 'Confirm',
  'networkPoliciesPage.confirmDescription':
    'The change may interrupt existing connections in {name}. Rancher will receive the configuration; application depends on the policy manager.',
  'networkPoliciesPage.linkedScope': 'Linked services',
  'networkPoliciesPage.serviceScope': 'Containers in the same service',
  'networkPoliciesPage.stackScope': 'Services in the same stack',
  'networkPoliciesPage.reopen': 'Reopen the policy before saving.',
  'networkPoliciesPage.contextChanged': 'The context changed. Reopen the panel.',
} as const;

export const ptNetworkPoliciesPage = {
  'networkPoliciesPage.title': 'Políticas de rede',
  'networkPoliciesPage.noNetwork': 'Nenhuma rede compatível',
  'networkPoliciesPage.noNetworkDescription':
    'As políticas nativas exigem uma rede ipsec ou vxlan neste environment.',
  'networkPoliciesPage.defaultScope': 'Demais comunicações',
  'networkPoliciesPage.allow': 'Permitir',
  'networkPoliciesPage.deny': 'Bloquear',
  'networkPoliciesPage.confirmTitle': 'Aplicar políticas de rede?',
  'networkPoliciesPage.discardTitle': 'Descartar alterações de rede?',
  'networkPoliciesPage.discardDescription': 'As alterações ainda não foram enviadas ao Rancher.',
  'networkPoliciesPage.titleHeading': 'Políticas de rede',
  'networkPoliciesPage.description':
    'Controle a comunicação entre stacks, serviços e containers deste environment.',
  'networkPoliciesPage.view': 'Consultar políticas de rede',
  'networkPoliciesPage.close': 'Fechar',
  'networkPoliciesPage.managerWarning':
    'O network-policy-manager não está ativo e saudável. As regras podem ser consultadas; alterações ficam indisponíveis até validar essa infraestrutura.',
  'networkPoliciesPage.advancedNotice':
    'Esta rede possui regras avançadas ou não reconhecidas. O editor simplificado não as substitui.',
  'networkPoliciesPage.allowOption': 'Permitir',
  'networkPoliciesPage.denyOption': 'Bloquear',
  'networkPoliciesPage.discard': 'Descartar alterações',
  'networkPoliciesPage.review': 'Revisar alteração',
  'networkPoliciesPage.cancel': 'Cancelar',
  'networkPoliciesPage.confirm': 'Confirmar',
  'networkPoliciesPage.confirmDescription':
    'A alteração pode interromper conexões existentes em {name}. O Rancher receberá a configuração; a aplicação depende do gerenciador de políticas.',
  'networkPoliciesPage.linkedScope': 'Serviços vinculados',
  'networkPoliciesPage.serviceScope': 'Containers do mesmo serviço',
  'networkPoliciesPage.stackScope': 'Serviços da mesma stack',
  'networkPoliciesPage.reopen': 'Reabra a política antes de salvar.',
  'networkPoliciesPage.contextChanged': 'O contexto mudou. Reabra o painel.',
} as const;
