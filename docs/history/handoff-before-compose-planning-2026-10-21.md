> HISTÓRICO: não usar como instrução de retomada. Prevalecem o [handoff atual](../../HANDOFF-2026-10-21.md) e o [status atual](../08-status.md).

# Handoff — Rancher 1.6.30 / comunidade

## Checkpoint que prevalece — operação contextual, 21/10/2026

O usuário retomou o desenvolvimento e pediu concluir o frontend, destacando que stacks/serviços/containers devem ser operados na mesma tela, com linhas verticais e menu `…`. Não há pedido atual de pausa. Continuar somente o novo frontend; não alterar `ui/`. **A migração completa continua pendente.**

- Build atual da console: **243 testes em 29 arquivos + TypeScript/Vite**. Shell/identidade Rancher+comunidade preservados. Workspace compartilhado nas entradas Stacks/Serviços/Containers, tabs locais, menu reutilizável em portal, detalhes/edição/criação/lifecycle no drawer, logs/terminal com seletor de container no contexto do pai. Flags `contextActions` e `workloadUpgrades` true, rollback visual conferido por CUA e restaurado.
- Upgrade de serviço: formulário específico imagem/lote/intervalo/startFirst; payload reconstruído com o recurso relido antes do envio, filtrando schemas e preservando configuração e sidecars. Testes de configuração, contrato, números, imutabilidade e formulário. UI aplicou upgrade→rollback→upgrade→finish em serviço sintético de escala zero. Cinco checks de API/setup/cleanup em `console/upgrade-test-results.json`; stack `1st74`/serviço `1s100` removidos. O aceite físico posterior também passou (detalhes abaixo); catálogo recebeu o fluxo descrito abaixo; paridade completa ainda pendente.
- Guard `useActionScope` recusa respostas antigas após trocar identity/env (inclusive A→B→A) ou desmontar; edição/criação relê permissões e recursos antes da mutação. Não é transação/CAS nem substitui backend.
- **Host original recuperado e aceite físico concluído:** usuário autorizou explicitamente a reposição do token existente no arquivo privado da VM original; depois liberou autonomia para o sandbox. Helper executado, Docker 19.03.15/cgroupfs e host/agente `1h1` active. CUA comprovou logs por stack/serviço, troca de container sem misturar marcadores e terminal printf com novo consentimento após trocar de alvo. Reinício inicial falhou MissingRequired; corrigido o contrato serviceRestart/rollingRestartStrategy compartilhado (lote 1, intervalo 2000ms). UI repetiu reinício com readback físico aprovado. Upgrade e rollback também substituíram os dois containers reais, mantendo comando/rede/escala; tag v2 local usa a mesma Alpine cacheada, sem download. Oito checks em `console/unified-operation-test-results.json`; stack `1st75`/serviço `1s101` e tag local removidos. Nenhum grant novo. Não repetir o pedido de autorização já respondido.
- VM de políticas permanece desligada com disco preservado. Nenhum grant novo; registro existente reposto somente na VM original autorizada. Não tocar nos containers Rancher Console/Orveta nem iniciar baseline sobre o mesmo MySQL.
- Documento `docs/12-unified-operation-ux.md`, status/flags/validação e capturas `evidence/console-unified-context-{dark,light,mobile}.png`, `console-context-actions-disabled.png`, `console-service-upgrade-form.png`. CUA tab 1/browser 2 em 18090; restaurado desktop/escuro, sessão admin, tab marcada como entrega. Navegação entre áreas preserva só `env`, corrigindo vazamento de `view` entre entradas.
- Evidências físicas adicionais: `evidence/console-context-live-{logs,terminal,restart,upgrade,rollback}.png`. Aba de testes separada para não interferir na navegação do usuário. Não declarar todos os gates concluídos; próximos itens continuam no roadmap.

### Catálogo contextual — checkpoint atual

catalogUpgrades=true no laboratório, build final 228 testes/28 arquivos e TypeScript/Vite. ResourcePanel intercepta upgrade de stack catalog:// para drawer reutilizado de Catalog; desligar flag recupera schema nativo. Stack privada relida fora do query cache; snapshot, schema/action e versão/arquivos revalidados antes de POST, com guard identity/env. Inventário/detalhes aplicam publicWorkload retirando environment/answers/Compose antes do cache. Segredos multiline ocultos até revelar, com quebras preservadas.

Gate inicial de preservar serviços parados falhou: stackUpgrade os inicia e pode manter escala efetiva apesar de parâmetro zero. Duas fixtures removidas e auditadas. UI exige aceite explícito, invalidado ao mudar perguntas/versão, com aviso sobre escala. Terceira fixture recebeu PUT explícito de escala zero antes da UI trocar ZooKeeper 3.4.6 para 3.4.8, memória 384, mesmo ID/nome/env e nenhum container novo. Finishupgrade pela UI. Onze checks em catalog-upgrade-test-results.json, incluindo negação real para usuário sem ambiente e cleanup. Stacks 1st76/77/78 e dependências removidas. Não generalizar escala zero para rolling upgrade de ZooKeeper nem prometer manter serviços inativos.

Doc 13 e capturas console-catalog-upgrade-{review,applied,light,mobile}.png. Tipagem de testes/keys duplicadas corrigidas antes do build final. Concorrência, action revogada, aceite e privacidade têm regressões. Admin de repositórios, todos os catálogos, Compose dedicado e demais gates continuam pendentes. Sandbox tem autorização ampla do usuário; não repetir permissões para testes locais. Não tocar em produção/outros projetos.

### Escala efetiva — checkpoint mais recente

workloadScaling=true no laboratório. Menu e detalhe do serviço abrem ServiceScaleForm com limites de schema e confirmação explícita de zero. canScaleService exclui global/estados transitórios/sem PUT/sem scale.update. ResourcePanel congela scaleSnapshot até sair do modo; revalida schema/recurso e compara escala antes de PUT somente {scale}. Proteção de cliente, sem CAS atômico. Quinze testes específicos; build final 243 testes/29 arquivos, TypeScript/Vite.

