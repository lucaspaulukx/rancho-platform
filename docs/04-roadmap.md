# 04 — Roadmap por tasks

Roadmap completo e ordem de execução vigente: [Roadmap mestre](48-master-roadmap.md). Estado por entrega, gates restantes e critérios para100%; checkpoints abaixo preservam o histórico.

## Progresso estimado vigente

**Cerca de70% do escopo Docker/Cattle**, aproximadamente30% restante; estimativa ponderada de implementação e aceite, com faixa65–75%. Critérios, pesos, seis blocos restantes e exclusão explícita dos opcionais condicionais F9 no [documento35](35-progress-and-remaining-work.md). Não é percentual obtido pela quantidade de testes e não significa aceite produtivo. Dump de produção adiado; continuar com fixtures locais.

## Checkpoint de execução — 23/10/2026

**565 testes/65 arquivos + TypeScript/Vite.** Status e evidências vinculantes: documento08; planejamento/limites por recorte nos documentos12–45. Fases continuam parcialmente abertas.

| Tasks | Entrega implementada no recorte | Gates ainda distintos |
|---|---|---|
| F1/F5 | Shell/temas/identidade Rancher comum, operação contextual, Compose de criação e upgrade contextual de stacks com origem Compose, vínculos, portas/volumes na criação e upgrade, LB HTTP/TCP | Formulários avançados/opções Compose sem aceite, físico/multi-host/TLS, consolidação |
| F8-01 | Auditoria administrativa com DTO/cursor/filtros e autorização | Cobertura dos eventos depende do que backend registra |
| F8-02 | Capacidades sanitizadas em Sobre; usuários/grupos existentes | Admin de provedores/auth avançada e identidades externas completas |
| F8-03 | Settings edit/reset, monitor HA/pools, CRUD/ações de drivers e repositórios globais com DTO/autorizações | Migração/configuração HA, drivers por catálogo/provisionamento e sincronização física de catálogos |
| F8-04 | API keys e receivers de webhook dos três drivers nativos | Eventos reais de webhooks, forwardPost sem formulário novo |
| F8-05 | Sobre/versões, logos oficiais preservados e referência Inter | Revisão completa de attribution/empacotamento em F10 |
| F8-06 | Chaves pessoais/compartilhadas, Basic real, escopo e revogação RBAC; webhook readonly/member | Matriz ampliada de contas técnicas/sessão e integrações |

Não fechar fases com base em contagem de testes ou CRUD genérico. Nenhuma alteração no frontend Ember; nenhuma produção/release.

## Histórico de checkpoints por recorte

## F1/F5 — proteção adicional compartilhada

Documento 20: cobertura de beforeunload para seis controladores com rascunho/envio pendente, sob unsavedChangesGuard true. Cinco testes de eventos/componentes; gate global 297 testes/35 arquivos + TypeScript/Vite. Diálogo nativo/manual continua pendente por navegador; não substitui autosave ou o gate visual de balanceadores.


## F5-10 — regras contextuais de balanceadores

Implementado o recorte HTTP/TCP do documento 19: drawer, picker stack/serviço, portas/publicação, revisão, preservação de configuração e snapshot concorrente. Testes de domínio/painel e 9 checks nativos concluídos, com cleanup exato e balanceadores anteriores preservados. **Flag false; gate visual pendente.** Tráfego físico/TLS/HA/multi-host continua em F6. Não tratar a implementação como paridade concluída.


## F5-09 — criação por seções

Implementada no recorte do documento 18: agrupamento compartilhado de criação de service/container, revalidação aninhada e privacidade. Gate de 271 testes/32 arquivos + TypeScript/Vite; API/browser comprovam configuração e estado sem executar as duas fixtures. Editor contextual de balanceadores implementado no recorte F5-10; editores especializados de portas/volumes ainda pendentes. Cleanup de criação confirmado no documento 18.

## F5-08 — vínculos contextuais entregues em recorte

Documento 17: vínculos de saída de serviços Cattle, picker stack/serviço, alias, revisão, conflito e remoção explícita. Implementado e validado no backend com serviços sem containers; DNS/tráfego físico e LB não fazem parte desse aceite. Build de 266 testes/31 arquivos+ TypeScript/Vite. Restam formulários especializados, LB e demais gates; a tarefa não fecha F5 integralmente.

## Avanço posterior —22/10/2026

