# 85 — Diagnóstico do heartbeat do scheduler no laboratório

Plano antes de alterar infraestrutura. Gate51/69 reapareceu durante83: duas fixtures não alocaram em240s; a última3 réplicas limpou corretamente. Scheduler running/healthy registrou11 pong timeouts/15min e nenhuma linha de alocação no recorte. HTTP/host ativos não provam event stream saudável. Fonte oficial scheduler v0.8.6 foi clonada somente em migration-runs ignorado; trash.conf fixa event-subscriber9a4724d, cujo ping5s/pong deadline10s coincide com a categoria observada. Isso não prova causa nem versão do Go do binário em execução.

## Tasks e gates

1. Medir caminho da VM com cliente controlado usando a mesma implementação vendorizada de WebSocket, chave própria de environment e contagem apenas de ping/pong/latência/status. Comparar caminho direto do host e do guest, manter intervalos5s/limite10s. Não copiar credenciais do scheduler nem salvar frames de eventos. Sessões/chaves próprias revogadas em finally.
2. Conferir conexão/endereço atual, relógios/recursos e lifecycle do cliente por métricas reduzidas. Fonte/documentação não substituem evidência do binário nem autorizam concluir relógio/Go como causa.
3. Somente após isolar causa, propor correção sob opção de laboratório ou patch de componente conforme fronteira. Não trocar serviço global, remover infraestrutura ou aumentar timeout para fazer teste passar. Preservar imagem/configuração/recurso anterior e prever reversão antes de mudança.
4. Aceite da correção exige observação longa sem reconexões indevidas e múltiplas alocações/remoções no orçamento declarado, incluindo3 réplicas. UI/Node saudável isolado não fecha este gate. Repetir83 bloqueado só depois de controle equivalente.

Fonte: https://github.com/rancher/scheduler/tree/v0.8.6 e dependência fixada em trash.conf. Sem claim de correção neste plano.

## Controles medidos — 05/11/2026

Fonte oficial v0.8.6 confirmada no commitd9a8d0a5b624a47649df52c72e125f29d582f36f. Probe descarta frames de eventos e conserva somente contagens/RTT. Em35s, cliente com o vendor pinado recebeu6 pongs/6 pings no host e no guest, em rota de environment e global/v2-beta. Repetição compilada em Go1.9.7 e com ping vazio, como event-subscriber, também6/6 e zero timeouts; RTT máximo do guest3.451ms. Não reproduziu o comportamento do processo scheduler. Não concluir que Go/relógio/rota/VM inteira sejam a causa.

Primeiros ensaios do guest eram inválidos porque a console não tem comando base64; o pipe entregava0 bytes ao binário. Probe passou a decodificar internamente o input; relatórios inválidos preservados, sem considerá-los medição saudável. Tentativa inicial no namespace do scheduler falhou antes da medição e não foi aceita; wrapper agora registra estágios/exitCode/categorias fixas e confirma cleanup do container próprio antes de liberar manifesto. Ainda em diagnóstico.

`scripts/build_scheduler_probe.py` clona/verifica o pin público e compila sem rede no Docker usando SDK moderno pinado pelo Dockerfile. `--legacy-go` baixa somente o SDK diagnóstico oficial1.9.7 e verificaSHA25688573008f4f6233b81f81d8ccf92234b4f67238df0f0ab173d75a302a1f3d6ee, conforme https://go.dev/dl/?mode=json&include=all. SDK antigo e binários ficam ignorados; não substituem o SDK nem o scheduler do produto. Source/vendor e SDK são montados readonly; saída dedicada sem Docker socket. Imagem Go pinada deve estar presente no Docker local.

```powershell
python scripts/build_scheduler_probe.py --legacy-go
python console/tests/scheduler_heartbeat.py --global --legacy-go --empty-ping
python console/tests/scheduler_heartbeat.py --global --legacy-go --empty-ping --scheduler-network
```

O último comando usa container temporário próprio na rede do scheduler atual, sem compartilhar seus arquivos/PIDs/credenciais. Não alterar serviço/scheduler/timeouts para executá-lo. Chave própria somente do UI-OPS-LAB é revogada ao terminar. Binário transferido por HTTP privado loopback do container da VM; programa temporário e servidor próprios limpos. Serial contém somente credencial temporária do probe no canal privado; nunca copiar esse log ou capturar eventos para evidências públicas. Arquivos de estado não contêm a credencial.

## Caminho isolado e ensaio temporário — 05/11/2026

Mesmo clienteGo1.9.7, rota global e ping vazio: host6/6; container próprio na rede gerenciada do scheduler perdeu pongs e encerrou por timeout. Config Docker native do scheduler é networkMode none porque Cattle atribui rede managed ao container; rota via10.42.0.1, eth0 MTU1402. Controle em container próprio na bridge padrão do mesmo Docker foi6/6 e máximo2.777ms. Isso isola diferença no caminho gerenciado, sem atribuir ainda a regra/kernel exatos. Contador do primeiro probe incrementava também no tick de expiração; mantido relatório original e corrigida contagem nas versões seguintes.

MSS1000 somente no socket do probe não resolveu (2 pongs, timeout). Controle via gateway: relay TCP temporário aceitou uma conexão apenas do IP do namespace atual e encaminhou bytes ao mesmo backend lab, sem logs/caches/credenciais em arquivos; recebeu6/6 em35s, RTT máximo3.675ms. Relay/cliente/chave próprios removidos. Isso orientou um teste de rede reversível, não uma alteração no produto nem prova de produção.

Ensaio real `python console/tests/scheduler_relay_trial.py`: regra DNAT temporária apenas no guest isolado, source IP/MAC do scheduler verificado no environment UI-OPS-LAB/host1h1, destino exato Rancher172.21.0.4:8080, comentário próprio e remoção exata em finally/trap. Relay limitado a120s e16 conexões simultâneas, sem registrar payload. Sem mudar CATTLE_URL, stack/serviço do scheduler, timeouts, configuração do frontend ou rede externa. Três réplicas próprias alocadas em3.15s (budget90), confirmadas no Docker pelos mesmos IDs;59 conexões encaminhadas/zero falhas e zero pong timeouts nos75s finais. Regra, binário, serviço/containers e sessão próprios limpos; configurações de workloads anteriores preservadas.

Este é um ensaio com desvio local, não correção permanente do CNI. Resultado sem desvio permanece instável. Próximo: reusar só a preparação de alocação e encerrar a regra antes de validar streams83; manter gate de estabilidade nativa e soak independentes. Nenhum ambiente real/dump/infraestrutura fora do laboratório foi alterado.
