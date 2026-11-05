# 05 — Configuração, flags e temas

## Flags de bindings e API keys

`modules.workloadBindingEditors=true` após documento 21: criação service/container com workloadCreationSections, editores de ports/dataVolumes, preservação de entradas opacas e fallback textarea com false. Não altera montagens/portas existentes ao desligar. `modules.apiKeys` é flag proposta no documento 24, ainda não implementada neste checkpoint; api/admin/optional continuam desligadas.


## Flag adicional — proteção de saída

`modules.unsavedChangesGuard=true` cobre reload/fechamento com rascunho/envio pendente nos seis controladores do documento 20. False com recarga remove somente a cobertura adicional, preservando guards anteriores. Não salva campos e não altera APIs/permissões.


## Flag adicional — regras de balanceadores

`modules.balancerRulesEditor=true`: editor HTTP/TCP no drawer compartilhado, com checks nativos, componentes e aceite E2E/visual no recorte do documento 19. True adiciona Configurar balanceador ao menu/detalhe quando o schema permite PUT e o recurso está estável. False com recarga mantém a edição genérica. Não altera recursos, permissões, portas ou sessões ao desligar. Regras/bindings avançados bloqueiam toda a edição especializada, mantendo a configuração. Depende de workloads/contextActions para o menu operacional.


## Flag adicional — criação por seções

modules.workloadCreationSections=true no laboratório após gates de apresentação e readback descritos no documento 18. Somente criação service/container; false com recarga retorna à disposição genérica, sem alterar recursos. Máscara de environment é correção de privacidade e continua em ambos os layouts. Campos/POST seguem sujeitos ao schema atualizado e à autorização do backend.

## Flag adicional — vínculos de serviço

modules.serviceLinksEditor controla o editor especializado de setservicelinks na operação e está true no laboratório. Depende de workloads, schema gravável e action nativa anunciada. False com recarga recupera o schema genérico no detalhe. Não altera grants ou configuração de serviços ao desligar. O primeiro recorte só edita serviços Cattle de aplicação, sem LB/destinos externos/portas avançadas. Documento 17.

## Atualização —22/10/2026

modules.stackComposeEditor=true e modules.customCheckboxes=true implementadas em 22/10. A primeira troca criação genérica por editor de stack vazia/Compose; off recupera SchemaForm. A segunda aplica aparência custom aos inputs checkbox; off recupera appearance auto, sem desfazer correçõesde layout. Ambas exigem recarga e não concedem acesso. Documentos 15 e 16.

## Checkpoint documental — 21/10/2026

Configuração efetiva da console foi relida nesta entrega: contextActions, workloadUpgrades, catalogUpgrades e workloadScaling true; admin/api/optional false; tema dark e branding true. stackComposeEditor é somente nome proposto, ausente do contrato/JSON atual. As variáveis do registro alvo abaixo não devem ser confundidas com flags já implementadas da console independente.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


Este é o contrato alvo. O documento 08 informa o que existe de fato; nomes planejados não significam funcionalidades disponíveis no container atual.

## Regras do registro de configuração

Na console independente, `modules.networkPolicies` é um booleano estrito em `console/public/console-config.json` e exige `modules.environments`. Foi introduzida desligada e está **true no laboratório** após o aceite físico ipsec de 21/10/2026. Expõe o painel no detalhe do environment; desligar remove o painel sem alterar redes/regras. A flag não autoriza PUT: schema, recurso, environment, concorrência e gerenciador nativo são revalidados antes do envio. Redes sem gerenciador ativo/saudável permanecem somente para consulta. A VM adicional do aceite foi desligada após o teste, com disco preservado; a liberação visual não implica que esse host esteja permanentemente online. Não generalizar o aceite ipsec para vxlan ou multi-host.

Configuração operacional vem do Compose/ambiente do servidor, validada no startup. Booleanos aceitam somente `true` ou `false`; valor inválido causa erro identificando a chave, sem imprimir segredos. Alterações de políticas exigem recriação controlada do container. Preferências pessoais de tema/densidade podem mudar sem restart.

Cada entrada tem tipo, default, dependências, disponibilidade, efeito ao desativar e classificação pública/privada. O servidor calcula a configuração efetiva. O frontend não decide se autenticação ou autorização está ativa. Flag visual não concede acesso a uma API.

Combinações inválidas são rejeitadas: OIDC exclusivo ou automático com OIDC indisponível; módulo moderno com console indisponível; tema inexistente. Nenhuma configuração indisponível deve parecer ativada. O registro distingue solicitado, disponível e efetivo.

