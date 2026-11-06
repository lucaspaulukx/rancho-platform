export const enStackComposeUpgradePanel = {
  'stackComposeUpgradePanel.dockerCompose': 'Docker Compose',
  'stackComposeUpgradePanel.rancherCompose': 'Rancher Compose',
  'stackComposeUpgradePanel.impact':
    'I understand that the upgrade may start services and replace containers',
  'stackComposeUpgradePanel.reviewTitle': 'Upgrade the stack using Compose?',
  'stackComposeUpgradePanel.reviewDescription':
    'Files are hidden during review. The stack and its export will be checked again before submission. Existing parameters are preserved. The server validates the YAML and performs the upgrade.',
  'stackComposeUpgradePanel.discardTitle': 'Discard Compose changes?',
  'stackComposeUpgradePanel.discardDescription':
    'The edited files have not been sent to Rancher yet.',
  'stackComposeUpgradePanel.leaveTitle': 'Leave with pending Compose changes?',
  'stackComposeUpgradePanel.leaveDescription':
    'The files have not been sent yet. Wait for any upgrade in progress.',
  'stackComposeUpgradePanel.close': 'Close',
  'stackComposeUpgradePanel.review': 'Review upgrade',
  'stackComposeUpgradePanel.warning':
    'Upgrading Compose may start services and recreate containers. Rancher preserves the scale of existing services. Use Scale service to change it. New services may start with a scale of 1 even with scale: 0 in the file. The export is not a full environment backup. Check the scale and files before continuing.',
  'stackComposeUpgradePanel.title': 'Upgrade Compose · {name}',
  'stackComposeUpgradePanel.description':
    'Environment: {name}. Files exported from the current configuration.',
  'stackComposeUpgradePanel.saved':
    'Upgrade received. Follow the stack and choose to finish or roll back using the native actions.',
  'stackComposeUpgradePanel.unavailable': 'The Compose editor is unavailable for this stack.',
  'stackComposeUpgradePanel.permission': 'Your permission to export or upgrade is unavailable.',
  'stackComposeUpgradePanel.loadFailed': 'Compose unavailable.',
  'stackComposeUpgradePanel.reopen': 'Reopen the Compose editor.',
  'stackComposeUpgradePanel.requestFailed': 'The Compose operation could not be completed.',
  'stackComposeUpgradePanel.httpError':
    'Compose operation not completed (HTTP {status}). Review the file or check the stack processes.',
  'stackComposeUpgradePanel.validation.stackUnavailable':
    'The stack is unavailable in this environment or state.',
  'stackComposeUpgradePanel.validation.noSource':
    'This stack has no Compose source. Use the service editors.',
  'stackComposeUpgradePanel.validation.actionUnavailable': 'The stack action is unavailable.',
  'stackComposeUpgradePanel.validation.invalidTarget': 'Invalid stack action target.',
  'stackComposeUpgradePanel.validation.invalidExport': 'Invalid Compose export.',
  'stackComposeUpgradePanel.validation.exportTooLarge':
    'The export exceeds the limit of 512 KiB per file.',
  'stackComposeUpgradePanel.validation.confirmImpact': 'Confirm the impact of upgrading the stack.',
  'stackComposeUpgradePanel.validation.contractUnavailable':
    'The stack upgrade contract is unavailable.',
  'stackComposeUpgradePanel.validation.stackChanged':
    'The stack or its services changed. Reopen the editor.',
  'stackComposeUpgradePanel.validation.changeRequired': 'Change a Compose file before submitting.',
  'stackComposeUpgradePanel.validation.fieldDenied': 'The Compose field is not allowed.',
  'stackComposeUpgradePanel.validation.invalidFiles':
    'Review the Compose files and the 512 KiB UTF-8 limit.',
  'stackComposeUpgradePanel.validation.preserveParameters':
    'The current parameters cannot be preserved under this contract.',
  'stackComposeUpgradePanel.validation.invalidParameter':
    'A stack parameter is outside the contract.',
} as const;

