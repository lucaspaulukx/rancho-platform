# 07 — Validação, aceite e rollout

## Gate vigente — 23/10/2026

493 testes/56 arquivos + TypeScript/Vite. Drivers:22 checks E2E/8 cenários axe/layout; repos globais:18/8. Operações reais, flags, restrição UI e escrita nativa negada para usuário comum, restauração dos 14 drivers e da configuração/fonte catalog.url. Compose existente:15 registros E2E/quatro cenários, imagem/rollback/finish/escala0/guard e autorização reais. Matrizes de drivers/repos repetidas com data-theme efetivo verificado. Docs32–34 e status08 prevalecem sobre contagens históricas abaixo. Clone físico/provisionamento não foram comprovados por esses aceites.

## Gate mais recente — 22/10/2026

297 testes/35 arquivos, TypeScript e Vite aprovados no Docker Linux. LB: 9 checks nativos no mesmo domínio do frontend, fixture exata removida, balanceadores originais preservados; não houve teste de tráfego físico ou E2E da UI. Flag balancerRulesEditor false até aceite visual. Cinco testes de eventos da proteção adicional de rascunho/pending; unsavedChangesGuard true. Documentos 19/20 e status 08 prevalecem sobre contagens anteriores.


## Gate posterior — criação por seções

271 testes/32 arquivos + TypeScript/Vite. Cinco testes específicos e sete checks browser; readback nativo de dois workloads com argumentos, UTF-8, memória em bytes, zero/false e negação sem environment. Recorte de configuração, sem execução física dessas fixtures. Detalhes/cleanup no documento 18 e console/workload-creation-test-results.json; não somar suites sobrepostas como cobertura global.

## Gate posterior — vínculos

Build de 266 testes/31 arquivos + TypeScript/Vite. Onze regressões de contrato/capacidade/escopo/conflito e sete checks CUA descritos no documento 17. Readbacks nativos e negação de autorização em service-links-test-results.json; não somar como cobertura global. Serviços da fixture têm escala zero, portanto este gate não valida tráfego/DNS entre containers.

## Atualização —22/10/2026

Gate posterior255 testes/30 arquivos+ TypeScript/Vite; Compose com 8 checks nativos e 7 checks de navegador, checkbox com 7 checks de navegador. Suites se sobrepõem; não somar como aceite global. Fixtures Compose removidas, com manifest ausente. Modo forced-colors ainda não exercitado manualmente. Mais detalhes nos documentos 15 e 16.

## Checkpoint documental — 21/10/2026

Último gate registrado da fonte: 243 testes/29 arquivos + TypeScript/Vite, após escala contextual. Nesta entrega documental só houve verificações operacionais em leitura e consistência dos documentos; não se repetiram build, soak ou suites browser. Relatórios históricos continuam válidos apenas para seus recortes/versões. Compose especializado não tem aceite.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


## Matriz obrigatória