Fixture física 1st79/1s105: 2 para 1 para 0 para 2 com readback de containers. Zero sem checkbox bloqueado. Segundo cliente mudou de 2 para 1 com rascunho 3 aberto; UI recusou, backend permaneceu 1, nova leitura restaurou 2. Scheduler legado reiniciou durante a última restauração; gate final passou sem relaxar timeout. PUT de usuário sem ambiente negado, sem grant novo. Flags/temas/390px conferidos. Report service-scaling-browser-test-results.json, helper unified_fixture.py verify-scale/set-scale-conflict/scaling-authorization. Doc 14 e capturas console-service-scale-{zero,conflict,light,mobile,disabled}.png. Cleanup concluído: stack 1st79, serviço 1s105 e instâncias removidos; manifest unified-fixture.json ausente. Não tocar no host/discos dos outros projetos. Roadmap completo ainda pendente.

As seções abaixo são checkpoints históricos e não prevalecem sobre esta seção.

> **Retomada em 21/10/2026:** o checkpoint final abaixo foi recebido e conferido. Laboratório original em execução, baseline parado. Base recebida aprovada com 160 testes; regressão numérica conferida via CUA e sete checks de readback/cleanup, sem repetir integralmente os 13 históricos. Estado atual: **180 testes/18 arquivos + TypeScript/Vite aprovados**, painel de políticas sob `modules.networkPolicies=true` após **16 checks físicos/RBAC**. Environment exclusivo `CONSOLE-POLICY-LAB` (`1a417`), host `1h2`, rede `1n71`, manager oficial v0.2.8. UI aplicou deny, HTTP novo foi bloqueado com servidor saudável; restauração exata via API restabeleceu o tráfego. Readonly teve PUT negado e sessão revogada após retirar grant. Políticas de UI-OPS intactas. Fixtures HTTP e grant removidos; **VM extra desligada limpidamente, volume preservado**. Token privado desse host e readonly temporário de leitor nesse environment receberam autorizações explícitas do usuário. Procedimento, reexecução e limites em `docs/11-network-policy-acceptance.md`; relatório `console/policy-physical-test-results.json`. Não cobre vxlan/multi-host/todas as regras. O checkpoint da outra IA e as seções históricas abaixo foram preservados para rastreabilidade; usar também `docs/08-status.md`.

Atualizado em 21/10/2026. Documento para outra IA continuar neste workspace. A continuidade foi pausada a pedido do usuário para produzir este handoff. Não há paridade completa nem todas as fases aprovadas.

## Checkpoint final para retomada — 21/10/2026

**Esta seção prevalece sobre todos os checkpoints históricos abaixo.** Trabalho pausado a pedido do usuário para entregar o handoff. Não continuar implementando novas funcionalidades antes de conferir este estado. O objetivo completo de paridade Rancher continua pendente; não declarar o projeto concluído.

### Estado conferido ao entregar

- Fonte atual: **160 testes aprovados em 16 arquivos**, incluindo **19 testes de environments/templates**; `npx tsc --noEmit` também passou. Ambos foram reexecutados para este handoff em containers descartáveis, com `console/src` montado read-only. Nenhum serviço do laboratório foi iniciado nessa conferência.
- **Todos os containers do laboratório consultados estão parados:** console, Rancher customizado, Keycloak, host legado, fixture Docker aninhado e baseline. Não se sabe a causa da parada externa; não atribuir a uma falha da aplicação sem diagnóstico. O baseline deve continuar parado. Volumes não foram removidos.
- Imagem local `rancher16-community-console:dev` e imagem do container da console coincidem: `sha256:458c18f785bc69e3a6c1ab54f0ec3582cf05afeba89553c5e857ae0b47ea187c`, criada em **16:42:21 UTC**. O container foi iniciado em 16:42:31 UTC, mas está parado agora.
- Backend do container: `sha256:e9b88a0dbc2a1a57ca8e6a264296a57754f8044787f42e1a97a2a4b686a58bbd`.
- Relatório `console/environment-template-browser-test-results.json`: **13 checks aprovados**, três deles axe com `sourceStyles=false` e nenhuma violação. Arquivo gravado em **16:43:56 UTC**. Os arquivos finais do componente/teste de templates têm alteração em **16:44:17 UTC**. Logo, o relatório não deve ser apresentado como aceite browser reproduzido após a última alteração da fonte; repetir o gate depois do próximo build.
- Não foram encontrados processos Windows remanescentes de `environment_browser_readback`, `metrics_browser` ou build Compose da console. O preview temporário de 18091 foi removido anteriormente. Nenhum soak está ativo.

### Trabalho acrescentado nesta continuidade

**Gestão nativa de templates de environment**, aberta pelo botão `Templates` na página `/console/environments`:

- Listagem pesquisável, criação, edição, cópia privada e remoção pela ação nativa anunciada pelo template.
- Stacks Compose com os dois arquivos originais; escolha de template/versão de infraestrutura do catálogo e perguntas tipadas reaproveitadas do catálogo existente. Selecionar infraestrutura no editor não lança workloads; o template é aplicado na criação de um novo environment.
- Payload completo preserva respostas, bindings, versão e Compose; o cache da listagem contém somente apresentação saneada. Respostas completas ficam apenas no estado do editor; strings são mascaradas e mutations usam `gcTime: 0`.
- Nome, descrição e limites validados; cópias começam privadas. Tornar um template público exige confirmação adicional, pois outras contas podem ler suas respostas e arquivos.
- Releitura de schema/permissões e recurso antes de salvar/remover; recusa de alteração concorrente detectada pela comparação do snapshot. Isso é proteção no cliente, não CAS/lock atômico no backend.
- Proteção de rascunho, navegação e fechamento; guard assíncrono após desmontagem/troca de contexto; keys estáveis de stacks para não transferir estado entre linhas.
- Última correção: apagar resposta numérica não a converte silenciosamente em zero; campo vazio impede submit e `-4.5` mantém tipo numérico. Remover uma stack não transfere seu rascunho numérico para a seguinte. As duas regressões estão entre os 19 testes do arquivo de environments.

