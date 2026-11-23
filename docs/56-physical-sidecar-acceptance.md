# 56 — Sidecar físico com rede e volume compartilhados

Plano OPS07: stack própria com primário BusyBox HTTP em8080 e volume anônimo /share; sidecar Alpine reutiliza networkLaunchConfig e dataVolumesFromLaunchConfigs do serviço web. Confirmar dois containers no host original, configuração Docker networkMode container:<primário>, leitura do arquivo do volume e HTTP pelo loopback do sidecar. Não modificar workload anterior. Manifesto UUID e hashes/configs/listas de containers/volumes antes da criação; cleanup exclusivamente por stack própria e comparação com baseline. Sem publicar inspeções completas/segredos.

Este gate cobre criação/execução conjunta e compartilhamento. Upgrade/rollback/remoção seletiva do sidecar têm gates separados, não contar teste de persistência com escala0 como execução física. Aceite pendente.

Diagnóstico26/10: primeira tentativa fez ambos containers rodarem, mas Docker NetworkMode do sidecar era none. Faltava networkMode=container no payload; rancher-compose-executor/setupNetworking envia modo e referência juntos. A falha foi preservada em physical-sidecars-incomplete-network-failure.json. Cleanup de stack/containers/configurações/volumes passou. Relatórios agora incluem status global e a falha de execução, para não parecer que cleanup significa aceite funcional. Formulário passa a recusar referência de rede sem modo container sob flags existentes de sidecars. Repetir gate com o contrato completo.

## Resultado26/10

Nova execução com networkMode=container passou7 checks: infraestrutura pronta; primário e sidecar running juntos no host original; Docker HostConfig.NetworkMode aponta exatamente ao DockerID do primário; sidecar lê /share/marker do volume compartilhado e recebe conteúdo HTTP do primário via127.0.0.1:8080. Cleanup removeu stack/containers próprios e preservou hashes de configurações, containers e volumes anteriores. physical-sidecars-results.json status=passed; manifesto removido. Falha inicial continua arquivada separadamente.

OPS07 criação/rede/volumes físicos aceitos neste recorte. Upgrade/rollback/remoção seletiva físicos permanecem pendentes.

Ajuste de usabilidade previsto após aceite físico: agrupar networkLaunchConfig em Rede e dataVolumesFromLaunchConfigs em Armazenamento, com orientação explícita sobre modo container. Os mesmos grupos são usados pelo primário, sidecars e editores de upgrade. Validar bloqueio de payload incompleto no navegador sem gravar novos workloads.
