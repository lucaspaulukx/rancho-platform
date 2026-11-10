export const enCatalogRepositories = {
  'catalogRepositories.defaultBranch': 'Server default',
  'catalogRepositories.title': 'Catalog repositories',
  'catalogRepositories.description':
    'Global Git source configuration. Changes can affect all environments.',
  'catalogRepositories.override': 'Database override.',
  'catalogRepositories.noOverride': 'No database override.',
  'catalogRepositories.tableLabel': 'Configured global repositories',
  'catalogRepositories.repository': 'Repository',
  'catalogRepositories.branch': 'Configured branch',
  'catalogRepositories.emptyTitle': 'No global repository configured',
  'catalogRepositories.emptyDescription': 'Environment-specific sources may still be available.',
  'catalogRepositories.editorTitle': 'Configure global repositories',
  'catalogRepositories.editorDescription':
    'Entries in this form affect the entire instance. URLs are protected by default.',
  'catalogRepositories.showUrls': 'Show repository URLs',
  'catalogRepositories.urlHint':
    'Git, SSH, HTTP or HTTPS. Credentials must not be included in HTTP URLs.',
  'catalogRepositories.branchHint': 'Leave blank to keep the server default.',
  'catalogRepositories.confirmEmpty': 'I confirm removing all global repositories',
  'catalogRepositories.saveTitle': 'Save global repositories?',
  'catalogRepositories.discardTitle': 'Discard repository changes?',
  'catalogRepositories.discardDescription': 'Changes have not been sent to the server yet.',
  'catalogRepositories.leaveTitle': 'Leave with a pending change?',
  'catalogRepositories.leaveDescription':
    'Repositories have not been saved yet. Wait for any ongoing submission.',
  'catalogRepositories.unavailable': 'Repositories unavailable with this access.',
  'catalogRepositories.refresh': 'Refresh listing',
  'catalogRepositories.configure': 'Configure repositories',
  'catalogRepositories.notice':
    'The list shows server configuration without verifying cloning, commits or synchronization. Each environment’s own catalogs are not changed here.',
  'catalogRepositories.cancel': 'Cancel',
  'catalogRepositories.review': 'Review repositories',
  'catalogRepositories.remove': 'Remove repository',
  'catalogRepositories.add': 'Add repository',
  'catalogRepositories.nameLabel': 'Repository name {index}',
  'catalogRepositories.urlLabel': 'Repository URL {index}',
  'catalogRepositories.branchLabel': 'Repository branch {index}',
  'catalogRepositories.removeLabel': 'Remove repository {index}',
  'catalogRepositories.reviewDescription':
    '{count} global repositories will be configured. The server may access these URLs and perform Git clones; saving does not verify synchronization. URLs remain protected in this review.',
  'catalogRepositories.repositoryIndex': 'Repository {index}',
  'catalogRepositories.source': 'Source: {source}.',
  'catalogRepositories.saved':
    'Configuration saved. Repository cloning and synchronization are performed by the catalog service.',
  'catalogRepositories.httpError': 'Catalog operation not completed (HTTP {status}).',
  'catalogRepositories.requestError': 'The catalog operation could not be completed.',
  'catalogRepositories.configurationUnavailable': 'Configuration unavailable.',
  'catalogRepositories.reopen': 'Reopen the editor.',
  'catalogRepositories.retry': 'Try again',
  'catalogRepositories.validation.configuration': 'Invalid catalog configuration.',
  'catalogRepositories.validation.jsonRequired':
    'This editor requires catalog.url in JSON format. Keep the value and use server settings for legacy formats.',
  'catalogRepositories.validation.document': 'Unsupported catalog document.',
  'catalogRepositories.validation.entry': 'Unsupported catalog entry.',
  'catalogRepositories.validation.limit': 'Too many repositories.',
  'catalogRepositories.validation.uniqueNames': 'Use unique names without spaces or reserved keys.',
  'catalogRepositories.validation.reopen': 'Reopen the repository editor.',
  'catalogRepositories.validation.confirmEmpty': 'Confirm removal of all global repositories.',
  'catalogRepositories.validation.url': 'Invalid repository URL.',
  'catalogRepositories.validation.urlParts':
    'Use a Git, SSH, HTTP, or HTTPS URL without a password, fragment, or HTTP credentials.',
  'catalogRepositories.validation.branch': 'Invalid branch. Use a Git reference name.',
} as const;