F5-07 Compose concluída no recorte de criação contextual descrito no documento 15, com aceite real e cleanup; não inclui import de disco/Git ou edição/upgradeCompose. Correção transversal de checkbox documentada em 16. Gatefonte 255 testes/30 arquivos + TypeScript/Vite. A matriz de 21/10 abaixo continua backlog de referência, mas “Compose planejado” foi superado. Seguem formulários de workloads/links/LB e os demais gates.

## Checkpoint documental — 21/10/2026

As fases são parcialmente implementadas; nenhuma contagem isolada fecha todos os gates. Consulte a matriz atual abaixo antes das tasks originais. A próxima entrega escolhida foi o editor Compose de criação de stack (documento 15), ainda sem código ou flag.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


Ordem de execução: documentação → fase 0 → fundação visual → autenticação → grupos → demais domínios. Não começar uma fase seguinte com pendências críticas na anterior. Estimativas de esforço serão ajustadas após a fase 0; este plano não promete datas sem validar contratos e ambiente operacional.

Status inicial das tasks de migração: **planejada**, exceto quando o documento 08 disser explicitamente o contrário. O protótipo atual não substitui o aceite de uma task de migração.

## Matriz histórica por fase — 21/10/2026 (superada pelo checkpoint vigente e documento35)

| Fase | Estado | Próximo gate / lacuna |
|---|---|---|
| F0 | Parcial | Contas técnicas, matriz de políticas, migração e rollback versionados; recuperação completa Rancher/Keycloak |
| F1 | Parcial, shell compartilhado entregue | Matriz completa teclado/leitor de tela, alto volume, performance e temas |
| F2 | Parcial, login/OIDC/acesso pendente entregues | Expiração real JWT e logout federado |
| F3 | Parcial, grupos/acesso/auditoria entregues | Identidades externas dinâmicas e migração versionada |
| F4 | Parcial, environments/templates e ipsec validados em recortes | Repetir 13 checks browser de templates, bindings futuros e matriz de orquestração/rede |
| F5 | Parcial, operação vertical e fluxos comuns físicos entregues | **F5-07 Compose especializado planejado**, formulários workload, links, LB e ações restantes |
| F6 | Parcial, hosts/dados/catálogo em recortes | LB/TLS/multi-host, snapshots/backups/drivers, cloud e repositórios de catálogo |
| F7 | Parcial, logs/terminal/métricas entregues | Matriz física completa de contexto/expiração, sem confundir cookie com JWT |
| F8 | Pendente salvo acesso/auditoria de grupos | Configurações/processos/auth/drivers, API keys/webhooks/ajuda; admin/api desligados |
| F9 | Não habilitada | Evidência de necessidade e laboratório para cada opcional; optional desligado |
| F10 | Pendente | Segurança/a11y/performance completas, release, migração, restore e rollback |

### F5-07 — Criação de stack por Compose

Plano detalhado em [documento 15](15-stack-compose-creation.md). Dependências: drawer ResourceCreator, schema stack e guards existentes. Tasks: flag inicialmente desligada; stack vazia/importação; editor multilinha reutilizável; variáveis privadas; início explícito; revalidação de schema e payload; rascunho/erro/contexto; unitários/build Linux; aceite CUA físico e cleanup exclusivo. Nenhuma dessas tasks novas foi implementada nesta entrega documental.

## Fase 0 — Fundação de configuração e reversão

| Task | Entrega | Dependência | Aceite |
|---|---|---|---|
| F0-01 | Inventário de rotas, módulos, modais, APIs e provas existentes | Documentação | Inventário rastreável ao fonte; lacunas explícitas. |
| F0-02 | Registro tipado de flags e validação de combinações | F0-01 | Booleanos inválidos e combinações inseguras rejeitados; defaults documentados. |
| F0-03 | Endpoint público sanitizado de configuração/capacidades | F0-02 | Não retorna segredos; distingue solicitado, efetivo e disponível. |
| F0-04 | Flags das customizações já feitas: grupos, tela sem acesso, bloqueio de criação e OIDC | F0-02 | Desativação preserva dados, não concede acesso e mantém regra original quando expressamente escolhida. |
| F0-05 | OIDC exclusivo e autologin configuráveis, sem erro de navegação | F0-03 | Senha local negada no backend quando exclusivo; botão funciona sem F5; erro e logout não geram loop. |
| F0-06 | Build e Compose reproduzíveis; estado/chaves persistentes | F0-04/05 | Recriar container preserva dados e comportamento; rollback testado. |
| F0-07 | Matriz automatizada de flags e smoke tests da UI clássica | F0-06 | Cenários de combinação, desativação e sessão existente passam. |

