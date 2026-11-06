export const enHostRegistration = {
  'hostRegistration.unavailable': 'Registration did not become available. Try again.',
  'hostRegistration.pending': 'Registration is still being prepared. Wait and try again.',
  'hostRegistration.failed': 'Unable to prepare registration.',
  'hostRegistration.title': 'Add host',
  'hostRegistration.environment': 'Environment: {name}',
  'hostRegistration.close': 'Close',
  'hostRegistration.register': 'Register a Docker host',
  'hostRegistration.instructions':
    'Run the command on the host you want to add. It must be able to reach the Rancher server address and use a Docker version compatible with Rancher 1.6.',
  'hostRegistration.warning':
    'The command authorizes an agent in this environment and runs a privileged container on the chosen host. Share it only with the administrators of that host.',
  'hostRegistration.denied': 'Your role does not allow registering hosts in this environment.',
  'hostRegistration.refresh': 'Refresh command',
  'hostRegistration.prepare': 'Prepare registration command',
  'hostRegistration.command': 'Registration command',
  'hostRegistration.notice':
    'The command is displayed only in this panel. The new host will appear in the list after the agent connects.',
  'secretField.copyFailed': 'Unable to copy. Reveal the value and copy it manually.',
  'secretField.hide': 'Hide',
  'secretField.reveal': 'Reveal',
  'secretField.copied': 'Copied',
  'secretField.copy': 'Copy',
} as const;
export const ptHostRegistration = {
  'hostRegistration.unavailable': 'O registro não ficou disponível. Tente novamente.',
  'hostRegistration.pending': 'O registro ainda está sendo preparado. Aguarde e tente novamente.',
  'hostRegistration.failed': 'Não foi possível preparar o registro.',
  'hostRegistration.title': 'Adicionar host',
  'hostRegistration.environment': 'Environment: {name}',
  'hostRegistration.close': 'Fechar',
  'hostRegistration.register': 'Registrar um host Docker',
  'hostRegistration.instructions':
    'Execute o comando no host que deseja adicionar. Ele deve conseguir acessar o endereço do servidor Rancher e usar uma versão de Docker compatível com o Rancher 1.6.',
  'hostRegistration.warning':
    'O comando autoriza um agente neste environment e executa um container privilegiado no host escolhido. Compartilhe-o somente com quem administra esse host.',
  'hostRegistration.denied': 'Seu perfil não permite registrar hosts neste environment.',
  'hostRegistration.refresh': 'Atualizar comando',
  'hostRegistration.prepare': 'Preparar comando de registro',
  'hostRegistration.command': 'Comando de registro',
  'hostRegistration.notice':
    'O comando é exibido apenas neste painel. O novo host aparecerá na listagem após o agente conectar.',
  'secretField.copyFailed': 'Não foi possível copiar. Revele o valor e copie manualmente.',
  'secretField.hide': 'Ocultar',
  'secretField.reveal': 'Revelar',
  'secretField.copied': 'Copiado',
  'secretField.copy': 'Copiar',
} as const;
