# 06 — APIs e regras de autenticação/autorização

## Checkpoint documental — 21/10/2026

Criação/edição/lifecycle revalidam schema/recurso e usam guard de identidade/environment; escala envia somente scale. Restart de serviço exige rollingRestartStrategy (batchSize 1, intervalMillis 2000). Upgrade de catálogo exige aceite do impacto, pois pode iniciar serviços parados. Guard/snapshot são defesas de cliente; autorização definitiva permanece no backend. Expiração real de JWT, logout federado e recuperação completa continuam gates abertos.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


## Contratos já presentes no protótipo

| Contrato | Comportamento atual / limite |
|---|---|
| `GET /v2-beta/localGroups` | Listagem administrativa; exige controle de acesso habilitado e administrador. |
| `POST /v2-beta/localGroups` | Criação/atualização; grupo tem nome, membros por account ID interno, mapa environment → papel e revision. `delete:true` exclui. Não é uma API REST nova presumida pela UI. |
| IDs de grupos | Formatados pelo Rancher (`1lg!…`); parse no servidor, sem concatenar IDs de conta com prefixes arbitrários. |
| Concorrência | Revision desatualizada recebe 409. Atualização de membros/grants é transacional. |
| Grants locais | Consultados nas verificações de acesso; não se limitam a esconder itens no menu. Acrescentam acesso aos vínculos diretos nativos. |
| Papéis | `owner`, `member`, `readonly`, `restricted`, conforme contratos/schemas originais. A UI não inventa equivalência de permissões. |
| Auditoria | Snapshots antes/depois, ator, grupo, operação, instante UTC; gravação atômica com a mutação. Histórico anterior preservado sem snapshots retroativos. |
| `GET /v2-beta/localGroupAudits` | Somente leitura administrativa; filtro opcional `groupId` e cursor exclusivo positivo `before`; ordem decrescente, até 100 eventos. Inclui grupos excluídos. |
| `GET /v2-beta/localAccessReports` | Somente leitura; admin consulta contas/environments explícitos. Usuário comum consulta somente sua conta em environment autorizado nativamente. `targetAccount=self` é resolvido pelo principal autenticado; IDs explícitos crus/formatados continuam aceitos. Retorna papel, fontes e completude. |
| `GET /oidc/status` | Disponibilidade e campos only/autoLogin validados em mudanças reais de modo e no navegador. |
| `/oidc/login`, `/oidc/callback` | Fluxo Authorization Code, state ligado ao browser, nonce e PKCE S256. |
| Login Rancher `oidc-ticket` | Consome ticket curto de uso único e cria sessão Rancher pelo fluxo local existente. O token Keycloak não vira diretamente cookie Rancher. |

Fonte é a autoridade dos payloads atuais. Adaptadores tipados da nova console devem ter fixtures extraídas e sanitizadas dos contratos reais. Paginação, campos obrigatórios, actions e schemas variam por recurso/papel.

## Fluxo OIDC

1. Navegação completa do browser para `/oidc/login`, evitando interceptação pelo router Ember.
2. Backend registra state/nonce/verifier e cookie vinculado ao browser, com expiração.
3. Callback troca code no backchannel e valida assinatura RS256/JWKS, issuer, audience, expiração, nonce e demais claims aplicáveis.
4. Identidade é vinculada por issuer + subject. Email não é chave de associação automática.
5. Ticket temporário é entregue à página de login e consumido uma vez. A URL é limpa antes da navegação final.
6. Backend cria a sessão Rancher; frontend restaura identidade e consulta environments autorizados. Zero environments leva ao estado de acesso pendente.

Novo usuário comum não recebe grant, grupo, papel administrativo ou environment automaticamente. Membros de grupos são administrados no Rancher. Claims de grupos Keycloak não alteram essa decisão.

Falhas de state, nonce, assinatura, replay ou identidade desabilitada negam login. Mensagens não expõem token ou secret. Callback e redirects não aceitam URL externa arbitrária fornecida pelo usuário.

## OIDC exclusivo e sessões

