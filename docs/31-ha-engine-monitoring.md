# HA e pools do engine — contrato e plano

## Fonte e recorte

A rota HA original consulta somente clusterMembership e mostra UUID, advertiseAddress, httpPort, clustered e heartbeat. Endereço/porta/clustered vêm do JSON `config`; o modelo antigo copia todos os campos desse JSON. A console nova deve extrair somente as propriedades necessárias antes do cache, preservando id/uuid/heartbeat do registro e descartando config bruto.

O endpoint processPool é somente leitura, lista executores em memória e não fornece id. Nome/posição identificam linhas de consulta, sem ações sobre pools. Contadores activeTasks/poolSize/queueSize são instantâneos; completedTasks/rejectedTasks acumulam no processo atual. Não interpretar rejeições acumuladas como incidente da última atualização nem mínimo configurado como quantidade real de threads sempre iniciadas.

## Implementação planejada

- Flag clusterMonitoring para HA, inicialmente false: painel administrativo com membros registrados, heartbeat, endereço/porta e clustering informado, atualização automática pausável e manual. Não inferir quórum/saúde ou nós efetivamente disponíveis pela quantidade de linhas.
- Flag processPools, dependente de processes: aba no mesmo painel de processos, com filtros/posição da aba de execuções preservados. Poll somente na aba ativa, pausa/atualizar, ordenação e tabela responsiva com foco para rolagem por teclado. Colunas mostram números reais, inclusive o sentinel2147483647, sem afirmar infinito literal.
- Todos em AppShell, DTO/abort/cache por identidade, estados vazio/erro, flags, temas e gate admin. Nenhuma escrita de negócio, replay ou download para abrir esses painéis.
- O schema também anuncia haConfig PUT/createscript/dbdump, mas esses não são controles usados pela rota HA original atual. O fonte de createscript altera ha.cluster.size e embute material de criptografia/credenciais no script. Não será exposto como preview inofensivo; migração/configuração e exportação de backup são fluxos administrativos separados, com laboratório/recovery próprios. Não executar script ou dump para validar a tela de monitoramento.

## Gates

Domínio (JSON limitado/allowlist/timestamps/contadores), componente e navegação sem perder filtros, build, navegador nativo admin/leitor, pausa/retomada, flags e quatro cenários de tema/tamanho em cada painel. Consulta não comprova HA físico ou tuning do engine. Não ativar até gates.

## Implementado — 22/10/2026

`modules.clusterMonitoring=true` e `modules.processPools=true` após build **432 testes/50 arquivos + TypeScript/Vite**. Oito casos de domínio e seis de componente: allowlist do JSON config, identidade/heartbeat preservados, JSON malformado/limitado, IPv6/porta, contadores desconhecidos/zero/sentinel, cache sem payloads, gate admin/flag, rolagem focável e troca de aba preservando filtros. Nenhuma configuração de HA foi alterada.

Navegador real: 23 checks, incluindo oito cenários tema/tamanho com axe/layout, dados nativos, pausa/manual/retomada de polling em ambos os painéis, aba inativa sem consulta de pools, filtro preservado, flags e negação nativa/UI de leitor. A suíte proíbe explicitamente chamadas a haConfigs, mutações, scripts e dumps. Relatórios engine-monitoring-e2e-results.json/engine-monitoring-a11y-results.json.

DataTable agora oferece região nomeada e tabIndex0 para rolagem por teclado em tabelas sem botões. Nova regressão das 11 rotas anteriores (44 cenários axe/layout + seleção de environment por teclado) aprovada. Fluxo nativo de processos/replay repetido depois da mudança de abas: 13 checks; fixture credencial1c417/processo1pi18717 revogada e manifest ausente.

Não é validação de HA físico, failover, quórum, tuning de pools ou migração de banco. A rota HA atual do frontend legado é somente leitura; as APIs adicionais de configuração/exportação não foram convertidas em ações automáticas. Drivers e catálogo administrativo permanecem como tarefas distintas.