| Área | Cenários / evidência |
|---|---|
| Shell | Toda rota autenticada instancia o mesmo AppShell; mesma sidebar/navbar/breadcrumbs/perfil/tema, inclusive sem acesso e erros. AuthLayout compartilhado nas rotas públicas. |
| Componentes | Tabelas, formulários, dialogs e drawers vêm do catálogo; validação, foco, cancelamento e erros iguais entre módulos. Proibir cópias locais do shell por revisão e teste de estrutura. |
| Navegação | Acesso direto, refresh/F5, voltar/avançar, deep link, rota desativada e URL desconhecida. Retorno ao clássico explícito e sem loop. |
| Temas | Claro, escuro, sistema; preferência persistida; troca sem perder rascunho; logo correta; preset inválido rejeitado. Validar contraste e reduced motion. |
| Responsividade | 360/768/1024/1440 px; sidebar móvel; tabela e ações utilizáveis; sem overflow que esconda ação essencial. |
| Acessibilidade | Teclado completo, foco visível, labels, mensagens associadas, leitores de tela em estados/dialogs e retorno de foco. |
| Dados | Loading, vazio, erro, retry, indisponibilidade parcial, paginação real, stale response e troca de environment/identidade. |
| Mutações | Duplo clique, payload inválido, 403, 409, timeout e falha parcial. Preservar rascunho em erro; confirmar impacto quando destrutivo. |
| Login | Local, híbrido, OIDC exclusivo; autologin ligado/desligado; callback sem F5; erro/expiração/logout sem loop. |
| Sessão | Sessão local antiga bloqueada em modo exclusivo; sessão OIDC restaurada; ticket replay negado; state/nonce inválidos negados. |
| Novo usuário | Zero environments, zero grants, zero autoenvironment; tela explicativa; API direta nega criação e acesso não autorizado. |
| Grupos | Criar/editar/excluir; membro adicionado/retirado; roles; grants diretos preservados; revogação em sessão existente; conflito de revision. |
| Flags | Config inválida rejeitada; global moderna off; cada módulo off; grupos off/on preservando dados; tela pendente off sem conceder acesso; política de criação independente do visual. |
| Operação | Estado real no backend após action; logs/terminal com autenticação/expiração/buffers; revogação em streams e contas técnicas antes de aceite produtivo. |

Testes de frontend cobrem regras compartilhadas e fluxos de risco. Não criar teste que apenas espelha markup ou confirma implementação interna. Screenshots não substituem verificação de autorização e persistência.

## Fixtures e execução

Usar laboratório isolado e contas sintéticas: administrador local, administrador OIDC previamente vinculado, usuário sem acesso, leitor e operador com grants distintos em DEV/PROD. Não utilizar ambientes corporativos para testes destrutivos. Guardar resultado com data, imagem, configuração sanitizada e cenário; nunca copiar `.env` para evidências.

O script `tests/integration.py` já validou 24 cenários do protótipo anterior. Isso não é prova das flags novas, da console React ou de toda a API Rancher. Novos cenários devem produzir resultados separados e claramente identificados.

## Aceite de métricas em 21/10/2026

O build Linux passou 116 testes em 16 arquivos, TypeScript e Vite. Somente `console` foi recriada com `up -d --no-deps`; backend, host e volumes foram preservados. A flag `modules.metrics` está ligada no laboratório, com `observability` também ligada.

O aceite real usou Chromium isolado, 1440x1000 e 390x844: múltiplos frames de host/container, gráficos/unidades, contadores indisponíveis, pausa fechando socket, retomada, reconexão, CSV, fechamento do drawer, temas claro/escuro e revogação de grant de leitor em conexão já aberta. O stream físico permaneceu ao vivo por 330 segundos sem reconectar; exportação respeitou 300 pontos e cinco minutos. Isso não substitui ensaio de horas, medição de heap ou todas as condições de expiração/rede.

Resultados: `console/metrics-test-results.json` (9), `console/metrics-browser-test-results.json` (15, com duração prolongada), `console/metrics-flag-test-results.json` (1, desligada) e `console/metrics-browser-smoke-test-results.json` (13, reativada). Não somar os conjuntos, que cobrem cenários sobrepostos. Capturas `evidence/console-metrics-*.png` conferidas nos temas claro/escuro e viewport móvel.

Execução a partir da raiz do laboratório:

```powershell
python -m pip install playwright
python -m playwright install chromium
python -u console/tests/metrics_integration.py
python -u console/tests/metrics_browser.py --soak-seconds 330
```

Para repetir rollback, definir `modules.metrics=false` no arquivo montado e executar `python -u console/tests/metrics_browser.py --expect-disabled`; depois restaurar `true` e executar sem opções. O harness não altera a flag sozinho, não imprime credenciais e remove grants temporários em `finally`. Vitest local no Windows falhou na inicialização da suite nesta retomada; o gate de referência aprovado foi Linux.

