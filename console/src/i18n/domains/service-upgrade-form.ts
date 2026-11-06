export const enServiceUpgradeForm = {
  'serviceUpgradeForm.review': 'Review the upgrade.',
  'serviceUpgradeForm.limitsNotice':
    'Changing limits replaces service containers. An empty list removes explicit limits and inherits Docker defaults.',
  'serviceUpgradeForm.securityNotice':
    'Security changes replace service containers. Review capabilities, host access and filesystem settings before confirming.',
  'serviceUpgradeForm.batchNotice':
    'Up to {batch} containers will be upgraded per batch, with {interval} ms between batches. Ports, variables, volumes and sidecars keep their current settings except where explicitly edited above. Availability depends on capacity and application health.',
  'serviceUpgradeForm.follow':
    'Monitor the status here after the upgrade. Finish Upgrade and Roll Back appear when Rancher makes those actions available.',
  'serviceUpgradeForm.impact':
    'Service {service}. Published ports can change access. Changing mounts can make existing data unavailable. Editing or removing sidecars replaces auxiliary containers and can affect data or networking. Health checks can recreate containers or interrupt the upgrade if the endpoint fails. Rancher replaces containers according to the chosen strategy. Review the fields before confirming.',
  'serviceUpgradeForm.image': 'New image',
  'serviceUpgradeForm.bindings': 'Edit ports and volumes in this upgrade',
  'serviceUpgradeForm.health': 'Edit the health check in this upgrade',
  'serviceUpgradeForm.sidecars': 'Edit sidecars in this upgrade',
  'serviceUpgradeForm.ulimits': 'Edit process limits in this upgrade',
  'serviceUpgradeForm.security': 'Edit security in this upgrade',
  'serviceUpgradeForm.privileged': 'Privileged mode',
  'serviceUpgradeForm.readOnly': 'Read-only filesystem',
  'serviceUpgradeForm.memory': 'Edit memory in this upgrade',
  'serviceUpgradeForm.memoryLimit': 'Memory limit',
  'serviceUpgradeForm.memoryReservation': 'Memory reservation',
  'serviceUpgradeForm.cpu': 'Edit CPU and I/O in this upgrade',
  'serviceUpgradeForm.affinity': 'Edit affinities in this upgrade',
  'serviceUpgradeForm.batch': 'Containers per batch',
  'serviceUpgradeForm.interval': 'Interval between batches (ms)',
  'serviceUpgradeForm.configuration': 'Configuration upgrade',
  'serviceUpgradeForm.imageUpgrade': 'Image upgrade',
  'serviceUpgradeForm.currentImage': 'Current image:',
  'serviceUpgradeForm.capAdd': 'Added capabilities',
  'serviceUpgradeForm.capDrop': 'Dropped capabilities',
  'serviceUpgradeForm.startFirst': 'Start new containers before stopping the current ones',
  'serviceUpgradeForm.confirm': 'Upgrade service configuration?',
} as const;

export const ptServiceUpgradeForm = {
  'serviceUpgradeForm.review': 'Revise a atualização.',
  'serviceUpgradeForm.limitsNotice':
    'Alterar limites substitui os containers do serviço. Uma lista vazia retira os limites explícitos e passa a herdar o Docker.',
  'serviceUpgradeForm.securityNotice':
    'Mudanças de segurança substituem os containers do serviço. Revise capabilities, acesso ao host e sistema de arquivos antes de confirmar.',
  'serviceUpgradeForm.batchNotice':
    'Serão atualizados até {batch} containers por lote, com intervalo de {interval} ms. Portas, variáveis, volumes e sidecars seguem a configuração atual do serviço, exceto as opções explicitamente editadas acima. A disponibilidade depende da capacidade e da saúde da aplicação.',
  'serviceUpgradeForm.follow':
    'Após a troca, acompanhe o estado nesta tela. Concluir atualização e Reverter atualização aparecem conforme as ações disponíveis no Rancher.',
  'serviceUpgradeForm.impact':
    'Serviço {service}. Portas publicadas podem mudar o acesso; alterar montagens pode tornar dados anteriores indisponíveis. Editar ou remover sidecars substitui containers auxiliares e pode afetar dados/rede. Verificações de saúde podem recriar containers ou interromper a atualização se o endpoint falhar. O Rancher substituirá containers conforme a estratégia escolhida. Revise os campos antes de confirmar.',
  'serviceUpgradeForm.image': 'Nova imagem',
  'serviceUpgradeForm.bindings': 'Editar portas e volumes nesta atualização',
  'serviceUpgradeForm.health': 'Editar verificação de saúde nesta atualização',
  'serviceUpgradeForm.sidecars': 'Editar sidecars nesta atualização',
  'serviceUpgradeForm.ulimits': 'Editar limites de processo nesta atualização',
  'serviceUpgradeForm.security': 'Editar segurança nesta atualização',
  'serviceUpgradeForm.privileged': 'Modo privilegiado',
  'serviceUpgradeForm.readOnly': 'Sistema de arquivos somente leitura',
  'serviceUpgradeForm.memory': 'Editar memória nesta atualização',
  'serviceUpgradeForm.memoryLimit': 'Limite de memória',
  'serviceUpgradeForm.memoryReservation': 'Reserva de memória',
  'serviceUpgradeForm.cpu': 'Editar CPU e I/O nesta atualização',
  'serviceUpgradeForm.affinity': 'Editar afinidades nesta atualização',
  'serviceUpgradeForm.batch': 'Containers por lote',
  'serviceUpgradeForm.interval': 'Intervalo entre lotes (ms)',
  'serviceUpgradeForm.configuration': 'Atualização da configuração',
  'serviceUpgradeForm.imageUpgrade': 'Atualização da imagem',
  'serviceUpgradeForm.currentImage': 'Imagem atual:',
  'serviceUpgradeForm.capAdd': 'Capabilities adicionais',
  'serviceUpgradeForm.capDrop': 'Capabilities removidas',
  'serviceUpgradeForm.startFirst': 'Iniciar novos containers antes de parar os atuais',
  'serviceUpgradeForm.confirm': 'Atualizar configuração do serviço?',
} as const;
