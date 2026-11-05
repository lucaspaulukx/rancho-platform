# 47 — Capabilities de segurança

## Plano antes do código

Substituir JSON de capAdd/capDrop por lista estruturada com opções do schema atual. Flag workloadSecurityEditors independente; mesmo editor em primário/container/sidecars, dentro de Segurança. Adicionar/remover linhas estáveis, sem selecionar privilégios por padrão; opções desconhecidas existentes não são apagadas silenciosamente. POST exige opções válidas no schema fresco, sem duplicatas. CapAdd/Drop podem compartilhar valores: não inventar conflito, pois Docker permite drop ALL/add específico. Checkbox privileged/readOnly já compartilhadas permanecem.

Aceite de opções/revogação de schema, UI/flag/temas e serviço escala0 inativo com drop ALL/add NET_BIND_SERVICE/readOnly true/privileged false, sem instâncias. Negação sem environment e cleanup exclusivo comparando recursos anteriores. Dispositivos/securityOpt avançados continuam nativos, efeito físico e upgrade em gates próprios.


## Aceite de configuração

Build565 testes/65 arquivos + TypeScript/Vite. Seis testes novos: contrato atual/opções, duplicatas, drop ALL+add específico, validação recursiva, linhas sem privilégio implícito, valor legado preservado e flag off.11 checks browser/oito cenários serviço/container × claro/escuro ×1440/390, axe sem violações e sem overflow. NET_BIND_SERVICE adicionado, ALL removido, readOnly=true e privileged=false persistidos no serviço escala0/inativo, sem instâncias. Identidade sem environment negada403. Helpers security_fixture.py/e2e/run.py security; cleanup comparou configurações anteriores e IDs de volumes/containers, manifesto removido. Flag habilitada após aceite. Efeito físico registrado separadamente quando concluído.


## Execução física de memória e segurança

physical_resource_security.py criou um container próprio no host1h1, imagem Alpine cacheada e rede none. Inspeção privada de campos selecionados de HostConfig confirmou Memory134217728, MemoryReservation67108864, ReadonlyRootfs true, Privileged false, CapAdd NET_BIND_SERVICE e CapDrop ALL. Sem publicar HostConfig completo, tokens ou output privado. Teste não provocou OOM nem executou modo privilegiado, multi-host, sidecars ou upgrade.

Primeira tentativa iniciou container, mas o filtro do guest descartou saída JSON e a limpeza precisava parar antes de remover. Recuperado somente1i920 com nome/descrição UUID conferidos; stop/remove solicitado. Coleta alterada para linhas de campos permitidos, cleanup stop→stopped→remove→removed. Repetição completa passou e comparou IDs de containers/volumes anteriores. Relatório physical-resource-security-results.json registra a execução final, sem misturar tentativa falha com aceite.