O downgrade físico do terminal foi posteriormente comprovado em seis checks: member abre execute; readonly mantém GET/logs mas perde execute e fecha o terminal; remoção do grant fecha logs e nega GET. Estado por identidade/environment/recurso, consentimento de execute e limpeza de heartbeat/resize têm regressões de componente. Ainda pendentes em F7: matriz completa de expiração/troca de contexto física, duração de horas e comportamento autônomo dos tokens/WebSockets no backend. Não representa aprovação integral de F7 ou dos gates anteriores.

## Aceite integrado posterior em 21/10/2026

Build daquele aceite: **129 testes/16 arquivos**, TypeScript/Vite aprovados e console publicada. Backend recompilado/publicado no laboratório; baseline permaneceu parado. Suíte original reexecutada: **24 checks**. Acesso/auditoria: **26 checks**, incluindo fontes diretas/grupos/admin, prioridade nativa, persistência antes/depois, cursor, 409 sem evento espúrio, negação de escrita/consulta por usuário comum e preservação do grant direto após remover grupos concorrentes.

Browser de acesso/auditoria: **7 checks** com dados reais, snapshots, exclusão revisável pela auditoria geral, temas claro/escuro, 1440x1000 e 390x844 e ausência de erros runtime. Capturas `evidence/console-effective-access-*.png` e `evidence/console-group-*.png`. A UI limita a consulta a 1.000 eventos e avisa se pode haver mais.

Flags com navegador: **28 checks**, recriando somente Rancher com os overlays existentes e callback 18090. Híbrido → exclusivo/autologin/grupos off → rollback preservou registros e sessão OIDC. Senha/sessão local antiga foram negadas no backend. OIDC real, callback sem F5, refresh, logout sem loop, ticket recusado e retorno de autologin interrompido passaram. Falha do IdP foi simulada por HTTP 503 somente no navegador isolado, sem parar Keycloak; não equivale a ensaio de indisponibilidade do backchannel, expiração de JWT ou logout federado.

```powershell
python -u tests/integration.py
python -u tests/local_access_integration.py
python -u tests/flag_integration.py --browser
python -u console/tests/metrics_browser.py --access
python -u console/tests/metrics_browser.py --streams
```

Relatórios: `test-results.json` (24), `local-access-test-results.json` (26), `flag-test-results.json` (28), `console/access-browser-test-results.json` (7), `console/stream-browser-test-results.json` (6). Não somar cenários sobrepostos como aceite global. Contas técnicas, todas as políticas de criação, identidades dinâmicas externas e recuperação de backup permanecem gates abertos.

## Restauração isolada do Cattle

`tests/backup_restore.ps1` passou **7 checks** no MySQL 5.5.62 do laboratório. O snapshot online exigiu que todas as 110 tabelas fossem InnoDB; o dump usou transação única sem bloqueio de tabelas e incluiu rotinas, eventos e triggers. Nenhum SQL ou segredo entrou nos resultados.

O backup foi cifrado em repouso com DPAPI CurrentUser em arquivo temporário fora do workspace; o caminho está em `backup-restore-test-results.json`. A restauração usou a mesma imagem do servidor de origem, volume novo e container sem rede nem portas. Contagens de tabelas/contas e checksums exatos de `local_rbac_group`, `local_rbac_member`, `local_rbac_grant`, `local_rbac_audit`, `local_rbac_audit_detail` e `local_rbac_oidc_user` foram comparados. O conteúdo da origem permaneceu inalterado. Somente o container/volume criados pelo ensaio foram removidos; o backup cifrado foi preservado.

Escopo aprovado: **somente o banco Cattle**. Não comprova recuperação de `/var/lib/rancher`, Keycloak, hosts, volumes de workloads ou migração/rollback produtivos. DPAPI CurrentUser depende da identidade Windows e de suas chaves; este arquivo não é por si um backup portátil para outro usuário ou máquina. A recuperação completa e a migração de schema versionada continuam gates abertos.