## Registro alvo

Defaults abaixo preservam o laboratório atual e mantêm a migração visual desligada. São diferentes dos defaults históricos do Rancher.

| Variável | Default alvo | Efeito / dependência | Fase |
|---|---|---|---|
| `RANCHER_CUSTOMIZATION_ENABLED` | `true` | Chave geral das extensões. Desligar remove extensões e grants locais da avaliação, preserva dados e mantém políticas de segurança explicitamente configuradas abaixo. Não desliga o controle de acesso nativo. | 0 |
| `RANCHER_LOCAL_RBAC_ENABLED` | `true` | API administrativa e avaliação de grupos locais. Desligar preserva grupos/membros/grants; grants diretos nativos continuam válidos. | 0 |
| `RANCHER_NO_ACCESS_VIEW_ENABLED` | `true` | Apresentação de acesso pendente. Desligar usa o comportamento visual clássico, sem criar environment ou conceder acesso. | 0 |
| `RANCHER_ENV_CREATION_ADMIN_ONLY` | `true` | Política independente: criação de environment somente por administrador. `false` restaura a regra nativa, sujeita às permissões nativas. | 0 |
| `RANCHER_DISABLE_AUTO_ENVIRONMENT` | `true` | Política independente: impede provisionamento automático de environment para novos usuários. Desligar exige escolha operacional explícita e restaura a propriedade nativa correspondente. | 0 |
| `RANCHER_OIDC_ENABLED` | `true` | Adaptador OIDC disponível somente com configuração válida e chave geral ativa. Ausência completa de configuração permite modo local; configuração parcial é erro. | 0 |
| `RANCHER_OIDC_ONLY` | `false` | Exige OIDC efetivo. Login interativo local e sessões interativas locais anteriores são recusados. Falha do IdP não habilita senha local automaticamente. | 0 |
| `RANCHER_OIDC_AUTO_LOGIN` | `false` | Exige OIDC efetivo. Login inicia redirecionamento automaticamente uma vez; logout/erro interrompem o ciclo. Funciona também no modo híbrido quando escolhido. | 0 |
| `RANCHER_MODERN_UI_ENABLED` | `false` | Habilita o frontend novo somente depois do gate da fundação. Desligar retorna ao clássico e preserva dados e políticas. | 1 |
| `RANCHER_BRANDING_ENABLED` | `true` | Assinatura comunitária opcional; a marca Rancher e o tema permanecem em ambos. | 1 |
| `RANCHER_THEME_DEFAULT` | `system` | `light`, `dark`, `system` ou identificador de preset registrado. | 1 |
| `RANCHER_THEME_USER_SELECTABLE` | `true` | Permite preferência pessoal dentre os temas liberados. Desligar aplica o default do servidor. | 1 |
| `RANCHER_THEME_FILE` | vazio | JSON de tokens validado, montado somente leitura. Arquivo inválido impede ativar o preset customizado. | 1 |
| `RANCHER_UI_<MODULE>_ENABLED` | `false` | Liberação por módulo após gate respectivo: AUTH, GROUPS, ENVIRONMENTS, WORKLOADS, HOSTS, DATA, OBSERVABILITY, ADMIN, API, OPTIONAL. Exige disponibilidade e flag global moderna. | 2–9 |

Políticas de criação e autenticação exclusiva são independentes da apresentação. Assim, desligar o novo visual não muda silenciosamente quem consegue entrar ou criar recursos. Desligar a chave geral com `OIDC_ONLY=true` é combinação inválida; o operador precisa escolher explicitamente outro modo de autenticação.

Os módulos opcionais Kubernetes/Swarm/Mesos/Windows/VMs terão flags individuais quando implementados. Até lá, não são anunciados como disponíveis.

## Configuração OIDC privada

Issuer, client ID, client secret, callback e backchannel usam as variáveis já existentes `RANCHER_OIDC_*`. O secret nunca entra na resposta pública ou no bundle. Produção requer HTTPS e URLs previamente configuradas; `RANCHER_LAB_ALLOW_HTTP` é uma exceção explícita do laboratório, não um preset produtivo.

Antes do modo exclusivo: provisionar e testar um administrador vinculado à identidade OIDC pelo fluxo administrativo controlado. Não promover automaticamente por email, domínio ou claim de grupo. Rollback operacional usa a configuração do servidor; não haverá senha oculta de bypass na UI.

## Contrato público planejado