export const ptStackComposeUpgradePanel = {
  'stackComposeUpgradePanel.dockerCompose': 'Docker Compose',
  'stackComposeUpgradePanel.rancherCompose': 'Rancher Compose',
  'stackComposeUpgradePanel.impact':
    'Entendo que o upgrade pode iniciar serviços e substituir containers',
  'stackComposeUpgradePanel.reviewTitle': 'Atualizar a stack por Compose?',
  'stackComposeUpgradePanel.reviewDescription':
    'Os arquivos foram ocultados na revisão. A stack e sua exportação serão conferidas novamente antes do envio. Parâmetros existentes serão preservados; o servidor valida o YAML e executa a atualização.',
  'stackComposeUpgradePanel.discardTitle': 'Descartar alterações Compose?',
  'stackComposeUpgradePanel.discardDescription':
    'Os arquivos editados ainda não foram enviados ao Rancher.',
  'stackComposeUpgradePanel.leaveTitle': 'Sair com Compose pendente?',
  'stackComposeUpgradePanel.leaveDescription':
    'Os arquivos ainda não foram enviados. Aguarde qualquer atualização em andamento.',
  'stackComposeUpgradePanel.close': 'Fechar',
  'stackComposeUpgradePanel.review': 'Revisar atualização',
  'stackComposeUpgradePanel.warning':
    'Atualizar Compose pode iniciar serviços e recriar containers. O Rancher preserva a escala dos serviços existentes; use Escalar serviço para alterá-la. Novos serviços podem iniciar com escala 1 mesmo com scale: 0 no arquivo. A exportação não é um backup completo do ambiente. Confirme a escala e os arquivos antes de continuar.',
  'stackComposeUpgradePanel.title': 'Atualizar Compose · {name}',
  'stackComposeUpgradePanel.description':
    'Environment: {name}. Arquivos exportados da configuração atual.',
  'stackComposeUpgradePanel.saved':
    'Upgrade recebido. Acompanhe a stack e escolha finalizar ou rollback nas ações nativas.',
  'stackComposeUpgradePanel.unavailable': 'Editor Compose indisponível para esta stack.',
  'stackComposeUpgradePanel.permission':
    'Sua permissão de exportar ou atualizar não está disponível.',
  'stackComposeUpgradePanel.loadFailed': 'Compose indisponível.',
  'stackComposeUpgradePanel.reopen': 'Reabra o editor Compose.',
  'stackComposeUpgradePanel.requestFailed': 'Não foi possível concluir a operação Compose.',
  'stackComposeUpgradePanel.httpError':
    'Operação Compose não concluída (HTTP {status}). Revise o arquivo ou consulte os processos da stack.',
  'stackComposeUpgradePanel.validation.stackUnavailable':
    'Stack indisponível neste environment ou estado.',
  'stackComposeUpgradePanel.validation.noSource':
    'Esta stack não tem Compose de origem. Use os editores dos serviços.',
  'stackComposeUpgradePanel.validation.actionUnavailable': 'Ação da stack indisponível.',
  'stackComposeUpgradePanel.validation.invalidTarget': 'Destino de ação da stack inválido.',
  'stackComposeUpgradePanel.validation.invalidExport': 'Exportação Compose inválida.',
  'stackComposeUpgradePanel.validation.exportTooLarge':
    'A exportação excede o limite de 512 KiB por arquivo.',
  'stackComposeUpgradePanel.validation.confirmImpact':
    'Confirme o impacto da atualização da stack.',
  'stackComposeUpgradePanel.validation.contractUnavailable':
    'Contrato de atualização de stack indisponível.',
  'stackComposeUpgradePanel.validation.stackChanged':
    'A stack ou os serviços mudaram. Reabra o editor.',
  'stackComposeUpgradePanel.validation.changeRequired':
    'Altere um arquivo Compose antes de enviar.',
  'stackComposeUpgradePanel.validation.fieldDenied': 'Campo Compose não permitido.',
  'stackComposeUpgradePanel.validation.invalidFiles':
    'Revise os arquivos Compose e o limite de 512 KiB UTF-8.',
  'stackComposeUpgradePanel.validation.preserveParameters':
    'Os parâmetros atuais não podem ser preservados com este contrato.',
  'stackComposeUpgradePanel.validation.invalidParameter': 'Parâmetro da stack fora do contrato.',
} as const;