Gate: nenhum frontend moderno publicado. O modo clássico segue operacional e as configurações atuais têm contrato verificável.

## Fase 1 — Design system e AppShell

| Task | Entrega | Dependência | Aceite |
|---|---|---|---|
| F1-01 | ADR final do frontend e lockfile | Gate F0 | Build reproduzível e sem dependência runtime do Ember. |
| F1-02 | Tokens Rancher Console/comunidade; presets claro, escuro e sistema | F1-01 | Paleta centralizada; status operacionais preservados; contraste validado. |
| F1-03 | Brand, AppShell, Sidebar, Navbar, breadcrumbs e EnvironmentSwitcher | F1-02 | Um layout para todas as rotas autenticadas; comportamento responsivo e por teclado. |
| F1-04 | AuthLayout e componentes básicos | F1-02 | Login/callback/erro compartilham marca, tema e componentes. |
| F1-05 | DataTable, filtros, formulários, dialogs, drawers e estados | F1-03/04 | Catálogo de componentes com variantes, loading/empty/error e foco verificados. |
| F1-06 | Cliente API, sessão, cache por identidade/environment e bridge clássico | F1-01 | Sem vazamento de cache entre escopos; sem token em log; troca de usuário testada. |
| F1-07 | Preferências de aparência e flags por módulo | F1-03/06 | Preferência persiste; desligar tema/feature aplica fallback sem apagar dados. |
| F1-08 | Harness visual e testes comuns | F1-05/07 | Matriz de viewport, tema e teclado executável; nenhuma tela aprovada fora do shell. |

Gate: fundação revisável sob flag global desligada por padrão. Telas de demonstração não são apresentadas como migração funcional concluída.

## Fase 2 — Login, callback e acesso pendente

| Task | Telas / entrega | Dependência | Aceite |
|---|---|---|---|
| F2-01 | AUTH-01: híbrido/exclusivo | Gate F1, F0-05 | Layout compartilhado; exclusividade real no backend. |
| F2-02 | AUTH-02: callback e restauração de sessão | F2-01 | Código/ticket consumido uma vez; acesso direto e F5 funcionam; sem página inexistente. |
| F2-03 | AUTH-03: autologin, expiração e logout | F2-02 | Sem loop; interrupção do IdP não cria fallback local indevido. |
| F2-04 | ACCESS-01/02: sem acesso, 403, 404 | F2-02 | Usuário novo sem environment; estado autenticado claro; shell reutilizado. |
| F2-05 | Aceite integrado de sessão e retorno ao clássico | F2-01/04 | Botão, callback, navegação, revogação e todos os modos de flag testados. |

## Fase 3 — Grupos e acesso centralizado

| Task | Telas / entrega | Dependência | Aceite |
|---|---|---|---|
| F3-01 | GROUP-01: listagem com busca e resumo | Gate F2 | Contagens reais e navegação simples; nenhum formulário aberto por padrão. |
| F3-02 | GROUP-02/03: editor e seleção de membros | F3-01 | Busca, selecionados, proteção de rascunho e validação. |
| F3-03 | GROUP-04: seleção de environments e papéis | F3-02 | Grants explícitos; default mínimo; resumo antes de salvar. |
| F3-04 | Contrato de acesso efetivo e auditoria detalhada | F3-03 | Fontes diretas/grupos, prioridade e dados antes/depois calculados no backend. |
| F3-05 | GROUP-05 e USER-01/02: diagnóstico e vínculo de grupos | F3-04 | UI não inventa direitos; admin e usuário comum recebem escopos corretos. |
| F3-06 | Concorrência, exclusão e revogação | F3-02/05 | Conflito 409 não perde rascunho; remoção afeta sessão existente; dados diretos preservados. |
| F3-07 | Aceite UX e matriz de autorização | F3-06 | Criar grupo e conceder acesso sem editar environment por environment; teclado/tema/mobile passam. |

## Fase 4 — Environments e templates

| Task | Entrega | Dependência | Aceite |
|---|---|---|---|
| F4-01 | ENV-01/02: lista, seleção e visão geral | Gate F3 | Somente dados autorizados; troca cancela requests antigos e limpa subscriptions. |
| F4-02 | ENV-03: criação/edição | F4-01 | Políticas de criação e payloads originais respeitados. |
| F4-03 | ENV-04: templates | F4-02 | Templates e infraestrutura existentes continuam utilizáveis. |
| F4-04 | Aceite e rollback por módulo | F4-01/03 | F5/deep links, usuários sem acesso e retorno ao clássico testados. |