`GET /oidc/config` retorna versão do contrato, flags públicas solicitadas/efetivas/disponíveis, capacidades da console e tema sanitizado. Não retorna secrets, tokens, cookies ou dados de usuários. Permissões de cada recurso continuam sendo obtidas da API autenticada. O endpoint não substitui autorização.

## Temas e identidade

Tokens semânticos compartilhados e presets claros/escuros próximos à identidade Rancher. Fonte de verdade: console/src/themes/presets.json. Consulte [identidade visual](10-visual-identity.md) para cores e dimensões.

Marca Rancher preservada. Assinatura comunitária opcional sob branding; licenças disponíveis no Sobre.

Tema customizado aceita apenas chaves conhecidas e valores limitados ao tipo de token. Não aceita JavaScript, HTML, CSS arbitrário, URLs externas ou interpolação. Assets de marca usam referências locais permitidas. Preview mostra mudanças e erros antes de salvar preferência. Preferências são versionadas e isoladas por identidade/instância; um valor antigo inválido volta ao default com aviso.

## Ativar, desativar e reverter

`modules.contextActions` (booleano, true no laboratório) ativa menus `…`, tabs Stacks/Serviços/Containers e viewers contextuais compartilhados. Desligar recupera os botões Gerenciar e as entradas de recursos anteriores. `modules.workloadUpgrades` (true no laboratório) troca o schema genérico de upgrade de serviço pelo formulário específico de imagem/lote/intervalo/ordem; desligar recupera o schema. Nenhuma flag muda grants ou recursos. Ambas foram desligadas/restauradas com recarga e conferência por browser em 21/10/2026. Logs/terminal e métricas ainda dependem de suas flags próprias; seleção em lote depende de `bulkActions`. Detalhes em `12-unified-operation-ux.md`.

Na console independente, `console/public/console-config.json` controla os módulos. `modules.bulkActions` permite desligar a seleção múltipla e seus comandos sem desligar a operação individual. Depende da tela de workloads estar habilitada e das capacidades reais do usuário; a flag não concede acesso. O lote suporta até 100 alvos; remoção exige tipos homogêneos e nome exato do environment, somente com action remove nativa. Purge não é oferecido. Alterações de flag são carregadas ao abrir/recarregar a console; não se anuncia atualização instantânea em sessões já abertas.

`modules.metrics` controla os painéis de hosts e containers e depende também de `modules.observability`. Foi habilitada no laboratório após build Linux com 116 testes e aceite real de navegador. O default do registro tipado continua desligado. Desativação/reativação do arquivo montado foi testada com recarga: remove/restitui controles de host/container sem alterar recursos ou grants. A configuração não é observada em tempo real; editar o arquivo não promete encerrar um painel de uma página ainda não recarregada. Pausa, fechamento, desmontagem e mudança de contexto encerram sockets. Nova conexão exige reler recurso e permissão.

Desligar um módulo remove sua navegação, bloqueia a rota moderna e abre a alternativa clássica quando disponível. Não deixa rota vazia nem executa requests de background desse módulo. Desligar grupos remove também a avaliação dos grants locais no backend; não apaga linhas do banco. Reativação recupera os vínculos preservados e deve passar revisão operacional de acesso.

O menu compartilhado oferece `Meu acesso` somente com `modules.groups`, `LOCAL_RBAC_ENABLED` efetiva e environment selecionado. O drawer é lazy e consulta `targetAccount=self`, resolvido pelo backend; não habilita listagem de usuários nem auditoria para conta comum. Flags desligadas e ausência de environment têm regressões. Topologia integra a operação de workloads, também lazy, com tokens dos temas, filtro por stack, layout horizontal no desktop e vertical até 600 px. Não tem autorização independente das coleções nativas. Alterações de arquivo continuam exigindo recarga.

Onze verificações WCAG automatizadas com axe-core passaram no pacote servido, sem injeção de CSS, incluindo temas claro/escuro, drawer móvel, auditoria e topologia; Escape restaurou foco ao acionador. Contraste do avatar e badges semânticos foi corrigido usando tokens compartilhados. Não equivale a aceite manual de leitor de tela/teclado em todos os fluxos.

Rollback visual não é rollback de autorização. Exportar configuração e registrar a combinação anterior antes de mudar políticas. Não restaurar banco inteiro para desfazer uma mudança de tema ou flag.

