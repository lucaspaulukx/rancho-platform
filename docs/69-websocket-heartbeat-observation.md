# 69 — Observação independente de heartbeat

Diagnóstico somente leitura do gate de estabilidade51: usar sessão administrativa temporária própria para conectar ao subscribe descoberto no backend local18080, via WebSocket. Ping de controle a cada5s durante30s; registrar somente contagens, latências e close/status numéricos. Não imprimir/salvar cookie, headers ou frames de eventos. Limitar payload, desativar redirects/compressão e permitir somente localhost18080/subscribe; revogar somente a sessão criada pelo probe ao encerrar.

Reutilizar o WebSocket do runtime Playwright já instalado, sem adicionar dependência ao produto. Não alterar backend, VM, scheduler, timeouts ou política de autenticação. Este caminho usa cliente Node no host e cookie administrativo, diferente do Go scheduler dentro do guest com credencial técnica; mesmo um resultado saudável não prova que o scheduler foi corrigido, nem é soak/OBS03. Medir baseline antes de atribuir causa a capacidade, protocolo ou NAT.

A API nao anuncia subscribe em links. Fonte do EventRouter confirma TODO e construcao apiURL + /subscribe; probe deriva caminho a partir do self validado da API, sem inventar origem nem aceitar redirects. Primeira tentativa encerrou sem conectar e revogou a propria sessao. Seis pings em30s, mais margem ate35s para receber ultimo pong; classificar RTT abaixo10s separadamente, nunca registrar frames.

Endpoint global retornou404 para cookie administrativo, sem conexao/ping; isso nao mede transporte. Schema subscribe existe no UI-OPS-LAB com GET/POST. Probe passa a descobrir links.collection desse schema autorizado e restringir path a /v2-beta/projects/1a12/subscribe. Nunca extrair credencial tecnica do scheduler para contornar esse escopo. Sessoes das tentativas foram revogadas.

Medicao valida no scope de environment: HTTP101, seis pings/seis pongs, RTT1.23–1.48ms, fechamento1000, sem erro; seis frames de eventos descartados sem inspecionar/salvar. Sessao propria revogada. ws-heartbeat-direct-results.json. Isso mostra controle saudavel nesse cliente/caminho durante35s; nao resolve os timeouts do Go scheduler no guest nem cobre carga/soak. Nenhum timeout/configuracao foi alterado.

Repetido durante fixture70 ativa no inicio/fim do probe: seis pings/pongs, RTT0.94–1.38ms, close1000, sem erro,28 frames descartados e sessao propria revogada. ws-heartbeat-under-cpu-reset-results.json. Mediu controle durante operacoes de configuracao, com workload idle; nao simulou pressao de CPU nem muda a limitacao do caminho Go/guest.