Arquivos principais:

- `console/src/components/EnvironmentTemplates.tsx`: manager, editor, picker de infraestrutura e resposta numérica.
- `console/src/components/EnvironmentEditor.tsx`: `prepareEnvironmentTemplate` e metadados saneados; mantém criação de environments existente.
- `console/src/pages/Resources.tsx`: entrada lazy do manager, escopada à identidade/environment.
- `console/src/pages/Catalog.tsx`: exporta `QuestionField` para reutilização, sem inventar outro formulário de perguntas.
- `console/src/test/environment-editor.test.tsx`: 19 casos; testes existentes reaproveitados, sem novo arquivo de suite.
- `console/tests/environment_browser_readback.py --templates`: aceitação Playwright nativa, respostas sintéticas não vazias de string/número/booleano, privacidade, temas/mobile, aplicação em environment sem hosts e cleanup. Sem argumento, preserva o readback histórico de `CONSOLE-TEMPLATE-UI`.
- `evidence/console-environment-template-mobile.png` e `evidence/console-environment-template-light.png`: capturas reais. Não contêm credenciais reais.

**Demais entregas desta continuidade**, detalhadas no checkpoint histórico imediatamente abaixo: self-service `Meu acesso` com alias autenticado `self`; fontes de acesso/auditoria backend; remoção em lote; topologia React Flow/Dagre responsiva; revogação de streams por revalidação; métricas/soak; recuperação da infraestrutura nativa, teste DNS/HTTP gerenciado em um host; ensaio isolado de backup/restore Cattle. Não alterar o Ember original nem Rancher Console.

### Evidências e seus limites

| Verificação | Resultado registrado | Limite importante |
|---|---|---|
| Fonte atual, Linux | 160 testes / 16 arquivos + TypeScript | Não equivale a novo build Vite nem novo aceite browser desta fonte final |
| Templates browser | 13, todos passed | Relatório anterior à última alteração dos arquivos; inclui três checks axe empacotados |
| Acesso/auditoria backend | 35 | Identidades externas dinâmicas continuam parcialmente diagnosticadas |
| Self-service browser | 3 | Alias resolvido pelo principal autenticado; GET token pode ter accountId nulo |
| Backend original / flags browser | 24 / 28 | Execuções separadas, não somar como aceite global |
| Topologia / acessibilidade geral | 7 / 11 | Evidências de builds anteriores; axe não substitui inspeção manual completa |
| Streams / lote | 6 / 6 | Não prova revogação autônoma de JWT no backend nem cascatas complexas |
| Métricas, uma hora | 16 | Build 133, código de métricas não alterado depois; não chamar de soak do build final |
| Smoke métricas / perda de cookie | 13 / 9 | Perda de cookie não comprova expiração criptográfica real de JWT |
| Lifecycle físico / rede gerenciada | 10 / 7 | Um host; não cobre LB, multi-host ou TLS de aplicação |
| Backup/restore Cattle | 7 | Não recupera estado Rancher, Keycloak ou volumes de workload |

Os relatórios se sobrepõem; não somar contagens como se fossem cobertura total. O soak de uma hora reteve 854.624 bytes adicionais após GC (6.441.660 → 7.296.284 bytes), dentro do orçamento de 8 MiB sobre baseline.

### Cuidados encontrados nos testes

- Template anuncia `actions.remove`: reler schema/recurso e usar essa ação, sem presumir DELETE ou purge.
- Environment ativo anunciou uma ação `delete` com trailing slash que retornou **404**. O cleanup funcionou usando **DELETE explicitamente permitido no schema `project`, no `links.self` nativo**, sem fabricar endpoint. Essa diferença foi incorporada ao harness, não corrigida no backend legado. Não confundir com falha do novo manager de templates.
- As primeiras fixtures dessa investigação (`1a412` e `1pt6`) foram removidas; a execução browser aprovada também comprovou cleanup das próprias fixtures e preservação do template Cattle. Não remover fixtures históricas por prefixo genérico.
- O preload de imagens precisa de export clássico Docker 20.10.24; o image store moderno gerou referências de camadas ausentes. Manter allowlist fechada do servidor privado do guest. BusyBox 1.36.1 fornece `httpd`; Alpine 3.20 não.
- O scheduler legado precisou estabilizar depois do boot. O gate original de 90 s passou sem ampliar timeout; não prometer SLA de boot.
- `projectId` é parâmetro reservado do autenticador; diagnóstico usa `targetAccount`/`targetEnvironment`. `targetAccount=self` é resolvido no servidor, nunca inferido do contexto/claims. A checagem de acesso nativa usa `usingAccount=null`.
- Testing Library `getByRole` não aceita a opção `exact` nesta versão; strings já são exatas. Vitest transpila sem validar tipos: sempre executar TypeScript também.
- PowerShell: para probes Python complexos, usar here-string single-quoted para stdin; evitar `python -c` com aspas aninhadas. `apply_patch` já causou sobreindentação em Python; preferir substituição da função completa e executar `py_compile` imediatamente.

### Próxima ação recomendada