A matriz integrada mais recente passou 28 checks com `python -u tests/flag_integration.py --browser`: híbrido/exclusivo, autologin, grupos desligados, sessões anteriores e rollback com registros preservados. O teste usa os overlays da console/host e `up -d --no-deps rancher`, preservando callback 18090 e demais serviços. A simulação de IdP indisponível fica restrita ao navegador. Nem a matriz de contas técnicas nem todas as políticas de criação estão aprovadas por esse recorte.

## Upgrade contextual de catálogo

modules.catalogUpgrades (true somente no laboratório após o aceite do documento 13) depende de catalog/workloads e da action upgrade nativa. Desligar com recarga recupera stackUpgrade genérico, preservando recursos. Restauração releu revisão e respostas; gate de flag conferido por CUA. O drawer exige aceite do impacto porque Rancher pode iniciar serviços parados e preservar sua escala atual. Não há hot reload nem alteração de grants pela flag.

## Escala efetiva contextual

modules.workloadScaling está true no laboratório após o aceite do documento 14. Depende de workloads/contextActions e schema PUT com scale.update; não concede permissões. Desativar com recarga retira o comando/painel específico e preserva a edição nativa do serviço. Off/on foi conferido sem mudar a escala. Serviços globais e estados transitórios são excluídos.

## Flags efetivas de integração/administração (22/10)

A fonte executável da console independente é `console/public/console-config.json`, montada somente leitura. As variáveis RANCHER_UI_* da tabela de arquitetura acima são alvos do plano original, não substituem este contrato implementado. `/oidc/config` contém booleans públicos de capacidades do backend; temas e módulos da console vêm do seu JSON próprio.

| Flag | Laboratório | Comportamento ao desligar / aceite |
|---|---|---|
| apiKeys | true | Bloqueia URL e navegação, preserva credenciais. Doc24. |
| audit | true | Bloqueia a auditoria administrativa; não altera registros. Doc25. |
| about | true | Remove entrada compartilhada Sobre/capacidades. Doc26. |
| processes | true | Bloqueia a tela de processos; não interfere no engine. Doc27. |
| processReplay | true | Mantém leitura de processos e remove replay. Exige processes e action nativa. Doc27. |
| settings | true | Bloqueia tela moderna, preserva valores/overrides. Doc28. |
| workloadConfigUpgrades | true | Upgrade volta a somente imagem; não muda configuração existente. Exige workloadUpgrades e contrato de serviço. Doc29. |
| webhooks | true | Bloqueia tela/URL e preserva receivers; não dispara eventos. Doc30. |
| clusterMonitoring | true | Bloqueia monitor HA; não muda a configuração. Doc31. |
| processPools | true | Remove aba de pools, preservando execuções; depende de processes. Doc31. |
| machineDrivers | true | Bloqueia inventário/editor/ações e preserva drivers; doc32. |
| driverActivation | true | Remove ativação/reativação/desativação, mantém CRUD autorizado de personalizados; depende de machineDrivers. Doc32. |
| stackComposeUpgrades | true | Retira o editor privado de Compose existente e volta ao formulário nativo; exige workloads/Cattle/fonte Compose e ação nativa, sem catálogo/system. Doc34. |
| catalogRepositories | true | Bloqueia configuração global estruturada, preserva catalog.url e templates; independente de catalog. Doc33. |
| admin / api / optional | false | Não habilita HA/drivers/orquestradores por consequência de módulos especializados. |

`workloadBindingEditors` controla criação estruturada e permanece independente do upgrade de configuração. Flags carregam na recarga; não se promete hot reload nem revogação de credencial por mudança de aparência. Permissões sempre continuam no servidor. O componente Brand é compartilhado entre shell/login/Sobre e respeita branding/tema, preservando Rancher em todos os modos.

Repositórios por environment: environmentCatalogs=true, entrada contextual no Catálogo exclusiva de administrador nesta etapa. Desligar preserva as fontes e templates. Proteção backend independente RANCHER_CATALOG_WRITE_GUARD_ENABLED=true, doc36; desligá-la restaura a falha de escrita readonly do proxy legado.

Atualizações: CONSOLE_ASSET_RETENTION=true no Compose da console serve arquivos atuais e anteriores retidos; false serve só o build atual, sem apagar volume. Não altera autorização. Recovery é componente comum, sem recarga automática. Doc37.

Saúde: workloadHealthChecks=true controla editor estruturado na criação de serviço/container; off mantém campos genéricos. workloadHealthCheckUpgrades=true adiciona opt-in no upgrade contextual de serviços e exige workloadUpgrades/contrato nativo. É independente de workloadConfigUpgrades (portas/volumes). Desativar preserva checks existentes; não remove configurações de workloads. Docs38–39.

