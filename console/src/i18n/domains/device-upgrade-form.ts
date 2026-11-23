export const enDeviceUpgradeForm = {
  'deviceUpgradeForm.edit': 'Edit devices in this upgrade',
  'deviceUpgradeForm.impact':
    'Changing device mappings replaces the service containers and can change access to host devices. Removing all rows removes explicit mappings; it does not remove the runtime’s default devices or change other launch settings.',
  'deviceUpgradeForm.reset': 'Remove all explicit mappings',
  'deviceUpgradeForm.confirmTitle': 'Upgrade the service devices?',
  'deviceUpgradeForm.confirmDescription':
    'Service {service}. Device mappings change access to host devices and replace service containers. An empty list removes explicit mappings; runtime default device permissions remain. Other options selected for this upgrade can affect ports, mounts, sidecars and health. Review all selected changes before confirming.',
} as const;

export const ptDeviceUpgradeForm = {
  'deviceUpgradeForm.edit': 'Editar dispositivos nesta atualização',
  'deviceUpgradeForm.impact':
    'Alterar mapeamentos de dispositivos substitui os containers do serviço e pode mudar o acesso a dispositivos do host. Remover todas as linhas retira os mapeamentos explícitos; não remove os dispositivos padrão do runtime nem altera as outras configurações de lançamento.',
  'deviceUpgradeForm.reset': 'Remover todos os mapeamentos explícitos',
  'deviceUpgradeForm.confirmTitle': 'Atualizar dispositivos do serviço?',
  'deviceUpgradeForm.confirmDescription':
    'Serviço {service}. Mapeamentos de dispositivos alteram o acesso ao host e substituem containers do serviço. Uma lista vazia retira os mapeamentos explícitos; as permissões padrão de dispositivos do runtime permanecem. Outras opções selecionadas nesta atualização podem afetar portas, montagens, sidecars e saúde. Revise todas as alterações selecionadas antes de confirmar.',
} as const satisfies Record<keyof typeof enDeviceUpgradeForm, string>;