1. Preservar as alterações atuais: houve edições externas/formatter em layouts, diagnóstico, topologia, templates, Resources e testes. Reler arquivos antes de editar; não reverter nem assumir que o worktree está limpo.
2. O laboratório está parado. Antes de qualquer aceite online, confirmar que é desejado retomá-lo e que o baseline continua parado. Não usar prune, `--remove-orphans`, remover volumes ou subir baseline/customizado juntos. Usar os overlays console e legacy-host; manter callback público em 18090.
3. Recompilar somente a console com a fonte final; ativar somente os serviços necessários quando autorizado. Não confiar que a imagem atual contém todas as últimas mudanças apenas porque o tag coincide.
4. Reexecutar o modo browser de templates no pacote servido, incluindo cleanup e capturas; verificar o resultado JSON, não apenas o último log. Atualizar `docs/08-status.md` e demais marcos de contagem após esse gate; esse documento ainda pode conter o checkpoint 143.
5. Só então voltar ao roadmap: bindings de referências futuras e compatibilidade entre orquestradores; upgrades/rollback/catálogo; JWT real/troca de contexto; matriz de políticas/contas técnicas; LB/multi-host/TLS, drivers/storage, administração/API, migração versionada e recuperação completa de Rancher/IdP. Admin/api/optional continuam desabilitados sem aceite operacional.

Comandos no diretório raiz deste workspace, não no diretório pai `c`:

```powershell
# Build offline em relacao aos servicos do lab; executa suite, TypeScript e Vite.
docker compose --progress plain -f compose.yaml -f compose.console.yaml -f compose.legacy-host.yaml build console

# Somente depois de decidir retomar o lab; nao inicia o baseline.
docker compose -f compose.yaml -f compose.console.yaml -f compose.legacy-host.yaml up -d rancher keycloak legacy-test-host
docker compose -f compose.yaml -f compose.console.yaml -f compose.legacy-host.yaml up -d --no-deps console

# Aguardar prontidao real do backend/IdP e, para gates fisicos, do guest/agente.
python -u console/tests/environment_browser_readback.py --templates
```

URLs após retomada: console `http://localhost:18090/console/`, Rancher `http://localhost:18080`, Keycloak `http://localhost:18081`. Neste handoff, estão parados; não apresentar esses endereços como aplicação servindo agora. Segredos continuam somente na configuração local: nunca imprimir `.env`, cookies, JWTs, URLs com tokens ou dumps.

## Histórico da continuidade anterior em 21/10/2026

Esta atualização prevalece sobre o estado histórico das seções 3, 4, 6, 7 e 8 abaixo. A console foi reconstruída com **143 testes em 16 arquivos**, TypeScript/Vite aprovados, e publicada em 18090. Backend self-service recompilado/publicado somente no laboratório; baseline permaneceu parado e volumes preservados. O fixture legado foi desligado limpidamente e recriado com o mesmo disco para corrigir a allowlist privada de imagens. `modules.metrics=true` e `observability=true`; admin/api/optional continuam false.

- Corrigido texto de limite de memória zero, com regressão de componente; teste de revogação formatado.
- API de métricas repetida: **9/9**. Novo harness `console/tests/metrics_browser.py`: **15/15** com `--soak-seconds 330`, **1/1** com flag real desligada (`--expect-disabled`) e **13/13** após reativação. Relatórios separados `metrics-browser-test-results.json`, `metrics-flag-test-results.json` e `metrics-browser-smoke-test-results.json`.
- Aceite comprovou host/container físicos, unidades/ausência de dados, pausa/retomada/reconexão/fechamento, CSV, temas claro/escuro, viewport 390x844 e desktop 1440x1000, stream de 330 segundos sem reconexão e histórico limitado a 300 pontos/cinco minutos. Capturas `evidence/console-metrics-*.png`, incluindo `container-soak`.
- Retirada de grant de leitor fechou socket real já aberto pela revalidação da console e API passou a negar recurso. Grants temporários foram removidos. Não alegar revogação instantânea autônoma pelo backend.
- Docs 05/06/07/08 atualizados. Python Playwright e Chromium isolado foram instalados para o harness; credenciais são lidas internamente, sem outputs sensíveis. Vitest Windows falhou antes dos casos, por inicialização da suite; gate Linux passou.

- **Streams:** 6 checks físicos comprovaram downgrade member → readonly fechando terminal aberto enquanto GET/logs continuam, seguido de remoção do grant fechando logs e negando GET. Onze regressões de componente cobrem flags, identidade/contexto, consentimento de execute, revogação e limpeza de heartbeat/resize no fechamento remoto.
- **F3 backend/UI:** relatório `localAccessReports?targetAccount=…&targetEnvironment=…`, fontes diretas/grupos/admin e papel calculado pelo resolvedor nativo. Self-service `targetAccount=self` usa `getAuthenticatedAsAccountId()`, não contexto; environment exige autorização nativa com `usingAccount=null`. GET de sessão pode ter `accountId=null`; não derivar ID de claims. Menu `Meu acesso` lazy com flags e environment; leitor não consulta terceiros, auditoria ou ambiente proibido. Identidades dinâmicas externas são parciais. Auditoria read-only preserva snapshots atômicos/cursor/histórico de excluídos. 35 checks backend e 3 browser self-service passaram. `projectId` é reservado pelo autenticador nativo; não usar como filtro.
- **Drawers F3:** acesso efetivo em Usuários, histórico por grupo e auditoria geral inclusive de excluídos. Sete checks de browser com dados reais, temas claro/escuro e mobile passaram; capturas `console-effective-access-*.png`/`console-group-*.png`. UI carrega até 1.000 eventos com aviso de limite.
- **F0/F2:** suíte original reexecutada (24); matriz de flags com navegador (28) comprovou híbrido/exclusivo, senha/sessão local antiga negadas, sessão OIDC persistida, grupos off/on, callback sem F5, autologin/logout sem loop, ticket recusado e rollback. Falha de IdP foi simulada apenas no browser, sem parar Keycloak. O teste preserva todos os overlays e callback 18090.