O backend precisa bloquear senha local e sessões interativas locais já existentes quando exclusivo estiver ativo. Esconder o formulário não satisfaz essa regra. `GET /token`, endpoints de recursos e restauração de sessão precisam concordar. Marca de método de login deve ser validada pelo backend e não vir de um campo manipulável pelo browser.

Chaves de API, contas técnicas, WebSockets/exec e tokens de agentes têm contratos próprios: não presumir que a mudança em sessões interativas os revoga ou os mantém corretos. Essa matriz é bloqueio de liberação produtiva até teste específico.

Logout encerra sessão local e interrompe autologin na tela de saída. Logout no IdP é uma capacidade separada: só anunciar logout federado quando endpoint, sessão e redirects tiverem sido implementados/testados. Indisponibilidade do IdP deve permitir erro com retry explícito sem loop.

## Contratos ainda necessários

| Contrato planejado | Uso | Gate |
|---|---|---|
| Configuração pública sanitizada | Flags/capacidades/tema efetivos | F0/F1 |
| Consulta de acesso efetivo | Acesso direto, grupos contribuintes e papel efetivo por environment, calculados no servidor | F3 |
| Auditoria detalhada/paginada | Ator, alvo, antes/depois, filtro e retenção | F3/F8 |
| Encerramento/revalidação de streams | Efeito de revogação em conexões já abertas | F7 |

O diagnóstico administrativo e self-service foi entregue em `localAccessReports`; a UI não soma papéis. A autorização nativa e o relatório compartilham `AuthDaoImpl.resolveProjectRole`, incluindo prioridades configuradas no Rancher. Fontes incluem vínculos diretos ativos, grupos locais e privilégio global de administrador. Conta inativa não recebe papel efetivo. Identidades locais Rancher/OIDC são completas no escopo documentado; identidades dinâmicas de outros provedores são parciais e não recebem um papel completo presumido.

Self-service usa `Policy.getAuthenticatedAsAccountId()`, nunca a conta de contexto. O environment exige `authDao.hasAccessToProject` com `usingAccount=null`, evitando o atalho nativo de igualdade entre conta de contexto e projeto. Conta/projeto removidos são recusados para usuário comum. Auditoria e gestão de grupos continuam administrativas; o schema de usuário só recebe leitura do relatório. O GET nativo de sessão pode retornar `accountId=null`; por isso o menu compartilhado envia `self`, sem derivar ID de claims ou decodificar JWT. Trinta e cinco checks de API e três de browser comprovaram sujeito, ambientes permitidos, contextos forjados, negação de terceiros/escrita e regressões de fontes/auditoria.

Os parâmetros são intencionalmente `targetAccount`/`targetEnvironment`: `projectId` é consumido pelo autenticador nativo como mudança de contexto antes do resource manager e não deve ser usado como filtro desse relatório. Auditoria usa a tabela aditiva `local_rbac_audit_detail`; `local_rbac_audit` continua preservada. O rollout produtivo exige migração versionada e plano de compatibilidade/rollback, não remoção das tabelas para desfazer a UI.

## Regras comuns do cliente

Mesmo origin no laboratório; proxy entrega console e API sem CORS permissivo. Compartilhar cliente HTTP com cookies, timeout, cancelamento, erros normalizados e política de reautenticação. Não usar cookie/token em query de navegação genérica. Verificar proteção CSRF do contrato real antes de qualquer novo endpoint de mutação; adicionar proteção compatível quando necessária.

Separar identidade global e escopo do environment. ID vindo de URL nunca prova autorização. Verificação no backend em leitura, escrita, actions e acesso direto. Requisições sem permissão devem falhar mesmo fora do browser.

Auditoria e diagnóstico não registram credenciais, conteúdo de secrets ou tokens de console. Erro amigável pode conter identificador de correlação, nunca stack trace completo com material sensível.

## Adaptadores nativos da console independente