```powershell
& .\tests\backup_restore.ps1
```

## Checkpoint operacional posterior

Build Linux atual: **143 testes/16 arquivos**, TypeScript/Vite aprovados e console publicada em 18090. Backend self-service compilado/publicado; suíte original reexecutada com 24 checks e acesso/auditoria com 35. O menu `Meu acesso` passou três checks de browser com leitor real: papel/fonte do backend, seletor sem PROD não autorizado e rota administrativa de terceiros negada. `targetAccount=self` evita depender do `accountId` nulo no GET de sessão.

Topologia passou sete checks físicos: link nativo persistido, direção, zoom efetivo, fit de ambos os nós no móvel, temas e ausência de erros. React Flow/Dagre ficam em chunk separado; layout vertical em telas estreitas preserva arestas e handles. Onze checks de acessibilidade automatizada passaram com axe-core no pacote servido e `sourceStyles=false`, incluindo retorno de foco; o probe anterior de CSS não é usado como aceite final. Avaliação manual completa continua pendente.

Soak de métricas: **16 checks com 3.600 segundos**, sem reconexão e com limite de 300 pontos/cinco minutos. Heap após GC: 6.441.660 → 7.296.284 bytes; crescimento 854.624 bytes, abaixo de baseline + 8 MiB. O soak usou o build de 133 testes, anterior às mudanças de menu/topologia; métricas não foram alteradas depois. Smoke de 13 checks e nove de perda de cookie em métricas/logs/terminal passaram na console principal após recuperar o host. Perda de cookie não comprova expiração criptográfica de JWT.

Infraestrutura: sete imagens oficiais pré-carregadas por archives do daemon clássico; o export do image store moderno referenciava camadas ausentes. A allowlist do servidor privado foi ampliada explicitamente. Guest desligado de forma limpa, recriado com o mesmo qcow2/volume e cloud-config reposto sem expor credenciais. Os seis serviços nativos chegaram a `active/healthy`. Durante aquecimento, o scheduler reiniciou e o start após stop excedeu o limite original de 90 segundos; o mesmo gate foi repetido sem relaxar o limite e passou **10 checks físicos** após estabilização. Não representa SLA de boot.

Rede gerenciada passou **7 checks**: dois containers no host isolado com IPs distintos, vínculo nativo, DNS do alias, HTTP com conteúdo real, negação sem grant e remoção efetiva dos serviços pelo cleanup da stack. O primeiro fixture tentou `httpd` no Alpine, que não fornece esse applet; o servidor foi corrigido para BusyBox oficial, mantendo Alpine no cliente. O bundle de ambas as imagens usa o endpoint privado existente, sem outro reboot. Não comprova tráfego entre hosts, balanceamento, TLS de aplicações, cloud ou drivers de armazenamento.

```powershell
python -u tests/local_access_integration.py
python -u console/tests/metrics_browser.py --self-access
python -u console/tests/metrics_browser.py --a11y
python -u console/tests/metrics_browser.py --topology
python -u console/tests/metrics_browser.py --session-expiry
python -u console/tests/preload_legacy_images.py --infrastructure
python -u console/tests/legacy_guest.py load-infrastructure
python -u console/tests/preload_legacy_images.py --network-fixture
python -u console/tests/legacy_guest.py load-network-fixture
python -u console/tests/physical_workload_integration.py
python -u console/tests/physical_workload_integration.py --managed-network
```

Relatórios separados: `local-access-test-results.json` (35), `console/self-access-browser-test-results.json` (3), `console/topology-browser-test-results.json` (7), `console/accessibility-browser-test-results.json` (11), `console/session-expiry-browser-test-results.json` (9), `console/metrics-browser-test-results.json` (16, `soakSeconds=3600`), `console/physical-workload-test-results.json` (10), `console/physical-network-test-results.json` (7) e `backup-restore-test-results.json` (7, banco Cattle somente). Contagens sobrepostas não devem ser somadas como aceite global.