- **Lote:** remoção nativa adicionada, sem purge, somente tipos homogêneos, até 100, nome exato do environment e aviso de dependências. Quatro regressões adicionais (executor/confirmador); 6 checks físicos com serviços descartáveis confirmaram estado removed, um POST por alvo, nenhum envio sem confirmação, mobile e negação de leitor. Cleanup removeu stack/grant de teste. Cascatas complexas ainda precisam de aceite.

- **Backup Cattle:** `tests/backup_restore.ps1` passou 7 checks: todas as tabelas InnoDB, snapshot online cifrado com DPAPI CurrentUser fora do workspace, restauração com mesma imagem em MySQL sem rede/portas, contagens e seis checksums exatos de RBAC/OIDC/auditoria, origem inalterada e cleanup restrito aos recursos do ensaio. Backup cifrado preservado; localização em `backup-restore-test-results.json`. Não cobre estado Rancher, Keycloak ou workloads; DPAPI não é portável sem a identidade/chaves Windows.

- **Topologia:** React Flow/Dagre lazy, arestas apenas de `serviceConsumeMap`, aliases/direção nativos, filtro por stack, limites 500/2.000, guard de escopo, zoom/fit reais e layout vertical móvel com handles corretos. Sete checks físicos na console principal; capturas `console-service-topology-*.png`.
- **Acessibilidade:** 11 checks axe-core no pacote servido, `sourceStyles=false`, incluindo temas, móvel, auditoria/topologia e retorno de foco. Correções do avatar e badges compartilham tokens. Não usar o probe anterior de injeção de CSS como aceite final, nem confundir axe com aceite manual completo.
- **Métricas:** soak de 3.600 segundos passou 16 checks, sem reconectar; heap após GC 6.441.660 → 7.296.284 bytes, crescimento 854.624 bytes, abaixo de 8 MiB sobre baseline. Rodou no build 133 antes do menu/topologia; código de métricas não mudou depois. Terminal antigo encerrado, nenhum soak ativo. Smoke de 13 e perda de cookie de métricas/logs/terminal (9) passaram após recuperar o host; cookie-loss não prova expiração real de JWT.
- **Infra/rede:** sete imagens auxiliares oficiais exportadas pelo daemon clássico 20.10.24 e carregadas no guest; image store moderno gerou manifesto com referências ausentes. Allowlist fechada no servidor privado corrigida. Seis serviços active/healthy. Gate físico de lifecycle/logs/exec passou 10 após aquecimento, sem relaxar 90 s. Rede gerenciada passou 7 checks em um host: link/IPs, DNS, HTTP, isolamento e cleanup. BusyBox fornece `httpd`; Alpine 3.20 não. `--network-fixture` prepara bundle Alpine/BusyBox no endpoint existente. Não comprova multi-host, LB ou TLS de aplicação.

Próximo trabalho: completar expiração real de JWT/troca de contexto em F7; políticas independentes/contas técnicas e recuperação completa de estado/IdP em F0/F2/F10; templates completos, upgrades/rollback/catálogo, LB/multi-host, drivers, administração e migração de banco versionada. A alternância de configuração requer recarga, não hot reload. Demais pendências do roadmap continuam válidas; frontend não está concluído.

## 1. Objetivo e decisões obrigatórias

Construir um **novo frontend independente** para Rancher 1.6.30, preservando as regras e funções do backend. O usuário autorizou desenvolvimento e testes locais até concluir todas as fases documentadas.

- **Não continuar alterando o frontend Ember original.** Desenvolver em `console/`.
- Manter **logo/identidade original do Rancher e assinatura comunitária opcional**. Não substituir a identidade Rancher.
- Toda customização deve permitir ativar/desativar, com temas configuráveis e componentes reutilizáveis.
- Sidebar/navbar/AppShell compartilhados nas telas autenticadas. Login usa AuthLayout comum.
- Preservar a experiência de **operar tudo de uma tela**, organizada por environment → stack → serviço → container, com drawers para detalhes, ações, logs e terminal.
- Grupos são criados/geridos **no Rancher**, não no Keycloak. Grants por grupo para environments.
- Novo usuário começa sem acesso e sem environment pessoal automático; mostrar acesso pendente.
- OIDC com Keycloak, modo exclusivo e autologin configuráveis; autorização deve existir no backend.
- O usuário quer **todas as funções do Rancher**, não apenas um dashboard ou CRUD genérico. Não declarar fase concluída só porque existe uma rota/formulário.
- Não fazer push, merge, release ou implantação produtiva por inferência. Não modificar outros projetos.

## 2. Workspace e mapa

```text
<workspace>
├── HANDOFF-2026-10-21.md       este documento
├── docs/                      planejamento completo e status anterior
├── console/                   novo frontend + gateway + testes
├── cattle/                    backend Rancher com customizações existentes
├── ui/                        frontend clássico: não continuar modificando
├── rancher/                   fontes/empacotamento legado
├── references/                referências oficiais auxiliares
├── tests/integration.py       helpers e testes do backend
├── evidence/                  capturas e evidências
├── compose.yaml
├── compose.console.yaml
├── compose.legacy-host.yaml
├── compose.workload-test.yaml
└── .env                       credenciais locais: nunca imprimir/copiar
```

Leia `docs/README.md`, `docs/04-roadmap.md`, `docs/08-status.md`, `docs/03-screens.md`, `docs/06-api-security.md` e `docs/10-visual-identity.md` antes de continuar. O checkpoint final no início deste handoff prevalece: 160 testes na fonte e runtime parado. O documento 08 e as seções históricas abaixo podem ainda descrever marcos anteriores.

CWD da sessão: `<workspace>`; shell PowerShell. CWD/lab não são um repositório Git único; alguns subdiretórios são checkouts de fontes. Não descartar alterações nem assumir branch global.

## 3. Runtime atual confirmado neste handoff

