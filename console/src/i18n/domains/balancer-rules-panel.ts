export const ptBalancerRulesPanel = {
  'balancerRulesPanel.info':
    'Organize as rotas e os destinos deste balanceador. Portas publicadas ficam acessíveis pela rede dos hosts. A alteração pode interromper conexões; o serviço não será iniciado automaticamente.',
  'balancerRulesPanel.sent': 'Regras enviadas ao Rancher. Acompanhe o estado do balanceador.',
  'balancerRulesPanel.denied': 'Sua conta ou o estado atual não permite alterar estas regras.',
  'balancerRulesPanel.acknowledge': 'Revisei as portas publicadas e o impacto na conectividade',
  'balancerRulesPanel.noConversion': 'Nenhuma regra ou porta será convertida por este editor.',
  'balancerRulesPanel.contextDescription': 'Há regras não salvas. Aguarde qualquer envio pendente.',
  'balancerRulesPanel.discardDescription': 'A configuração do Rancher não será alterada.',
  'balancerRulesPanel.confirmPorts': 'Confirme o impacto das portas publicadas.',
  'balancerRulesPanel.hostnameHint': 'Opcional. Vazio aceita qualquer hostname.',
  'balancerRulesPanel.advanced': 'Destino por configuração avançada',
  'balancerRulesPanel.reopen': 'Reabra o editor do balanceador.',
  'balancerRulesPanel.apply': 'Aplicar regras do balanceador?',
  'balancerRulesPanel.discard': 'Descartar regras não salvas?',
  'balancerRulesPanel.unsupported': 'Configuração não suportada.',
  'balancerRulesPanel.pathHint': 'Opcional. Exemplo: /api',
  'balancerRulesPanel.hostPublished': 'Publicado nos hosts',
  'balancerRulesPanel.select': 'Selecionar serviço…',
  'balancerRulesPanel.disabled': 'Editor desativado.',
  'balancerRulesPanel.review': 'Revisar alterações',
  'balancerRulesPanel.preserved': 'Regras preservadas',
  'balancerRulesPanel.context': 'Mudar de contexto?',
  'balancerRulesPanel.reviewRules': 'Revise as regras.',
  'balancerRulesPanel.add': 'Adicionar regra',
  'balancerRulesPanel.published': 'Publicado',
  'balancerRulesPanel.internal': 'Interno',
  'balancerRulesPanel.close': 'Fechar',
  'balancerRulesPanel.native': 'Nativo',
  'balancerRulesPanel.rule': 'Regra {index}',
  'balancerRulesPanel.remove': 'Remover regra {index}',
  'balancerRulesPanel.protocol': 'Protocolo {index}',
  'balancerRulesPanel.access': 'Acesso {index}',
  'balancerRulesPanel.sourcePort': 'Porta de entrada {index}',
  'balancerRulesPanel.targetPort': 'Porta de destino {index}',
  'balancerRulesPanel.target': 'Serviço de destino {index}',
  'balancerRulesPanel.hostname': 'Hostname {index}',
  'balancerRulesPanel.path': 'Caminho {index}',
  'balancerRulesPanel.unavailableTarget': 'Destino indisponível ({id})',
  'balancerRulesPanel.title': 'Balanceador · {name}',
  'balancerRulesPanel.environment': 'Environment: {name}',
  'balancerRulesPanel.applyDescription':
    'As regras de {name} serão atualizadas somente em {environment}. Conexões podem ser afetadas.',
  'balancerRulesPanel.sourceIp': 'IP de publicação preservado: {ip}',
  'balancerRulesPanel.before': 'Antes · {count} regra(s)',
  'balancerRulesPanel.after': 'Depois · {count} regra(s)',
  'balancerRulesPanel.preservation':
    '{reason} A configuração existente foi mantida. Feche este painel e escolha Editar configuração para usar o formulário nativo.',
  'balancerRulesPanel.validation.configuration': 'Configuração do balanceador indisponível.',
  'balancerRulesPanel.validation.changed':
    'O balanceador foi alterado por outro cliente. Feche e reabra o painel.',
  'balancerRulesPanel.validation.portFormat':
    'Formato de portas não suportado. Use a edição nativa.',
  'balancerRulesPanel.validation.invalidBinding': 'Binding de porta inválido.',
  'balancerRulesPanel.validation.nativeBinding':
    'Este binding exige a edição nativa. Nenhuma porta será convertida.',
  'balancerRulesPanel.validation.port': 'Informe portas inteiras entre 1 e 65535.',
  'balancerRulesPanel.validation.native': 'Este balanceador exige a edição nativa.',
  'balancerRulesPanel.validation.advanced':
    'Há regras avançadas. Use a edição nativa para preservar todos os protocolos e destinos.',
  'balancerRulesPanel.validation.advancedTcp': 'Regra TCP avançada: use a edição nativa.',
  'balancerRulesPanel.validation.listener': 'Listener ambíguo ou sem binding. Use a edição nativa.',
  'balancerRulesPanel.validation.unmatchedPorts':
    'Há portas sem regra correspondente. Use a edição nativa.',
  'balancerRulesPanel.validation.incompleteContract':
    'Contrato incompleto. Reabra o painel ou use a edição nativa.',
  'balancerRulesPanel.validation.unknownField':
    'Campo não reconhecido: {name}. Use a edição nativa para preservar a configuração.',
  'balancerRulesPanel.validation.schemaUnavailable': 'Schema indisponível: {name}.',
  'balancerRulesPanel.validation.unavailable':
    'A alteração do balanceador não está disponível neste contexto.',
  'balancerRulesPanel.validation.stackUnavailable': 'A stack do balanceador não está disponível.',
  'balancerRulesPanel.validation.ruleCount': 'Mantenha entre 1 e 100 regras.',
  'balancerRulesPanel.validation.ruleContract': 'O contrato de regras mudou. Reabra o painel.',
  'balancerRulesPanel.validation.portContract': 'Contrato de portas indisponível.',
  'balancerRulesPanel.validation.ruleKey': 'Identificador de regra duplicado ou inválido.',
  'balancerRulesPanel.validation.protocolAccess': 'Protocolo ou acesso inválido.',
  'balancerRulesPanel.validation.preservedIp': 'O IP de publicação existente deve ser preservado.',
  'balancerRulesPanel.validation.protocolContract':
    'O protocolo não está mais disponível no contrato atual.',
  'balancerRulesPanel.validation.portLimits': 'A porta está fora dos limites do contrato atual.',
  'balancerRulesPanel.validation.target':
    'Escolha um serviço de aplicação disponível neste environment.',
  'balancerRulesPanel.validation.hostnamePath':
    'Revise hostname e caminho HTTP. O caminho deve começar com /.',
  'balancerRulesPanel.validation.portConflict':
    'Regras na mesma porta precisam usar o mesmo protocolo, acesso e IP.',
  'balancerRulesPanel.validation.routeDuplicate': 'Não repita a mesma rota de entrada.',
} as const;