Sidecars: workloadSidecars=true controla formulários de criação de secondaryLaunchConfigs. Off mantém JSON nativo. Validação do schema fresco, nomes/referências/ciclos e saúde das listas antes do envio. Não habilita upgrade de sidecars nem prova execução física. Doc40.

Upgrade de sidecars: workloadSidecarUpgrades=true, independente de workloadSidecars e dependente de workloadUpgrades/contrato. Off retira opt-in sem alterar sidecars já existentes; imagem/bindings continuam disponíveis conforme suas próprias flags. Doc41.

Contas locais: localAccountAdministration=true habilita criação/perfil/senha/lifecycle na tela Usuários somente para admin. Off preserva contas/grupos e retira controles. RANCHER_SESSION_ACCOUNT_GUARD_ENABLED=true no backend valida estado/perfil em GET token; independente da UI. Doc42.

Agendamento na criação: workloadScheduling=true ativa editor de afinidades na seção existente. Off conserva labels e volta ao mapa nativo. Não habilita upgrade nem prova posicionamento multi-host. Doc43.

Upgrade de afinidades: workloadSchedulingUpgrades=true oferece opt-in no drawer do serviço e exige workloadUpgrades/contrato atual. Off preserva labels existentes. Não habilita upgrade de host solicitado/global ou posicionamento físico. Doc44.

Delegação: environmentCatalogDelegation=true permite editor de fontes a owner/member com relatório self completo do environment selecionado. Depende de environmentCatalogs; off preserva entrada de admin e fontes. Backend CATALOG_WRITE_GUARD_ENABLED continua independente. Doc45.

Memória legível: workloadResourceEditors=true na criação serviço/container/sidecar, Bytes/MiB/GiB. Off mantém número nativo e configurações existentes. Não ativa upgrade nem altera quotas de CPU. Doc46.

Segurança: workloadSecurityEditors=true estrutura capAdd/capDrop com opções do schema atual; off retorna JSON nativo, preserva configurações. Não habilita upgrade nem muda privileged/readOnly por consequência. Doc47.

Upgrade de memória: workloadResourceUpgrades=true, independente da criação e demais upgrades, exige workloadUpgrades/contrato atual; off retira opt-in sem mudar limites existentes. Doc49.

Upgrade de segurança: workloadSecurityUpgrades=true, independente da criação, exige workloadUpgrades/contrato. Off preserva configuração existente e remove opt-in. Doc50.

## Versionamento da configuração pública

Contrato vigente schemaVersion1: [migração, dry-run, checksums e rollback](53-versioned-console-configuration.md). Formato sem versão migra em memória com flags ausentes false. Formato versionado exige flags booleanas completas; versões futuras falham antes da autenticação. Ferramenta cria somente destino novo, sem substituir origem/JSON compartilhado. Toda mudança de requisito obrigatório deve incrementar versão com migração explícita.

## Revalidação de subscribe — 04/11/2026

`RANCHER_SUBSCRIPTION_SESSION_GUARD_ENABLED` defaultfalse no backend, efetiva somente com customização. Compose moderno assume true (overridefalse). Revalida token opaco/JWE, conta/perfil e papel por mensagem/ping do WebSocket subscribe; falha fecha a conexão. On/off e revogação de sessão própria aceitos73. Não representa aceite de API keys, logs, exec ou carga.

## Logout federado opcional

`RANCHER_OIDC_FEDERATED_LOGOUT_ENABLED` defaultfalse, efetivo somente com OIDC/customização ativos. True habilita preparo seguro de saída para sessões OIDC; local conserva saída local e não encerra SSO. Registrar no IdP o retorno exato `{origem pública do callback}/console/login?oidc_logout=returned`. Origin/CSRF/sessão são obrigatórios. Falha do IdP não impede limpar/revogar Rancher; exclusivo não oferece login local. Recorte62 aceito com15 checks,4 fluxos reais e8 cenários axe/layout.

## Schema runtime opcional

`RANCHER_SCHEMA_MIGRATIONS_ENABLED` defaultfalse, dependente da customização. On serializa migração001, verifica checksum/estrutura e recusa inconsistência; off mantém bootstrap anterior, não desfaz DDL nem libera downgrade de dados. Upgrade/rollback original20 e contratos reais em [77](77-runtime-schema-migration.md). Não habilitado automaticamente no compose moderno.