export const ptCatalogRepositories = {
  'catalogRepositories.defaultBranch': 'Padrão do servidor',
  'catalogRepositories.title': 'Repositórios de catálogo',
  'catalogRepositories.description':
    'Configuração global de fontes Git. Alterações podem afetar todos os environments.',
  'catalogRepositories.override': 'Override no banco de dados.',
  'catalogRepositories.noOverride': 'Sem override no banco de dados.',
  'catalogRepositories.tableLabel': 'Repositórios globais configurados',
  'catalogRepositories.repository': 'Repositório',
  'catalogRepositories.branch': 'Branch configurada',
  'catalogRepositories.emptyTitle': 'Nenhum repositório global configurado',
  'catalogRepositories.emptyDescription':
    'Fontes específicas de environments podem continuar disponíveis.',
  'catalogRepositories.editorTitle': 'Configurar repositórios globais',
  'catalogRepositories.editorDescription':
    'As entradas deste formulário afetam a instância inteira. URLs ficam protegidas por padrão.',
  'catalogRepositories.showUrls': 'Mostrar URLs dos repositórios',
  'catalogRepositories.urlHint':
    'Git, SSH, HTTP ou HTTPS. Credenciais não devem ser incluídas em URLs HTTP.',
  'catalogRepositories.branchHint': 'Em branco mantém o padrão do servidor.',
  'catalogRepositories.confirmEmpty': 'Confirmo remover todos os repositórios globais',
  'catalogRepositories.saveTitle': 'Salvar repositórios globais?',
  'catalogRepositories.discardTitle': 'Descartar alterações dos repositórios?',
  'catalogRepositories.discardDescription': 'As alterações ainda não foram enviadas ao servidor.',
  'catalogRepositories.leaveTitle': 'Sair com alteração pendente?',
  'catalogRepositories.leaveDescription':
    'Os repositórios ainda não foram salvos. Aguarde qualquer envio em andamento.',
  'catalogRepositories.unavailable': 'Repositórios indisponíveis neste acesso.',
  'catalogRepositories.refresh': 'Atualizar listagem',
  'catalogRepositories.configure': 'Configurar repositórios',
  'catalogRepositories.notice':
    'A lista mostra a configuração do servidor, sem comprovar clone, commit ou sincronização. Os catálogos próprios de cada environment não são alterados aqui.',
  'catalogRepositories.cancel': 'Cancelar',
  'catalogRepositories.review': 'Revisar repositórios',
  'catalogRepositories.remove': 'Remover repositório',
  'catalogRepositories.add': 'Adicionar repositório',
  'catalogRepositories.nameLabel': 'Nome do repositório {index}',
  'catalogRepositories.urlLabel': 'URL do repositório {index}',
  'catalogRepositories.branchLabel': 'Branch do repositório {index}',
  'catalogRepositories.removeLabel': 'Remover repositório {index}',
  'catalogRepositories.reviewDescription':
    'Serão configurados {count} repositórios globais. O servidor poderá acessar essas URLs e executar clones Git; salvar não comprova sincronização. URLs ficam protegidas nesta revisão.',
  'catalogRepositories.repositoryIndex': 'Repositório {index}',
  'catalogRepositories.source': 'Origem: {source}.',
  'catalogRepositories.saved':
    'Configuração salva. O clone e a sincronização dos repositórios são executados pelo serviço de catálogo.',
  'catalogRepositories.httpError': 'Operação de catálogo não concluída (HTTP {status}).',
  'catalogRepositories.requestError': 'Não foi possível concluir a operação de catálogo.',
  'catalogRepositories.configurationUnavailable': 'Configuração indisponível.',
  'catalogRepositories.reopen': 'Reabra o editor.',
  'catalogRepositories.retry': 'Tentar novamente',
  'catalogRepositories.validation.configuration': 'Configuração de catálogo inválida.',
  'catalogRepositories.validation.jsonRequired':
    'Este editor exige catalog.url no formato JSON. Preserve o valor e use a configuração do servidor para formatos legados.',
  'catalogRepositories.validation.document': 'Documento de catálogo não suportado.',
  'catalogRepositories.validation.entry': 'Entrada de catálogo não suportada.',
  'catalogRepositories.validation.limit': 'Quantidade de repositórios excedida.',
  'catalogRepositories.validation.uniqueNames':
    'Use nomes únicos, sem espaços ou chaves reservadas.',
  'catalogRepositories.validation.reopen': 'Reabra o editor de repositórios.',
  'catalogRepositories.validation.confirmEmpty':
    'Confirme a remoção de todos os repositórios globais.',
  'catalogRepositories.validation.url': 'URL do repositório inválida.',
  'catalogRepositories.validation.urlParts':
    'Use URL Git, SSH, HTTP ou HTTPS sem senha, fragmento ou credenciais HTTP.',
  'catalogRepositories.validation.branch': 'Branch inválida. Use um nome de referência Git.',
} as const;