## Gates por fase

Retomada após o checkpoint de templates: base Linux passou 160 testes/16 arquivos; regressão CUA comprovou vazio numérico bloqueando submit, remoção de linha preservando o estado da seguinte e persistência de `-4.5` como número. Readback/cleanup passaram sete checks (`console/template-resume-test-results.json`). Não substitui os 13 checks históricos do manager.

Políticas de rede foram inicialmente acrescentadas sob flag desligada com 176 testes. Após completar a revisão e o aceite isolado, o build atual passou **180 testes/18 arquivos e TypeScript/Vite**; 15 testes do adaptador e cinco de componente cobrem escopo, regras avançadas, perda de permissão, concorrência, gerenciador, flags e revisão antes/depois. As quatro observações CUA iniciais continuam em `console/network-policy-browser-test-results.json`.

Aceite posterior em host/environment próprios: **16 checks** em `console/policy-physical-test-results.json`. Inclui permitir HTTP entre stacks, default deny aplicado pela UI, três conexões novas bloqueadas com servidor saudável, restauração via API e HTTP restabelecido, readonly nativo e revogação, política original de UI-OPS intacta e cleanup. VM adicional desligada limpidamente, disco preservado. Flag habilitada no laboratório; ausência de gerenciador saudável mantém somente consulta. Documento 11 contém fonte do catálogo, autorizações, passos e limites. Não cobre vxlan, multi-host nem todas as combinações.

Aceite adicional de lote: build Linux posterior passou **133 testes/16 arquivos**. `python -u console/tests/metrics_browser.py --bulk-remove` passou 6 checks com serviços temporários de escala zero: confirmação tipada, viewport móvel, um POST por alvo, estado backend `removed`, ausência de reenvio e negação real de leitor. Relatório `console/bulk-remove-browser-test-results.json` e capturas `evidence/console-bulk-remove-*.png`. Stack/grant de teste foram removidos em cleanup. Isso não comprova todas as cascatas de stacks/containers ou purge.

- F0: flags e combinações reais; sessão exclusiva; callback sem erro; rollback de flags e persistência; clássico utilizável.
- F1: componentes/shell/temas compartilhados, contrato tipado, build reproduzível; console ainda desligada por padrão.
- F2/F3: ponta a ponta de login/acesso/grupos com testes negativos pela API e browser.
- F4–F8: cada domínio comprova paridade operacional antes da flag ser liberada; recurso sem ambiente de teste permanece pendente.
- F9: apenas módulos opcionais realmente utilizados e testados.
- F10: revisão de segurança, acessibilidade, medição de desempenho e ensaio de rollback.

## Performance

Gate contextual de 21/10: 207 testes/24 arquivos e TypeScript/Vite no Linux; CUA verificou menu/teclado/foco/temas/móvel, entrada Containers e rollback das duas flags. `console/tests/upgrade_fixture.py` criou fixture exclusiva com escala zero, conferiu o upgrade/rollback/finish enviados pela UI e removeu somente essa fixture. Cinco checks em `console/upgrade-test-results.json`. Não equivale a rolling upgrade físico. `console/tests/unified_fixture.py seed` recusou iniciar por host original desconectado, antes de criar recursos. Logs/reinício físicos novos aguardam a autorização pendente de reposição do arquivo privado do host original; não reexecutar essa reposição sem a resposta. Documento 12 reúne os limites.

Medir baseline e cenário novo no mesmo laboratório: carregamento inicial/cache quente, payload/bundle, requests por navegação, latência percebida, tabelas grandes e buffers de stream. Não fixar promessa de ganho sem medição. Evitar fan-out por linha e refetch global em troca de tema. Definir orçamento numérico após baseline F1, antes de aprovar migração operacional.

## Rollout e rollback

