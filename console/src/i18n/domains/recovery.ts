/** Recovery messages deliberately exclude exception messages, URLs and stack traces. */
export const enRecovery = {
  'recovery.moduleTitle': 'This page could not be loaded',
  'recovery.renderTitle': 'This page could not be opened',
  'recovery.moduleDescription':
    'The console may have been updated or the connection interrupted. Reload to fetch the current version. Unsaved changes in this tab may be lost.',
  'recovery.renderDescription':
    'An interface error occurred. You can open another section or reload this page. Unsaved changes in this tab may be lost.',
  'recovery.reload': 'Reload console',
} as const;

export const ptRecovery = {
  'recovery.moduleTitle': 'Não foi possível carregar esta página',
  'recovery.renderTitle': 'Não foi possível abrir esta página',
  'recovery.moduleDescription':
    'A console pode ter sido atualizada ou a conexão foi interrompida. Recarregue para buscar a versão atual. Alterações não salvas nesta aba podem ser perdidas.',
  'recovery.renderDescription':
    'Ocorreu uma falha na interface. Você pode acessar outra seção ou recarregar esta página. Alterações não salvas nesta aba podem ser perdidas.',
  'recovery.reload': 'Recarregar console',
} as const satisfies Record<keyof typeof enRecovery, string>;
