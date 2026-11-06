/** Local account administration UI; helper validation errors remain at their source. */
export const enLocalAccountPanel = {
  'localAccountPanel.create': 'Create local account',
  'localAccountPanel.profile': 'Edit account profile',
  'localAccountPanel.password': 'Reset local password',
  'localAccountPanel.activate': 'Activate account',
  'localAccountPanel.deactivate': 'Deactivate account',
  'localAccountPanel.remove': 'Delete account',
  'localAccountPanel.createDescription':
    'The account is created without environment access. Grant access through groups after creation.',
  'localAccountPanel.cancel': 'Cancel',
  'localAccountPanel.reviewOperation': 'Review operation',
  'localAccountPanel.reviewChanges': 'Review changes',
  'localAccountPanel.name': 'Account name',
  'localAccountPanel.description': 'Account description',
  'localAccountPanel.kind': 'Global account role',
  'localAccountPanel.user': 'User',
  'localAccountPanel.admin': 'Administrator',
  'localAccountPanel.confirmAdmin': 'I confirm granting global Rancher administration',
  'localAccountPanel.adminDescription':
    'Administrators can access all environments and settings, regardless of groups.',
  'localAccountPanel.login': 'Local login',
  'localAccountPanel.newPassword': 'New local password',
  'localAccountPanel.confirmPassword': 'Confirm local password',
  'localAccountPanel.passwordNotice':
    'This change only affects the local credential. Previously issued JWT sessions are not revoked by a password change. Deactivate the account to block its use. Keycloak passwords are managed by the provider.',
  'localAccountPanel.deactivateNotice':
    'The account will stop authenticating and its next session check will be rejected. Existing groups and access will be preserved.',
  'localAccountPanel.removeNotice':
    'The account must be inactive. Rancher performs logical deletion; this screen does not purge the account or delete environment data.',
  'localAccountPanel.activateNotice':
    'The account can authenticate again and may regain existing direct and group access.',
  'localAccountPanel.reviewTitle': 'Apply account change?',
  'localAccountPanel.newAccount': 'new account',
  'localAccountPanel.abandon': 'Abandon incomplete registration?',
  'localAccountPanel.discard': 'Discard account changes?',
  'localAccountPanel.unsent': 'The changes have not been submitted yet.',
  'localAccountPanel.leave': 'Leave with a pending change?',
  'localAccountPanel.incomplete':
    'The account has already been created and its credential may be incomplete.',
  'localAccountPanel.success': 'Rancher received the operation. Follow the account state.',
  'localAccountPanel.accountDescription':
    'Account {account}. Global privileges are independent of groups.',
  'localAccountPanel.pending':
    'Account {account} has already been created. Complete its credential in this form; resubmitting reuses this account.',
  'localAccountPanel.reviewAdmin':
    '{operation}: {account}. The administrator role has global access. Credentials remain protected in this review.',
  'localAccountPanel.reviewDescription':
    '{operation}: {account}. Credentials remain protected in this review.',
  'localAccountPanel.pendingDiscard':
    'Account {account} already exists. Closing does not delete it and its credential may be incomplete; check the account before creating another registration.',
  'localAccountPanel.error.operation': 'The account operation could not be completed.',
  'localAccountPanel.error.list': 'Account administration could not be queried.',
  'localAccountPanel.error.unavailable': 'Account administration is unavailable.',
  'localAccountPanel.error.permission': 'Your administrator permission has changed.',
  'localAccountPanel.error.passwordMismatch': 'The passwords do not match.',
  'localAccountPanel.error.confirmPrivilege': 'Confirm global administrative access.',
  'localAccountPanel.error.duplicateLogin': 'A credential with this login already exists.',
  'localAccountPanel.error.notCreated': 'The account was not created.',
  'localAccountPanel.error.reopen': 'Reopen the account panel.',
  'localAccountPanel.error.credentialCount':
    'This account does not have exactly one active local credential. OIDC credentials are managed by the provider.',
  'localAccountPanel.error.credential': 'Invalid credential.',
  'localAccountPanel.error.changedOperation': 'The operation has changed. Reopen the panel.',
  'localAccountPanel.error.http': 'Account operation was not completed (HTTP {status}).',
} as const;
export const ptLocalAccountPanel = {
  'localAccountPanel.create': 'Criar conta local',
  'localAccountPanel.profile': 'Editar perfil da conta',
  'localAccountPanel.password': 'Redefinir senha local',
  'localAccountPanel.activate': 'Ativar conta',
  'localAccountPanel.deactivate': 'Desativar conta',
  'localAccountPanel.remove': 'Excluir conta',
  'localAccountPanel.createDescription':
    'A conta nasce sem acesso a environments. Conceda acesso pelos grupos após criar.',
  'localAccountPanel.cancel': 'Cancelar',
  'localAccountPanel.reviewOperation': 'Revisar operação',
  'localAccountPanel.reviewChanges': 'Revisar alterações',
  'localAccountPanel.name': 'Nome da conta',
  'localAccountPanel.description': 'Descrição da conta',
  'localAccountPanel.kind': 'Perfil global da conta',
  'localAccountPanel.user': 'Usuário',
  'localAccountPanel.admin': 'Administrador',
  'localAccountPanel.confirmAdmin': 'Confirmo conceder administração global do Rancher',
  'localAccountPanel.adminDescription':
    'Administradores acessam todos os environments e configurações, independentemente dos grupos.',
  'localAccountPanel.login': 'Login local',
  'localAccountPanel.newPassword': 'Nova senha local',
  'localAccountPanel.confirmPassword': 'Confirmar senha local',
  'localAccountPanel.passwordNotice':
    'A troca altera apenas a credencial local. Sessões JWT já emitidas não são revogadas pela troca de senha. Para bloquear o uso da conta, desative-a. Senhas do Keycloak são gerenciadas no provedor.',
  'localAccountPanel.deactivateNotice':
    'A conta deixará de autenticar e a próxima consulta de sessão será recusada. Grupos e acessos cadastrados serão preservados.',
  'localAccountPanel.removeNotice':
    'A conta deve estar inativa. A exclusão lógica é aplicada pelo Rancher; esta tela não executa purge nem apaga dados dos environments.',
  'localAccountPanel.activateNotice':
    'A conta volta a autenticar e poderá recuperar os acessos diretos e de grupos ainda cadastrados.',
  'localAccountPanel.reviewTitle': 'Aplicar alteração da conta?',
  'localAccountPanel.newAccount': 'nova conta',
  'localAccountPanel.abandon': 'Abandonar cadastro incompleto?',
  'localAccountPanel.discard': 'Descartar alterações da conta?',
  'localAccountPanel.unsent': 'As alterações ainda não foram enviadas.',
  'localAccountPanel.leave': 'Sair com alteração pendente?',
  'localAccountPanel.incomplete': 'A conta já foi criada e a credencial pode estar incompleta.',
  'localAccountPanel.success': 'Operação recebida pelo Rancher. Acompanhe o estado da conta.',
  'localAccountPanel.accountDescription':
    'Conta {account}. Privilégio global é independente dos grupos.',
  'localAccountPanel.pending':
    'A conta {account} já foi criada. Conclua a credencial neste formulário; repetir o envio reaproveita esta conta.',
  'localAccountPanel.reviewAdmin':
    '{operation}: {account}. O perfil administrativo tem acesso global. Credenciais ficam protegidas nesta revisão.',
  'localAccountPanel.reviewDescription':
    '{operation}: {account}. Credenciais ficam protegidas nesta revisão.',
  'localAccountPanel.pendingDiscard':
    'A conta {account} já existe. Fechar não a exclui e a credencial pode estar incompleta; verifique a conta antes de criar outro cadastro.',
  'localAccountPanel.error.operation': 'Não foi possível concluir a operação de conta.',
  'localAccountPanel.error.list': 'Não foi possível consultar a administração de contas.',
  'localAccountPanel.error.unavailable': 'Administração de contas indisponível.',
  'localAccountPanel.error.permission': 'Sua permissão de administrador mudou.',
  'localAccountPanel.error.passwordMismatch': 'As senhas não coincidem.',
  'localAccountPanel.error.confirmPrivilege': 'Confirme o acesso administrativo global.',
  'localAccountPanel.error.duplicateLogin': 'Já existe uma credencial com este login.',
  'localAccountPanel.error.notCreated': 'A conta não foi criada.',
  'localAccountPanel.error.reopen': 'Reabra o painel da conta.',
  'localAccountPanel.error.credentialCount':
    'Esta conta não possui uma única credencial local ativa. Credenciais OIDC são gerenciadas no provedor.',
  'localAccountPanel.error.credential': 'Credencial inválida.',
  'localAccountPanel.error.changedOperation': 'A operação mudou. Reabra o painel.',
  'localAccountPanel.error.http': 'Operação de conta não concluída (HTTP {status}).',
} as const satisfies Record<keyof typeof enLocalAccountPanel, string>;