| Componente | Container / URL | Estado |
|---|---|---|
| Nova console | `rancher16-community-console`, http://localhost:18090/console?env=1a12 | Parado; imagem e ressalva de fonte no checkpoint final |
| Rancher customizado | `rancher16-rbac-lab`, http://localhost:18080 | Parado |
| Keycloak | `rancher16-keycloak-lab`, http://localhost:18081 | Parado; realm `rancher-lab`, client `rancher16` |
| Host físico de laboratório | `rancher16-legacy-test-host` | Parado; VM RancherOS emulada isolada |
| Ensaio Docker aninhado | `rancher16-workload-test-host` | Parado; agente desse ensaio já havia sido parado por incompatibilidade |
| Baseline original | `rancher16-rbac-baseline` | Parado; preservar |

**Nunca iniciar os dois servidores Rancher sobre o mesmo MySQL simultaneamente.** Não tocar nos containers/volumes Orveta e Rancher Console. Eles estão parados por estado externo a esta entrega.

Credenciais estão no `.env`; testes usam `RANCHER_ADMIN_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `LAB_USER_PASSWORD`. Conta administrativa `labadmin` (`1a1`). Não publicar senhas/tokens em tool outputs, documentação, screenshots ou logs.

Fixtures principais:

- `UI-OPS-LAB`: environment `1a12`; host `1h1`, hostname `console-legacy-host`.
- Container físico `console-standalone`: `1i1`, Alpine 3.20, log `standalone-lab-log` a cada 5s.
- `RBAC-DEV`: `1a7`; `RBAC-PROD`: `1a8`.
- OIDC `sem-acesso`: conta `1a9`; `leitor`: `1a10`; `operador`: `1a11`.
- Environments sintéticos `CONSOLE-TEMPLATE-API` (`1a167`) e `CONSOLE-TEMPLATE-UI` (`1a168`), sem hosts; templates criaram definições de infraestrutura, não infraestrutura saudável.
- Containers de volume `console-volume-writer` e `console-volume-reader`: parados após saída 0; volume `console-data-volume` (`1v269`) preservado.

## 4. Stack e contratos importantes

React 19, React Router 7, TanStack Query 5, TypeScript 7, Vite 8, Radix Dialog, Lucide, xterm 6 lazy e Inter local. Versões exatas no lockfile. Build Linux usa Node 24 e Nginx 1.28 fixados por digest.

Tokens escuros: fundo `#0c141d`, superfície `#0f1924`, texto `#f8fafc`, secundário `#94a3b8`, borda `#1f3347`, primária `#3b82f6`, ação `#2563eb`. Temas claro/sistema/custom também existem.

Config pública: `console/public/console-config.json`, montada read-only no nginx. Atualmente `enabled`, `branding`, grupos, usuários, environments, workloads, bulkActions, hosts, data, catalog e observability estão true; **metrics, admin, api e optional estão false**. Alterar configuração de runtime exige recarga da aplicação; mudar fonte exige rebuild.

Gateway same-origin encaminha `/v1`, `/v2-beta`, `/r`, `/oidc`, `/v1-catalog`, `/v1-webhooks`, `/v1-auth`; mantém host público, WebSockets, deep links e cabeçalhos de segurança. Access log usa URI sem query para evitar tokens.

API/client e regras:

- Cache por identidade/environment, cancelamento de requests e limpeza na troca de sessão; 401 provoca revalidação sem loop.
- Paginação limitada, detecção de ciclos, origem/rotas permitidas. Propagar header de contexto também nas páginas do catálogo.
- Secrets removidos antes do query cache; mutations sensíveis com `gcTime: 0`.
- Revalidar recurso, environment e action nativa antes de mutar; não presumir actions pelo nome do papel.
- Cattle pode negar ação ausente com **422 InvalidAction**, não somente 403. Outro 422 de validação não comprova autorização.
- Datas Cattle UTC e unidades nativas precisam de adaptadores: `host.info.memoryInfo.memTotal` é MiB; não confundir com outros campos em bytes.
- Grupos `/v2-beta/localGroups`: ID `1lg!UUID`, membros são IDs crus como `"10"`, grants como `{"12":"readonly"}` e `revision` com conflito 409. Exclusão usa POST com `{id,name,revision,delete:true}`. Consultar fonte/testes antes de alterar.

## 5. O que já funciona e foi validado

- Shell, temas, marcas Rancher/comunidade, navegação, modais, drawers, formulários, guardas de módulo e proteção de rascunhos.
- Login local/OIDC real; callback sem erro de página inexistente; acesso pendente sem environment e restauração após refresh.
- Grupos locais: lista, membros, grants por environment, revisão e salvamento. Usuários: lista/detalhe/origens dos grants; UI não inventa precedência de acesso efetivo.
- Criação de environments com templates nomeados e prévia das stacks, metadados e links operacionais escopados.
- Operação unificada stack/serviço/container, busca preservando pais, filtros, recursos avulsos, criação/edição/ações/exportação Compose sem sair do environment. Três coleções paginadas, sem fan-out por entidade.
- Lote iniciar/parar/reiniciar/ativar/desativar: máximo 100, capacidades comuns, envio serial, revalidação e resultados recebida/falha/incerta; sem retry automático.
- Hosts: capacidade, busca, containers, metadados, lifecycle e comando de registro oculto até revelar, mantido só em memória.
- Logs e terminal reais via UI no container físico; buffer limitado, busca/download, resize e teardown. Leitor lê logs e não executa/para.
- Catálogo real: busca, origens/categorias, versões, arquivos originais, perguntas tipadas, referências e lançamento de stack. Template InfluxDB importado com serviços parados. Preservar peculiaridade nativa: rancher-compose ainda contém metadados de LB quando Docker Compose desliga exposição.
- Dados: volumes locais, registries/credenciais, secrets UTF-8/base64 e certificados. Senha omitida preserva valor; certificado público precisa ser reenviado no PUT de metadados, chave privada permanece omitida. Secret tem valor imutável. Duas execuções físicas comprovaram persistência de volume e montagem read-only.
- Scrollbars consistentes: 8px geral, 6px sidebar, tokens claros/escuros, corpo de modal/sidebars com rolagem própria.
- Seletor global de environment deixou de ser select nativo: popover pesquisável, sem acentos, atual primeiro, nomes completos, teclado, Escape/clique externo e cores por tema. Troca de escopo real e contraste claro/escuro passaram no navegador.