- Políticas de rede: contrato lido em `/v2-beta/projects/1a12/schemas/network` e recursos de rede escopados, registrado em `console/network-contract.json`. Redes compatíveis são `ipsec` e `vxlan`, conforme o frontend original. Campos nativos `defaultPolicyAction` e `policy` exigem PUT e permissão de update no schema. O painel simplificado permite as regras `within=linked/service/stack`; seletores, portas, regras duplicadas ou desconhecidas bloqueiam edição para preservar configurações avançadas. Não remove nem converte essas regras. Antes de salvar, relê rede/schema/stack `network-policy-manager` com contexto explícito e exige gerenciador ativo/saudável. Comparação de snapshot detecta concorrência no cliente, sem prometer CAS atômico. A revisão mostra somente mudanças reais com antes/depois; envio sem mudanças fica bloqueado. Após salvar, consulta periódica acompanha o estado nativo.

Aceite físico ipsec em `CONSOLE-POLICY-LAB` (`1a417`), host exclusivo `1h2`, rede `1n71`: template `library:infra*network-policy-manager:3`, imagem oficial `rancher/network-policy-manager:v0.2.8`. Aplicar `defaultPolicyAction=deny` pelo novo painel bloqueou três conexões HTTP novas entre fixtures em stacks distintas, mantendo o servidor saudável. Restauração via API da configuração inicial restabeleceu HTTP e preservou exatamente a política original. O hash da política de `UI-OPS-LAB` não mudou. Leitor temporário conseguiu GET, não recebeu PUT no schema, teve PUT direto negado e perdeu acesso na sessão existente após remover o grant. Grupos temporários e stacks HTTP foram removidos. São 16 checks em `console/policy-physical-test-results.json`. A VM extra foi desligada limpidamente, com volume preservado. Não comprova vxlan, multi-host, todas as combinações de regras, revogação de sockets ou TLS de aplicação.

- Catálogo usa `/v1-catalog`, encaminha `X-Api-Project-Id` em todas as páginas e envia os arquivos originais e as respostas em `stack.environment`. Tipos de pergunta desconhecidos impedem o lançamento. No template InfluxDB, a resposta `EXPOSE_SERVICE=false` remove imagem/portas do LB no Docker Compose, mas o rancher-compose ainda declara seus metadados. A console preserva esse comportamento nativo.
- Secrets recebem base64 de bytes UTF-8, respeitando o limite após codificação. Nome e conteúdo não são alteráveis depois da criação. Não há recuperação do conteúdo pelo editor.
- Registry é salvo antes de suas credenciais. `registryCredential` usa a coleção retornada pelo schema, vínculo `registryId`, usuário em `publicValue` e senha em `secretValue`. Senha omitida no PUT preserva a existente. Erros de envio não exibem os payloads privados.
- Certificados exigem PEM e chave sem senha na criação/substituição. Edição de metadados relê e reenvia o certificado público: `CertificateCreateValidationFilter.update` do Cattle recalcula seus campos a cada PUT. A chave privada não é relida ou reenviada nessa edição. O modo de substituição exige confirmação se existe rascunho e limpa a cadeia antiga quando não informada uma nova.
- Respostas de dados/credenciais são sanitizadas antes do query cache. Mutações têm `gcTime: 0`; valores privados de formulários permanecem somente enquanto o editor está montado. Isso não equivale a apagar memória do runtime por garantia criptográfica.
- Volumes locais foram conferidos na VM isolada: escrita e leitura por containers distintos, montagem `rw` no escritor e `ro` no leitor. Snapshot/backup e drivers externos continuam dependentes de aceite específico.

## Métricas e revalidação de streams

O acesso nativo a stats retorna `{url,token}`; ambos ficam somente no ciclo local de conexão, fora do query cache, persistência e logs. O gateway mantém a conexão same-origin e não registra queries de acesso. Relações de recursos excluem stats do painel genérico para não cachear material de conexão.