export const enBalancerRulesPanel = {
  'balancerRulesPanel.info':
    'Organize routes and targets for this load balancer. Published ports are accessible on the host network. Changes may interrupt connections. The service will not start automatically.',
  'balancerRulesPanel.sent': 'Rules sent to Rancher. Monitor the load balancer state.',
  'balancerRulesPanel.denied': 'Your account or the current state prevents changing these rules.',
  'balancerRulesPanel.acknowledge':
    'I reviewed the published ports and their impact on connectivity',
  'balancerRulesPanel.noConversion': 'This editor will not convert any rules or ports.',
  'balancerRulesPanel.contextDescription':
    'There are unsaved rules. Wait for any pending submission.',
  'balancerRulesPanel.discardDescription': 'The Rancher configuration will remain as it is.',
  'balancerRulesPanel.confirmPorts': 'Confirm the impact of published ports.',
  'balancerRulesPanel.hostnameHint': 'Optional. Leave blank to match any hostname.',
  'balancerRulesPanel.advanced': 'Target set by advanced configuration',
  'balancerRulesPanel.reopen': 'Reopen the load balancer editor.',
  'balancerRulesPanel.apply': 'Apply load balancer rules?',
  'balancerRulesPanel.discard': 'Discard unsaved rules?',
  'balancerRulesPanel.unsupported': 'Unsupported configuration.',
  'balancerRulesPanel.pathHint': 'Optional. Example: /api',
  'balancerRulesPanel.hostPublished': 'Published on hosts',
  'balancerRulesPanel.select': 'Select service…',
  'balancerRulesPanel.disabled': 'Editor disabled.',
  'balancerRulesPanel.review': 'Review changes',
  'balancerRulesPanel.preserved': 'Preserved rules',
  'balancerRulesPanel.context': 'Change context?',
  'balancerRulesPanel.reviewRules': 'Review the rules.',
  'balancerRulesPanel.add': 'Add rule',
  'balancerRulesPanel.published': 'Published',
  'balancerRulesPanel.internal': 'Internal',
  'balancerRulesPanel.close': 'Close',
  'balancerRulesPanel.native': 'Native',
  'balancerRulesPanel.rule': 'Rule {index}',
  'balancerRulesPanel.remove': 'Remove rule {index}',
  'balancerRulesPanel.protocol': 'Protocol {index}',
  'balancerRulesPanel.access': 'Access {index}',
  'balancerRulesPanel.sourcePort': 'Source port {index}',
  'balancerRulesPanel.targetPort': 'Target port {index}',
  'balancerRulesPanel.target': 'Target service {index}',
  'balancerRulesPanel.hostname': 'Hostname {index}',
  'balancerRulesPanel.path': 'Path {index}',
  'balancerRulesPanel.unavailableTarget': 'Unavailable target ({id})',
  'balancerRulesPanel.title': 'Load balancer · {name}',
  'balancerRulesPanel.environment': 'Environment: {name}',
  'balancerRulesPanel.applyDescription':
    'The rules for {name} will be updated only in {environment}. Connections may be affected.',
  'balancerRulesPanel.sourceIp': 'Preserved publishing IP: {ip}',
  'balancerRulesPanel.before': 'Before · {count} rule(s)',
  'balancerRulesPanel.after': 'After · {count} rule(s)',
  'balancerRulesPanel.preservation':
    '{reason} The existing configuration was preserved. Close this panel and choose Edit configuration to use the native form.',
  'balancerRulesPanel.validation.configuration': 'The load balancer configuration is unavailable.',
  'balancerRulesPanel.validation.changed':
    'Another client changed the load balancer. Close and reopen the panel.',
  'balancerRulesPanel.validation.portFormat':
    'The port format is unsupported. Use the native editor.',
  'balancerRulesPanel.validation.invalidBinding': 'Invalid port binding.',
  'balancerRulesPanel.validation.nativeBinding':
    'This binding requires the native editor. Port bindings will be preserved.',
  'balancerRulesPanel.validation.port': 'Enter whole-number ports from 1 to 65535.',
  'balancerRulesPanel.validation.native': 'This load balancer requires the native editor.',
  'balancerRulesPanel.validation.advanced':
    'Use the native editor for these advanced rules to preserve all protocols and targets.',
  'balancerRulesPanel.validation.advancedTcp': 'Use the native editor for this advanced TCP rule.',
  'balancerRulesPanel.validation.listener':
    'The listener is ambiguous or lacks a binding. Use the native editor.',
  'balancerRulesPanel.validation.unmatchedPorts':
    'Some ports lack a matching rule. Use the native editor.',
  'balancerRulesPanel.validation.incompleteContract':
    'The contract is incomplete. Reopen the panel or use the native editor.',
  'balancerRulesPanel.validation.unknownField':
    'Unrecognized field: {name}. Use the native editor to preserve the configuration.',
  'balancerRulesPanel.validation.schemaUnavailable': 'Schema unavailable: {name}.',
  'balancerRulesPanel.validation.unavailable':
    'The load balancer cannot be changed in this context.',
  'balancerRulesPanel.validation.stackUnavailable': 'The load balancer stack is unavailable.',
  'balancerRulesPanel.validation.ruleCount': 'Keep between 1 and 100 rules.',
  'balancerRulesPanel.validation.ruleContract': 'The rule contract changed. Reopen the panel.',
  'balancerRulesPanel.validation.portContract': 'The port contract is unavailable.',
  'balancerRulesPanel.validation.ruleKey': 'The rule identifier is duplicated or invalid.',
  'balancerRulesPanel.validation.protocolAccess': 'Invalid protocol or access type.',
  'balancerRulesPanel.validation.preservedIp': 'Keep the existing publishing IP.',
  'balancerRulesPanel.validation.protocolContract':
    'The current contract no longer supports this protocol.',
  'balancerRulesPanel.validation.portLimits':
    'The port is outside the limits of the current contract.',
  'balancerRulesPanel.validation.target':
    'Choose an available application service in this environment.',
  'balancerRulesPanel.validation.hostnamePath':
    'Check the hostname and HTTP path. The path must start with /.',
  'balancerRulesPanel.validation.portConflict':
    'Rules on the same port must use the same protocol, access type, and IP.',
  'balancerRulesPanel.validation.routeDuplicate': 'Use each incoming route only once.',
} as const;
