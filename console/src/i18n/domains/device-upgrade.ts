export const enDeviceUpgrade = {
  'deviceUpgrade.error.unavailable':
    'The device upgrade is not available for the current service, scope or native contract.',
  'deviceUpgrade.error.conflict':
    'The launch configuration or sidecars changed in another client. Reopen the device upgrade.',
  'deviceUpgrade.error.noChange':
    'Change the image or the selected configuration before upgrading device mappings.',
  'deviceUpgrade.error.disabled': 'Device mapping upgrades are disabled.',
} as const;

export const ptDeviceUpgrade = {
  'deviceUpgrade.error.unavailable':
    'O upgrade de dispositivos não está disponível para o serviço, escopo ou contrato nativo atual.',
  'deviceUpgrade.error.conflict':
    'A configuração de lançamento ou os sidecars foram alterados por outro cliente. Reabra o upgrade de dispositivos.',
  'deviceUpgrade.error.noChange':
    'Altere a imagem ou a configuração selecionada antes de atualizar os dispositivos.',
  'deviceUpgrade.error.disabled': 'O upgrade de dispositivos está desativado.',
} as const satisfies Record<keyof typeof enDeviceUpgrade, string>;
