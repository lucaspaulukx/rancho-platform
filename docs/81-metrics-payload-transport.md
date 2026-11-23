# 81 — Transporte de métricas grandes e conexões ociosas

Plano antes da implementação. Teste79 pelo proxy18090, serviço próprio3 réplicas, token agregado10524 caracteres: handshake414. Fonte/controles limpos. Comparação no mesmo backend com guarda off usa token menor e funciona; portanto a guarda não pode virar default antes de resolver esse efeito.

## Backend e protocolo

- Flag `RANCHER_METRICS_PAYLOAD_TRANSPORT_ENABLED=false`, dependente de customização e proxy compatível. Sem flag ou sem opt-in HTTP `X-Rancher-Stats-Payload: 1`, manter retorno/token nativos. Header sinaliza capacidade, nunca autorização.
- Getters de containerStats (incluindo host com muitos containers), service/containerStats e project/hostStats podem negociar. Acima de4096 caracteres, resposta com URL nativa, envelope JWT curto assinado contendo payload=true e campo payload com JWT completo. Máximo16MiB; sem persistência/log/cache público desse valor. Originais sem opt-in continuam no fluxo existente; não alterar Ember nem aumentar limite de URI do Nginx.
- Go valida envelope RS256/expiração antes do upgrade; espera primeiro frame no máximo30s e16MiB, valida JWT completo e todas as provas internas antes de abrir backends. Deadline de negociação removida após autenticar o lote. Para token sem payload, validar lote antes do upgrade. Renovação não aceita token expirado nem devolve prova renovada ao navegador.
- Manter terminal ocioso válido através do proxy por PING WebSocket periódico30s, somente após revalidar autorização quando guarda está on. Não enviar texto/comandos ao stdin e não aumentar timeouts para encobrir scheduler. Fechar recursos quando backends acabam; matriz off mantém comportamento legado declarado.

## Novo frontend

- Flag independente `modules.metricsPayloadTransport=false`, opcional/additiva em configuraçãov1 com ausência equivalente a false. Mantém shell/drawers/tema e operação em contexto.
- Só enviar opt-in quando feature habilitada; aceitar resposta legada sem payload. Resposta negociada exige envelope com payload=true e JWT limitado, rota real de stats e mesma origem. Dados grandes ficam em RAM, enviados uma vez no onopen e descartados em seguida/close/error/unmount/troca de contexto. Não enviar depois de abort/sessão inválida nem reconectar automaticamente.
- Encerramento1008 continua com explicação comum e limpeza de timers. Sobre mostra flags frontend/backend. Off retorna ao contrato anterior, sem alterar grants/workloads.

## Tasks e gates

1. Java: DTO e regra compartilhada para3 getters, flags e contratos de opt-in/limite/fallback/envelope sem cópia do conteúdo nas claims.
2. Go: limites/negociação, lote parcialmente inválido e backend-close/idle PING com race detector. Nenhum segredo em logger.
3. Frontend: função reutilizável de conexão de stats, envio único/cleanup, flags/deep route e contratos de domínio/componentes. TypeScript/Vite e regressão necessária.
4. Mesmo artefato on/off:3 réplicas pelo proxy real, quatro transportes, controles positivos e revogação; local/OIDC/grant/desativação/expiração real. Conexão ociosa >90s e lease >300s através do proxy. Todas as fixtures próprias limpas; conservar evidência de414 anterior.
5. Build limpo do Git+patches; ativar somente no compose/config modernos depois dos gates, com overrides false. Rollback de artefato deve restaurar a configuração correspondente (bundle antigo rejeita flags desconhecidas); preservar backups de config. Carga/HA/API keys e revisão de distribuição continuam em gates próprios.

## Implementação e controles intermediários — 05/11/2026

Implementados DTO/regra compartilhada nos3 getters, campo statsAccess.payload com leitura junto de token/url, resposta no-store/no-referrer, flag frontend aditiva/off e cliente com envio único/descarte. Primeiro ensaio detectou campo filtrado pelo schema apesar de envelope curto; corrigido sem conceder coleção/ação nova. A autorização continua no getter e em cada prova validada pelo proxy.

A imagem agora declara RANCHER_METRICS_PAYLOAD_PROXY_PROTOCOL=1 separadamente do protocolo da guarda UI. Capacidade metricsPayloadProtocol=1 é conferida no processo Go real antes de emitir acesso quando o transporte está habilitado, inclusive com guarda UI off. Evita tratar um proxy anterior como compatível só porque ele já tinha guarda de sessões.