## 6. Último trabalho — métricas e revogação de streams

**Estado exato:** implementação em fonte; build Linux com **115 testes aprovados** e TS/Vite passou uma vez. Depois houve pequena limpeza apenas no teste de revogação (remoção de asserts temporários/`act` explícito), ainda sem novo build. **Não recriaram a console com essa imagem. `modules.metrics` continua false. Falta aceite visual.**

Confirmado agora: `console/metrics-test-results.json` tem **9/9 PASS** e o processo terminou com exit 0. A suite criou grant temporário de leitor para UI-OPS e o removeu, depois comprovou negação para host/container. Não há teste ativo aguardando polling.

Arquivos novos/centrais:

- `console/src/metrics.ts`: parser nativo, autorização de recurso, taxas CPU/rede/disco, memória e séries limitadas.
- `console/src/components/ResourceMetrics.tsx`: gráficos SVG, status, pausa/retomada/reconexão, CSV e ciclo de WebSocket.
- `console/src/test/metrics.test.ts`: 7 testes de unidades, IDs, contadores, lacunas, ordenação e limites.
- `console/src/test/stream-revocation.test.tsx`: 2 testes; perda de grant fecha métricas; perda de execute fecha terminal mesmo mantendo leitura; descarte de timers/sockets.
- `console/src/streams.ts` e `components/ResourceStream.tsx`: revalidação agora considera action atual, além do GET do recurso.
- `ResourcePanel.tsx`, `pages/Resources.tsx`, `pages/Hosts.tsx`, config e CSS: integração sob `observability && metrics`.
- `console/tests/inspect_metrics_contract.py`, `metrics_integration.py`; contrato sanitizado em `console/metrics-contract.json`.

Contrato medido no agente real:

- Acesso stats retorna `{url,token}`; token somente em variável local, nunca em query cache/persistência/log.
- Container frame usa Docker externalId, não necessariamente ID Cattle. Host pode ter ID null com resourceType host.
- CPU host `total` inclui idle: usar deltas de **user + system**, 100% por core. Não apresentar total do host como uso.
- Memória em bytes → MiB; limite ausente deve ser explícito, zero válido não equivale a ausência.
- Rede/disco em KiB/s por deltas; resets geram lacunas, timestamps repetidos/fora de ordem descartados.
- Histórico máximo 300 pontos/5min; frame máximo 1MiB/32 linhas.
- Revalidar recurso/action a cada 15s, requests com timeout; fechar em perda de acesso/contexto. Não afirmar revogação instantânea do socket pelo backend: **não foi comprovada**.
- Testes React 19: depois de render/iniciar stream, usar `await act(async () => { await Promise.resolve(); })` antes de esperar WebSocket. Fakes só para intervalos; com act inadequado os testes travavam sem criar socket.
- Coleções relacionadas agora aceitam recurso singular ou coleção e excluem stats do painel cru para não cachear URLs/tokens de conexão.

## 7. Evidências e contagens

Contagens acumuladas, com escopos diferentes; não somar como aprovação de todas as fases:

| Conjunto | Último resultado conhecido |
|---|---|
| Frontend Linux | 115 passaram; repetir após última limpeza do teste |
| Gateway | 24 passaram |
| Workloads API / físicos | 7 / 10 passaram |
| Hosts | 7 passaram |
| Catálogo API / persistência UI | 10 / 5 passaram |
| Dados API / persistência UI / volume físico | 22 / 6 / 5 passaram |
| Environments API / persistência UI | 7 / 2 passaram |
| Métricas API | **9 passaram, confirmação neste handoff** |
| Backend anterior / flags isoladas | 24 testes / 112 assertions, incluindo 64 combinações; não reexecutados agora |

Resultados em `console/*test-results.json` e resultados antigos na raiz. Capturas em `evidence/`, incluindo `console-environment-switcher-dark.png`, `console-environment-switcher-light.png`, `console-scrollbar-*.png`, `console-physical-terminal.png`, `console-physical-logs.png`, `console-host-containers.png`, `console-catalog-created.png` e `console-unified-operations-final.png`. **Ainda não existe captura das métricas.**

## 8. Próximos passos concretos

1. Revisar o último diff/fonte de métricas e os testes citados; formatar e aguardar término antes do build.
2. Reexecutar build Linux para confirmar 115 testes após limpeza. Se aprovado, habilitar `modules.metrics` no laboratório e recriar **somente console**.
3. Validar no navegador métricas de `1i1` e `1h1`: segundos frames, CPU/unidades, dados ausentes, pausa/retomada, reconexão, fechamento, CSV e temas; testar desligar/reativar flag. Salvar screenshots e registrar persistência/estado real, não só toast.
4. Completar evidência de revogação em navegador/conexões abertas e ensaio prolongado. Os 9 testes API e 2 de componente cobrem camadas distintas; não provam todas as propriedades do backend WS.
5. Atualizar docs 05/06/07/08 com flags, contrato, contagens e limites atuais.
6. Continuar o roadmap completo abaixo. Não encerrar declarando frontend pronto após entregar métricas.

## 9. Pendências do roadmap completo