## Fase 5 — Stacks, serviços e containers

| Task | Entrega | Dependência | Aceite |
|---|---|---|---|
| F5-01 | Contratos de schemas/actions e transições assíncronas | Gate F4 | Matriz por papel/recurso; nenhuma action presumida. |
| F5-02 | STACK-01/02 e DLG-07 | F5-01 | Lista, detalhe, código/grafo e upgrades com estados reais. |
| F5-03 | SERVICE-01/02 e NETWORK-01 | F5-02 | Tipos de serviço e validações existentes mantidos. |
| F5-04 | CONTAINER-01/02/03 | F5-01/03 | CRUD e lifecycle autorizados; formulários por seção. |
| F5-05 | DLG-03/05/06 e operações em lote | F5-04 | Confirmação contextual e resultado por item, inclusive falha parcial. |
| F5-06 | Aceite operacional sintético | F5-02/05 | Evidência no backend/estado do recurso, não apenas toast de sucesso. |

## Fase 6 — Hosts, dados, rede e catálogo

| Task | Entrega | Dependência | Aceite |
|---|---|---|---|
| F6-01 | HOST-01/02/03 | Gate F5 | Labels, registro e lifecycle com escopo e impacto verificados. |
| F6-02 | DATA-01/02 | F6-01 | Dependências de volumes/backup respeitadas; sem remoção global. |
| F6-03 | DATA-03/04/05 e DLG-08 | F6-01 | Registry, secrets e certificados sem exposição de valores. |
| F6-04 | CATALOG-01 e NETWORK-01 completo | F6-03 | Indisponibilidade externa tratada; lançamento/configuração testados. |
| F6-05 | Aceite e desligamento por domínio | F6-01/04 | Cada módulo volta à UI clássica sem perder configuração. |

## Fase 7 — Logs, terminal e métricas

| Task | Entrega | Dependência | Aceite |
|---|---|---|---|
| F7-01 | Contratos e threat model de WebSocket/exec/streams | Gate F6 | Autenticação, escopo, tokens, expiração e limites documentados. |
| F7-02 | OBS-01: LogViewer | F7-01 | Buffer limitado; pause/resume; reconexão sem misturar environments. |
| F7-03 | OBS-02: Terminal | F7-01 | Resize, foco, encerramento e restrições de papel reais. |
| F7-04 | OBS-03: métricas | F7-01 | Séries, unidades, período e indisponibilidade corretos. |
| F7-05 | Revogação de conexões abertas e aceite | F7-02/04 | Desligar feature ou retirar permissão produz o comportamento de encerramento especificado; sem alegar revogação já implementada antes disso. |

## Fase 8 — Administração e integrações

Tasks: **F8-01** ADMIN-01/auditoria; **F8-02** USER-03 e ADMIN-03; **F8-03** ADMIN-02/04 e drivers; **F8-04** API-01/02; **F8-05** HELP-01 e revisão de attribution; **F8-06** matriz de chaves de API/contas técnicas e aceite.

Dependência: gate F7, salvo itens administrativos estritamente necessários a uma fase anterior. Cada task usa os componentes e critérios comuns, tem flag própria e mantém fallback clássico. Chaves/API/webhooks recebem testes de segredo, escopo e revogação antes de serem liberados.

## Fase 9 — Módulos opcionais

**F9-01** levantamento de uso de VMs/Windows; **F9-02** Kubernetes; **F9-03** Swarm; **F9-04** Mesos; **F9-05** aceite individual. Só implementar após evidência de necessidade e ambiente de validação. Permanecem desativados na nova UI até lá.

## Fase 10 — Consolidação

**F10-01** revisão de segurança e acessibilidade; **F10-02** medição de performance em cenários reais; **F10-03** empacotamento/release/migração de banco; **F10-04** ensaio de rollback; **F10-05** decisão documentada sobre manter ou retirar cada rota clássica.

Retirar o frontend clássico é uma decisão posterior e explícita. Não faz parte da ativação da primeira console moderna.

## Definition of Done comum

Fonte + contrato + flags + estados da UI + todos os temas + AppShell/AuthLayout + testes proporcionais + evidência de integração + rollback + documentação atualizada. Sem mudança em produção ou publicação de release por inferência deste planejamento.