Envelope negociado sob guarda on leva rancherNegotiation assinado com caminho público, modo e prova compacta da primeira fonte. Assim sessão/grant inválidos recusam o handshake antes do upgrade; corpo completo e **todas** as fontes são verificados de novo antes dos backends. Handshakes fazem check fresco, sem herdar decisão positiva do cache de encaminhamento250ms. Cache permanece limitado para dados/idle; não promete atomicidade entre check e frame. PING30s ocorre só após revalidação; backend encerrado fecha o socket. Deadline30s é de negociação, não duração da conexão autenticada.

Regras Java:149 configuração/58 payload/39 envelope; teste adicional distingue marcador do proxy UI e do transporte. Go upstream/novos/race aprovados. Frontend625/72 + TypeScript e build Linux aprovados;3 contratos adicionais de flags cruzadas passaram na suite focada34, regressão final ainda a consolidar.

Teste físico corrigido pelo proxy18090, serviço próprio3 réplicas: token de URL10524→1855 caracteres, JWT completo no primeiro frame, Cache-Control no-store. Admin e6 casos de grant/desativação/expiração local/OIDC passaram nos4 transportes com novosWS401,1008/zero dados posteriores, controles válidos e cleanup de contas/grupos/sessões/settings. Não aumenta limite de URI do Nginx. Demais mudanças autônomas do scheduler/volumes de sistema continuam relatadas, sem alterar configurações/containers/volumes de aplicação anteriores.

Navegador usa uma fixture de transporte: painel de **container próprio**, descriptor de estatísticas reais do **seu próprio serviço** com3 réplicas, substituído apenas na rota do contexto headless para exercitar o primeiro frame grande. Não altera resposta global nem concede acesso extra e não representa entrega de um gráfico agregado de serviço na interface. metricsLink continua expondo host/container; UI agregada de serviço continua no inventário OPS13. Flags de frontend são ativadas apenas nesse contexto para o teste, sem editar a configuração pública. Conexão através de18090, frame único, amostra ao vivo e fechamento sem reconnect foram conferidos antes do ensaio longo; lease320s/idle pelo proxy, cleanup final, pacote limpo e matriz off/on final ainda em validação. Defaults permanecem false neste checkpoint.

## Aceite físico e ativação — 05/11/2026

Regressão final Linux:628 testes/72 arquivos, TypeScript/Vite aprovados. Contratos Java149 configuração/58 payload/39 envelope, Go upstream/novos/race e build backend limpo do índice+patches aprovados. Artefato backend a380c3b43ad6b9f2af49b5c9ba6d20bfacbe9cc64b28deb1489dc3d45b147150.

Ensaio final no mesmo artefato, proxy18090,3 réplicas e4 transportes: lease320s confirmou dados válidos além da prova inicial300s e posterior revogação com novosWS401, fechamento1008/zero dados posteriores e controles independentes válidos. Fixture de navegador passou8 checks: envelope1855 caracteres, corpo10588, um frame, amostra real e encerramento sem reconectar. A substituição do descriptor existe só no contexto headless, conforme limite descrito acima.

Comparação final off conservou o transporte negociado e reproduziu a vulnerabilidade legada nos4 transportes; relatório bruto permanece failed, wrapper registra legacyBehaviorReproduced e cleanupComplete. Ambos os ensaios finais limparam recursos/sessões próprios. Mudanças autônomas de recursos de sistema ficam registradas separadamente; gate de estabilidade51/69 permanece aberto.

Depois desses gates, compose moderno habilita guarda de streams e transporte de métricas por defaults substituíveis false; configuração pública moderna habilita modules.metricsPayloadTransport. Compose base e defaults Java permanecem false, opção ausente no frontend continua false. Runtime18090 foi conferido com ambas as capacidades efetivas true e sem manifesto de fixture pendente. Os parágrafos anteriores registram checkpoints intermediários, anteriores à ativação.

Evidência local ignorada: console/host-stream-admin-revoke-lease-service-proxy-payload-browser-scale3-on-results.json, console/host-stream-admin-revoke-service-proxy-payload-scale3-off-results.json e migration-runs/metrics-payload-{backend,clean,console-final}-build.log. Não distribuí-los como fixtures públicas. API keys em streams, carga/HA, auditoria de credenciais, UI agregada de serviço e gates48 continuam pendentes.
