# 42 — Administração de contas locais na tela Usuários

## Plano antes do código

Gap restante F8: Users hoje lista contas e grupos, mas não cria conta/senha, edita perfil global nem oferece lifecycle. Contratos nativos: accounts POST/PUT e actions activate/deactivate/remove; passwords POST com accountId/publicValue/secretValue e changesecret com oldSecret/newSecret. UI legada usa criação em duas etapas e changesecret, com oldSecret vazio para admin. Verificar contrato real com fixture antes de implementar, sem pressupor atomicidade ou revogação de JWT.

Primeiro probe sandbox: criar usuário comum sem environment, criar credencial aleatória apenas na memória, provar login local e zero projects; editar nome/descrição, resetar senha com contrato admin, testar credencial anterior/nova; desativar/reativar e medir sessão existente/login; remover apenas conta/credencial próprias no finally e comparar contas/credenciais anteriores. Sem promover usuários existentes ou usar dados produtivos. Relatório metadata only e manifesto sem segredos.

Após probe: flag localAccountAdministration na própria tela Usuários, criação com perfil explicitamente revisado (default user), editor de nome/descrição/perfil e senha em ações separadas, ações no menu comum. Passwords/secretValue fora de cache e storage, somente metadados de login; payloads protegidos e erros sanitizados. Exclusividade OIDC não deve ser desativada pelo editor de conta.

Criação em duas etapas deve manter ID da conta criada se senha falhar, permitindo concluir credencial sem criar conta duplicada; não apagar conta automaticamente. Revalidar admin/token/schema/snapshot antes de cada envio. Proteger operação sobre si próprio e impedir perda do último admin ativo na UI; limitação de corrida entre admins documentada se API nativa não tem CAS. Sem externalId/uuid editáveis, sem criar credencial local automaticamente para identidade OIDC. Reset de senha só para credencial local preexistente e com revisão.

Testar domínios e UI claro/escuro ×desktop/móvel; local accounts criadas só para fixture e limpas por marker/ID; matriz readonly/sem acesso e preservação de grants/contas existentes. Senha alterada não equivale a revogar JWT: medir comportamento e distinguir explicitamente no produto/documentação.

## Resultado

Recorte habilitado em `modules.localAccountAdministration=true` após aceite integrado. Entradas na lista/detalhe de Usuários pelo menu comum; drawers reutilizam Modal/Field/CheckboxField/Confirm e temas do shell. Criação de conta comum e credencial em duas etapas, nome/descrição/perfil, redefinição de senha local e activate/deactivate/remove nativos. Sem alterações no Ember. Desligar a flag retira escritas dessa tela e preserva contas/credenciais/grupos.

O envio revalida sessão administrativa, identidade interna, schema e snapshot. `GET token` nativo não retorna accountId: sua identidade `rancher_id` contém ID numérico, enquanto contas usam `1a…`. Corrigida a resolução explícita, sem tratar oidc_subject externo como ID local. Isso também protege as ações sobre o próprio administrador. Perfil administrativo exige checkbox de revisão; usuário comum nasce com zero environments. Descrição vazia no PUT é enviada explicitamente para permitir limpeza do campo.

Senhas ficam no estado privado do editor e no corpo HTTPS/HTTP localhost autorizado; não entram no query/mutation cache, storage, relatório ou screenshot. Erros da API são substituídos por HTTP/mensagem segura. Falha na segunda etapa mantém ID da conta para retry, sem criação duplicada. Fechar cadastro parcial exige confirmação e preserva o recurso já criado; falha de rede após commit sem resposta ainda exige conferir a lista. Uma credencial já persistida em uma resposta incerta não comprova que a senha digitada na tentativa seguinte é igual: verificar login ou usar redefinição. Não há transação distribuída entre conta e credencial.

### Correção nativa de sessão

Probe real mostrou que `GET token` devolvia identidade e perfil antigos após desativação/rebaixamento. `LocalAuthTokenUtils.retrieveCurrentToken` agora valida a conta atual via getAccountFromJWT e atualiza userType a partir dela. Flag independente `RANCHER_SESSION_ACCOUNT_GUARD_ENABLED=true` no Compose; false restaura o comportamento legado e não é opção visual. O contrato Java passou 118 asserts/64 combinações. Não altera expiração criptográfica nem implementa logout federado.

Troca de senha rejeita a anterior e aceita a nova, mas **não revoga JWT já emitido**. Produto informa esse limite. Desativação faz a consulta da sessão existente e novo login retornarem401; reativação recupera login/grants cadastrados. Exclusão lógica só após inativação, sem purge. Proteção de último admin na UI e comparação de snapshot não são CAS atômico contra outro administrador/API.

### Evidência e repetição

- Gate de build:536 testes/61 arquivos + TypeScript/Vite; sete testes de contas incluem identidade nativa, limites/privilégios, snapshot, proteção de segredo, retry sem duplicar e ausência de credencial OIDC implícita.
- `python -u console/tests/local_account_contract.py`:dez checks nativos, criação/login/zero env, perfil, reset, desativação/reativação e promoção/rebaixamento na sessão existente. Senhas aleatórias somente em memória.
- `python -u console/tests/e2e/run.py local-accounts`:25 checks/12 cenários de tema, fluxo real de administração e do usuário criado, temas claro/escuro ×1440/390 para criar/perfil/senha, axe sem violações e sem overflow; autopromoção negada pela API, flag off e ausência de exceções JS.
- `local-account-contract-results.json`, `local-accounts-e2e-results.json`, `local-accounts-a11y-results.json`, `local-account-contract-cleanup-results.json`. Screenshots de senhas mascaradas; revisão visual móvel realizada.

Tentativas iniciais identificaram comparação incorreta de identidade e expectativas equivocadas do harness (login bem sucedido cria token com201, não200); corrigidas e repetidas. Limpeza de cada tentativa foi conferida, sem registrar falhas como aceite.

### Limpeza exclusiva do laboratório

O schema anuncia DELETE de password, mas a API responde405. Remover a conta não remove automaticamente a credencial. O helper de teste primeiro desativa/remove somente a conta UUID/marker do manifesto, desativa a própria password e aplica soft-remove SQL **apenas nessa credencial inativa**, vinculada à conta já removida e validada. Não lê secretValue, não toca usuários anteriores e não faz parte do produto/UI. Hashes dos perfis e metadados de todas as contas/passwords anteriores são comparados; manifesto só é removido após igualdade. Não executar esse helper sem manifesto próprio nem usá-lo como migração produtiva.

Administração de provedores de autenticação, bootstrap de admin OIDC exclusivo, contas técnicas, migrações e revogação imediata de streams continuam em gates próprios. Este recorte não fecha F8 nem o projeto.
