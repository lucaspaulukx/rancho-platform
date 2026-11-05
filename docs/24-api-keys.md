# Chaves de API no novo frontend

## Plano — 22/10/2026

1. Flag independente `modules.apiKeys`, inicialmente false; separar do módulo genérico api/webhooks ainda pendente. Tela no AppShell, seleção de escopo conta/environment, lista pesquisável de metadados, titular/estado e lifecycle nativo. Contas visíveis seguem a autorização do servidor; não inventar permissões/expiração que o Rancher não fornece.
2. Criar com nome/descrição. Segredo e valor público gerados pelo Rancher; não aceitar segredo fornecido pelo usuário neste recorte. Para environment, informar accountId do projeto selecionado e usar seu endpoint/schema; conta usa o vínculo nativo ao autenticado. Mostrar claramente o alcance de uma credencial persistente, inclusive independência da sessão pessoal em chaves de environment.
3. DTO antes de query cache: apenas id/type/name/description/accountId/state/created/removed/publicValue e self/actions permitidas. Nunca secretValue, request/response brutos ou credenciais em cache/mutation data/storage/logs. Criação guarda resposta secreta somente em estado privado cercado por identidade/escopo, exibido uma vez com mostrar/copiar e descarte protegido. Limpar em fechar, trocar contexto/identidade ou unmount.
4. Editar nome/descrição; ativar/desativar/remover/purge quando anunciados e autorizados. Revisão explícita, schema e recurso frescos antes de write, snapshot de metadados no edit, endpoint validado e guard de geração/identidade para evitar commits tardios/A→B→A. Erros preservam rascunho; nenhum retry automático de criação.
5. Separar chaves removidas e ativas usando filtros nativos; não mostrar opções que o backend não anuncia. A URL direta e navegação respeitam flag e permissões, com fallback de módulo desativado. Nenhuma alteração na UI Ember.
6. Gates: domínio/DTO/contratos, componente/segredo único e cache sanitizado, build, E2E em conta e environment com fixture identificada, autenticação Basic real, negação de escopo, lifecycle/revogação e cleanup sem tocar chaves existentes. Testar usuários não admin e relação com RBAC; não declarar que remover membership revoga chaves compartilhadas automaticamente.
7. Temas/claro/escuro/móvel, teclado, axe e flag; só ativar após gates reais. O segredo de uma chave real nunca aparece em screenshot/relatório; teste de clipboard usa credencial sintética no componente.

## Contrato conferido

Schema `apiKey`: coleção apiKeys, GET/POST; recurso GET/PUT/DELETE; name/description criáveis/editáveis; accountId/publicValue/secretValue criáveis, secretValue password; ações activate/deactivate/remove/purge. Endpoints de coleção reais: /v2-beta/apikeys e /v2-beta/projects/{env}/apikeys. Coleções de conta e UI-OPS-LAB estavam vazias na inspeção inicial. Não extrapolar para demais contas.

## Situação

Implementado e habilitado no laboratório (`modules.apiKeys=true`). Página própria no shell; busca, escopos conta/environment, filtros atual/removidas, criação/revisão, segredo mascarado/copiar/fechamento protegido, edição de metadados, ativação/desativação/revogação/purge conforme contrato atual.

Gates: 10 casos de domínio, 7 de página e 4 de geração/abort de escopo; build total 348 testes/41 arquivos + TypeScript/Vite. Navegador real: 20 checks de conta/environment, autenticação Basic em contextos independentes sem cookies, isolamento de environment, ciclo de vida completo, segredo único/mascarado, 4 combinações tema/tamanho sem violações axe/overflow, flag off. Matriz RBAC nativa: 9 checks, OIDC leitor, chave pessoal readonly, negação de criação de workload/chave compartilhada, revogação de grupo afetando chave pessoal, independência de chave compartilhada e cleanup.

Relatórios: `console/api-keys-e2e-results.json`, `api-keys-a11y-results.json`, `api-keys-roles-results.json`, `api-keys-cleanup-results.json`. Credenciais reais não foram gravadas em artefatos. Fixtures de chaves revogadas; vínculo temporário removido; manifests ausentes. O servidor mantém registros removidos/purgados nativos. Cleanup compara hashes dos recursos anteriores e aceita apenas transição assíncrona nativa de estado removing/removed/purging → purged sem diferença dos demais campos; não modifica essas chaves.

Particularidades provadas do Rancher: DELETE exige estado inactive; primeiro Desativar bloqueia o acesso, depois Revogar remove, com confirmação em cada etapa. Filtro de removidas requer `_removed=true&removed_notnull=true`; `removed_null=false` não inclui os registros esperados. Schema do environment pode impor titular e gerar segredo com accountId/secretValue create=false: POST sem esses campos, endpoint scoped, titular retornado validado. Nenhuma permissão inferida do schema global para esse caso.

Limites: não há expiração automática/rotação agendada inexistentes no contrato; chave de environment é compartilhada e não perde acesso ao remover usuário. Revogação de membership foi testada com novo request Basic, sem alegar encerramento de conexões longas preexistentes. Axe não equivale a conformidade manual integral.