1. Registrar imagens/fontes/configuração e backup fora do volume de execução; validar restauração em volume isolado.
2. Usar migrações de banco versionadas/aditivas antes de evolução das tabelas locais. Não depender indefinidamente de criação implícita em startup.
3. Subir laboratório com UI moderna desligada e executar F0.
4. Ativar console e módulo liberado apenas no laboratório; validar matriz e recolher evidência.
5. Desligar módulo/global moderna e provar retorno ao clássico preservando grupos, grants e dados operacionais.
6. Rever mudanças de política separadamente de mudanças visuais; documentar o impacto antes de desativar grupos ou exclusividade OIDC.

Rollback de frontend usa imagem anterior/flag e não exige restaurar banco inteiro. Rollback de schema requer plano próprio de compatibilidade. Nunca iniciar containers original e modificado simultaneamente sobre o mesmo MySQL.

Nenhuma etapa deste plano autoriza publicação, mudança produtiva ou retirada do clássico. Essas ações terão escopo próprio quando solicitadas.

## Complemento do aceite físico contextual — 21/10/2026

Host original reconectado após autorização explícita. Oito checks de setup/readback/cleanup em `console/unified-operation-test-results.json`, além do browser CUA para logs/seleção/terminal e lifecycle. Reinício vazio falhou MissingRequired e foi corrigido pelo contrato nativo; 212 testes/25 arquivos, TypeScript/Vite, novo build servido e reinício físico repetido aprovado. Upgrade/rollback substituíram ambos os containers usando tag local da mesma Alpine cacheada, sem comprovar mudança de binário, registry remoto, multi-host ou zero downtime. Fixture e tag removidas; host original mantido ativo. Documento 12 reúne detalhes e capturas.

## Catálogo contextual — complemento

228 testes/28 arquivos + TypeScript/Vite. CUA validou versão/parametrização, rascunho, bloqueio sem aceite, flag, temas e 390 px sem overflow. Onze checks de API/setup/cleanup abrangem negação de acesso e limpeza de três fixtures. Gate inicial que pressupunha preservar serviços inativos falhou: stackUpgrade iniciou serviços e manteve escala. Acrescentados aviso/aceite explícito; ensaio final com escala efetiva zerada antes do upgrade. Não anunciar preservação de estado parado nem equivalência entre pergunta de escala e serviço. Detalhes em 13-catalog-stack-upgrade.md.

## Escala efetiva — complemento

243 testes/29 arquivos + TypeScript/Vite. CUA e API comprovaram escala 2 para 1 para 0 para 2, bloqueio de zero sem aceite, conflito entre clientes sem sobrescrita, PUT negado sem acesso, flag off/on, temas e 390px sem overflow. Scheduler legado reiniciou durante restauração; gate físico final passou nos critérios originais. Fixture 1st79/1s105 e instâncias removidas, sem manifest residual. Documento 14 e service-scaling-browser-test-results.json. Não equivale a CAS atômico nem matriz completa de serviços globais/orquestradores.

## Gates atuais de console — 22/10

Build Linux 418/48 + TS/Vite; suítes isoladas de navegador por módulo em console/tests/e2e e relatórios *-e2e-results/*-a11y-results. Helpers de fixture devem preceder suítes mutáveis e cleanup exato deve encerrar cada rodada, sem URL/token real em artefatos. Webhooks:CRUD/roles, zero invocação; upgrade de bindings:escala zero; não generalizar para entrega de evento, tráfego, montagens, HA ou alta disponibilidade. Os testes de fluxo não substituem leitor de tela nem matriz de expiração real. Status08 vincula aceites e lacunas.

Recorte42:536 testes/61 arquivos + TS/Vite;25 E2E/12 cenários de tema-tamanho, dez checks nativos e12 regressões de sessão OIDC/local; smoke/Sobre/recovery repetidos. Credencial de fixture removida com soft-remove SQL estritamente scoped após DELETE405 nativo; hashes de contas/metadados anteriores preservados. Não prova migração produtiva ou expiração real.