| Fase | Pendências materiais |
|---|---|
| F0 — flags/reversão | Matriz integrada de alternância, sessão existente e rollback; não voltar a modificar UI clássica |
| F1 — fundação | Matriz transversal mobile/teclado/temas/acessibilidade e inventários grandes; seletor responsivo ainda sem aceite manual de viewport móvel |
| F2 — autenticação | Matriz completa OIDC exclusivo/autologin/logout/expiração/IdP indisponível/sessões antigas |
| F3 — grupos/acesso | Endpoint de acesso efetivo e auditoria antes/depois no backend, matriz de conflitos/remoção/revogação; não inventar isso só no frontend |
| F4 — environments | Editor completo de templates e políticas de rede; gates/rollback |
| F5 — operação | Formulários completos por seção/tipo, upgrades/rollback, troca de versão de catálogo, grafo, remoção em lote e aceite físico em rede gerenciada |
| F6 — infraestrutura | Snapshots/backups/drivers cloud/storage, redes/LB, administração de repositórios do catálogo e aceitações individuais |
| F7 — observabilidade | Aceite visual das métricas, revogação e longa duração conforme seção anterior |
| F8 — administração | Auditoria/processos/settings, usuários avançados/auth/drivers, API keys/contas técnicas/webhooks/ajuda; admin/api estão desligados e não completos |
| F9 — opcionais | VMs/Windows/Kubernetes/Swarm/Mesos exigem levantamento e ambiente próprio; desativados, sem aceite |
| F10 — consolidação | Segurança/acessibilidade/performance, release/migração/rollback, decisão explícita sobre rotas clássicas |

O roadmap documentado tem gates anteriores ainda parciais. Não declarar os gates satisfeitos pelo fato de ter avançado implementação de outra fase. Recursos genéricos baseados em schema não equivalem a migração operacional completa.

## 10. Laboratório físico e bloqueio conhecido

Docker 20 aninhado/cgroups v2 não executou agente Rancher 1.2.11 corretamente. Host funcional usa **VM RancherOS 1.5.8**, Docker 19.03.15, kernel 4.14/cgroups v1, via QEMU no container `rancher16-legacy-test-host`.

- Container sem privileged, sem socket Docker Desktop, sem mounts/dispositivos do host; volume próprio `legacy-test-state`.
- VM com 1536MB RAM e disco 8GB; container com limite de 2300MB/2CPU.
- Agente e Alpine oficiais pré-carregados. Containers de teste usam rede host **da VM**, não do Windows/Docker Desktop.
- Imagens auxiliares de rede gerenciada falham em TLS/CA no Docker legado. Próxima investigação possível: baixar imagens oficiais pelo Docker Desktop e pré-carregar na VM, seguindo helpers. **Não enfraquecer TLS globalmente** nem alegar LB/network aceitos.
- `console/tests/legacy_guest.py`, `prepare_legacy_host.py`, `preload_legacy_images.py` contêm os helpers. Console guest via socket privado `/run/guest-console.sock`; não imprimir serial/cloud-config que podem conter registration tokens.
- Saída sanitizada do helper aceita apenas linhas `FIXTURE_STATUS`; usar espaço/igual, pois pipe pode ser descartado pelo filtro. Subcomando antigo `agent-status` tem incompatibilidade de formato `.State`, não corrigida.

## 11. Comandos para continuidade

Executar no diretório do laboratório:

```powershell
Set-Location '<workspace>
docker compose -f compose.yaml -f compose.console.yaml -f compose.legacy-host.yaml build console
docker compose -f compose.yaml -f compose.console.yaml -f compose.legacy-host.yaml up -d --no-deps console
python -u console/tests/metrics_integration.py
```

O build já roda `npm test` e `npm run build` (TS/Vite). Formatação no diretório `console`: `npm run format` ou `npm run format:check`. Vitest no Windows aprovou testes antes mas relatou handles no encerramento; priorizar o build Linux do Docker para gate reproduzível.

Testes Python importam helpers de `tests/integration.py`. `Session.api(path, body=None, expected=(...), method=None)`: **terceiro argumento posicional é expected, não método**; usar `method='PUT'`. Requests do laboratório desabilitam proxies. Em sandbox Windows, HTTP/WS pode falhar com WinError 10013; pedir a permissão de rede/execução apropriada, não mudar código por um bloqueio de sandbox.

## 12. Navegador e cuidados de operação

No handoff há uma aba IAB em `http://localhost:18090/console?env=1a12`. Bindings antigos de CUA podem estar inválidos para outra IA: selecionar a aba existente e ler a documentação antes de automatizar. Não inferir IDs AX depois de navegar. Evitar inventar APIs CDP. Não trocar credenciais do usuário para facilitar testes.

Não existem jobs de métricas pendentes: sessão 66050 foi coletada e terminou com 9 PASS. Não continuar implementação neste turno de handoff; o próximo agente deve retomar a sequência da seção 8.

## 13. Limpeza Docker já realizada

Antes de retomar frontend, o usuário pediu limpeza pelo consumo de ~130GB. Foi removido **cache de build não utilizado**, com total informado de **53,55GB recuperados**. Containers e volumes foram preservados (41/38 no levantamento daquela limpeza). Não executar novo prune por rotina e **não usar prune de volumes**. O VHD pode continuar com tamanho lógico grande mesmo após recuperar espaço interno; compactação não foi realizada.

## Prompt curto para entregar junto deste arquivo

> Continue o novo frontend Rancher/comunidade deste workspace até concluir e testar as fases do roadmap. Leia primeiro HANDOFF-2026-10-21.md e os documentos indicados. Não altere o frontend Ember original. Preserve Rancher + comunidade, a referência escura real do Rancher Console, componentes compartilhados, flags, temas, RBAC no backend e operação unificada por environment/stack/serviço/container. Retome pelo aceite de métricas: fonte teve 115 testes aprovados, API teve 9/9, mas flag está false e UI ainda não foi implantada/validada. Distinga implementado, testado, pendente e bloqueado; não declare paridade completa com base em schemas genéricos. Não toque em produção, credenciais ou volumes de outros projetos.
