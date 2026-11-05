# 90 — Criação física de limites em serviço e sidecar

Plano de05/11/2026, antes do teste. Fecha a lacuna de criação primária/sidecar indicada em87, sem inferir paridade de todos os limites Docker.

Usar o formulário contextual real para criar serviço próprio com uma réplica e um sidecar: nofile1024/2048 no primário e128/256 no auxiliar. Flag workloadUlimitEditors=true somente no contexto de teste, com módulos de criação por seções/sidecars existentes. Nenhum descriptor, schema ou resposta de API é substituído. Stack, service, labels e imagens são próprios; mutations permitidas somente no collection do environment1a12 e stack criada pelo harness.

Conferir schema/payload/resposta nativos, dois containers running no host1h1 e identificação do sidecar pela label nativa io.rancher.service.launch.config. Remover relay temporário85 antes de qualquer inspect; comprovar HostConfig e ulimit -Sn/-Hn em ambos os processos. Preservar configurações/containers/volumes anteriores e remover stack, instâncias, arquivos/regra de diagnóstico e sessão própria.

Sem alteração de frontend neste recorte; reutilizar editor87 já aceito no container avulso. Relatório próprio e falhas anteriores preservados. Não executar em paralelo com outro fixture físico/serial. Gate positivo só após todos os valores e cleanup; rede nativa, multi-host, demais rlimits e acessibilidade manual permanecem separados.

## Aceite — 05/11/2026

`python console/tests/service_sidecar_ulimit_creation.py` passou. O browser criou serviço primário e helper pelo formulário compartilhado, mantendo limites independentes. Primário1024/2048 e sidecar128/256 coincidiram no payload/resposta nativos, HostConfig e processo. Dois containers running no host1h1; helper identificado pela label nativa. Nenhuma alteração de frontend neste recorte, zero erro JS e navegador encerrado.

Relay120s removido antes dos inspects,61 conexões/zero falhas e zero pong timeout na observação final75s. Quatro checks do harness e três checks browser, cleanup de stack/containers/volumes/regra/arquivos/sessão e comparação de hashes anteriores passaram. Relatório local ignorado: console/service-sidecar-ulimits-results.json, status passed/cleanupComplete/controlSessionRevoked=true.

Fecha a lacuna de criação física primária/sidecar de87 para nofile/Linux/um host. Não prova demais rlimits, throughput, CNI nativo ou multi-host. Não houve mudança de defaults: workloadUlimitEditors continua ausente/off no pacote público.