- Frames de container podem usar Docker `externalId`, não o ID Cattle. Host pode reportar ID nulo com `resourceType=host`.
- CPU usa deltas de `user + system`, sem incluir idle do `total` do host; 100% corresponde a um núcleo. Memória é convertida de bytes para MiB; limite ausente difere de limite zero. Rede/disco usam KiB/s; resets produzem lacunas e timestamps duplicados/regressivos são descartados.
- Limites: 1 MiB/32 linhas por frame; histórico de até 300 pontos/cinco minutos. Contadores ausentes permanecem indisponíveis, não viram zero.
- Antes da conexão e a cada 15 segundos, a console relê recurso, environment e capacidade atual. Requests têm timeout. Perda de acesso fecha métricas; perda da action `execute` fecha terminal mesmo quando GET ainda é permitido. Seis checks físicos comprovaram downgrade do terminal aberto, manutenção dos logs e fechamento destes após remover o grant. Fechamento remoto limpa heartbeat/resize; chave de identidade/environment/recurso reinicia estado e consentimento de execute. Onze regressões de componente cobrem flags, contexto e revogação.
- O navegador comprovou fechamento de um socket real de métricas já aberto após retirar grant temporário de leitor; a API também negou a leitura após remoção. Isso comprova o ciclo de revalidação da console, não revogação instantânea autônoma do socket pelo backend nem revogação criptográfica de um token já emitido.

Nove verificações de API, quinze de navegador com ensaio de 330 segundos, desativação da flag e treze de reativação passaram em 21/10/2026. Relatórios sanitizados em `console/metrics*test-results.json`; os conjuntos têm sobreposição e não devem ser somados como cobertura independente.

Aceite posterior: um stream físico permaneceu por 3.600 segundos sem reconectar; 16 checks aprovaram buffers, heap e revogação. Após coleta explícita, heap usado passou de 6.441.660 para 7.296.284 bytes, crescimento retido de 854.624 bytes, abaixo do orçamento de 8 MiB sobre baseline aquecido. Executado no build de 133 testes antes das últimas mudanças de menu/topologia; o código de métricas permaneceu o mesmo. Smoke de 13 checks foi repetido após recuperação do host. Nove checks separados comprovaram que perder o cookie do browser fecha sockets de métricas/logs/terminal pela revalidação e retorna ao login. Não é prova de expiração real de JWT, logout federado ou revogação autônoma pelo backend.

## Limites de segurança da base legada

Remoção em lote usa exclusivamente a action `remove` da resposta atual de cada alvo; não deduz DELETE nem envia purge. Tipos misturados são rejeitados antes de requests. O formulário exige nome exato do environment e avisa sobre dependências nativas; não promete desfazer cascatas. Cada POST ocorre uma única vez; perda de resposta é estado incerto, sem retry. Aceite físico de dois serviços de escala zero confirmou `removed`, e leitor não pôde selecionar nem invocar a action diretamente.

Customizar UI/RBAC não atualiza automaticamente o Rancher 1.6 e suas dependências. A avaliação produtiva exige revisão da base legada, dependências, exposição de rede, TLS, backup e compatibilidade de agentes. O laboratório não constitui aceite produtivo.

## Integrações/administração: gates conferidos em 22/10

Docs24–30 documentam DTOs e estado privado em chaves/settings/webhooks, autorização e revalidação. Schemas v1-webhooks anunciam escrita para readonly; o novo frontend usa relatório self completo owner/member, e o backend nega POST/DELETE nativos (405) e omite URL para readonly. Member autorizado recebe URL/cria/exclui; outro environment é 403. URL nunca é link/prefetch e não é invocada no aceite. Não inferir revogação de URLs compartilhadas por remover usuário. Settings são activeSetting/baseType setting e endpoints preservam caixa do nome. Auditoria omite corpos/descrição/IP antes do cache; leitor nativo só acessa registros próprios, e a UI administrativa é restrita.

## Recortes de 23/10

machineDriver e catalog.url são legíveis ao usuário comum no backend nativo; administração moderna exige admin, escritas nativas foram negadas em sessões OIDC/CSRF válidos. Mascarar URL não modifica a política do endpoint original. Compose existente usa ação nativa scoped com exportação e parâmetros fora dos caches, snapshot/schema/destino revalidados e sem retry de escrita. A preflight não é CAS; rollback e finish continuam operações explícitas.

Contas locais (42): sessão nativa validada antes de toda escrita; ID interno resolvido somente de accountId válido ou rancher_id numérico. Backend SESSION_ACCOUNT_GUARD_ENABLED valida conta atual em GET token e atualiza userType. Conta inativa devolve401; reset de senha não revoga JWT. Teste real negou autopromoção. Snapshot e último admin na UI não são CAS atômico.
