# 73 — OBS02: revogação com conexão aberta

Plano inicial: medir primeiro o comportamento nativo, sem afirmar proteção de streams a partir de testes HTTP.

1. Criar somente uma stack descartável em UI-OPS-LAB, sem serviço/container, com nome/descrição próprios e manifesto de recuperação sem credenciais.
2. Abrir subscribe do environment com uma sessão administrativa própria. Confirmar recebimento de evento da stack pelo ID e valor sintético em memória; descartar demais payloads sem persistir.
3. Excluir somente `token/current` dessa sessão. Confirmar401 numa requisição protegida e recusa de nova conexão. Publicar nova descrição sintética com uma segunda sessão administrativa própria.
4. Medir fechamento e eventual entrega posterior no socket já aberto. Um socket aberto que continua recebendo após revogação constitui falha do gate, mesmo com HTTP401 correto.
5. Limpar somente a stack com propriedade conferida; revogar as duas sessões e preservar inventário anterior. Nenhuma alteração em grants/contas existentes.

Se houver falha, implementar revalidação sob flag independente, com encerramento, testes on/off, expiração real, desativação e remoção de grant usando identidades próprias. Logs/exec/métricas têm transportes e credenciais diferentes e exigem gates próprios. Este documento não os considera resolvidos por subscribe.

## Medição nativa — 04/11/2026

Falha confirmada: handshake101, evento próprio antes da revogação recebido, nova requisição protegida401 após DELETE token/current, porém a conexão anterior permaneceu aberta e recebeu uma atualização posterior (após janela6s). Uma entrega antes e uma depois; nenhum payload persistido. Cleanup removeu a stack própria e preservou as anteriores. Resultado privado em `console/ws-revocation-results.json`; manifesto removido. O gate OBS02 permanece aberto e exige correção no servidor, não apenas desmontar o componente frontend.

## Correção aceita no recorte de revogação de token

`GuardedWebSocketSubscriptionHandler` envolve o writer de subscribe de sessões UI opacas. Antes de cada mensagem/ping, consulta token atual/expiração/provedor, valida JWE, conta ativa e perfil atual; para project compara papel efetivo atual ao inicial. Falha de consulta fecha sem expor motivo, token ou payload. Sessões sem cookie/atributo UI continuam no handler nativo: credenciais técnicas têm gate separado. O wrapper serializa check/write/close e não reabre após revogação.

Flag `RANCHER_SUBSCRIPTION_SESSION_GUARD_ENABLED`: defaultfalse no backend/base, efetiva somente com customização ativa. Compose moderno assume true, com overridefalse disponível. Não altera intervalo de ping5s nem timeout do scheduler. Em repouso, fechamento depende do ping existente; validar latência sob carga em OBS03. Mensagens já enfileiradas antes da revogação são uma fronteira distinta, não há promessa de revogação retroativa.

Contratos:128 assertions de configuração/64 combinações e10 do writer (negação, falha fechada, fechamento idempotente, impossibilidade de reabertura e ausência de payload posterior). Build Java aprovado. Frontend595/70 e TypeScript/Vite aprovados novamente.

Matriz real no mesmo artefato: flag on→handshake101, evento anterior recebido, HTTP401 e nova conexão401 após revogação, socket anterior fechou1000 e zero evento posterior. Flag off→HTTP/nova conexão401, porém socket anterior aberto e um evento posterior; comportamento nativo preservado. Ambas as sessões próprias foram revogadas e cleanup conferiu todas as stacks anteriores. Relatórios `ws-revocation-flag-on-results.json` e `ws-revocation-flag-off-results.json`, ignorados no Git.

Uma repetição intermediária foi invalidada: reinício do backend antes do fim do cleanup. Stack exata recuperada e baseline preservado, sem contar a tentativa como aceite. A limpeza de uma sessão controle perdida nessa interrupção não foi confirmada; não revogar sessões administrativas indistintamente para ocultar esse limite. Harness passou a registrar falha/cleanup e revogar sessões mesmo se a remoção atrasar.

Ainda faltam: matriz real de remoção de grant/desativação/expiração local+OIDC, carga, API keys, logs/exec/métricas. OBS02 inteiro continua parcial.

## Matriz ampliada aceita — subscribe UI

Quatro cenários adicionais passaram: retirada do único grant readonly de um grupo próprio; desativação de conta própria; expiração real45s de sessão local; expiração real45s de sessão OIDC. Todos receberam evento próprio antes, fecharam1000, não receberam evento posterior e recusaram nova conexão. No grant, GET do project404 e handshake403; nos demais,401. Configuração de validade foi restaurada exatamente antes da espera, sem adulterar relógio/cookie. Não isola contribuição da expiração do registro versus exp do JWE.

Grupos, contas, credenciais, usuários Keycloak, vínculos OIDC e stacks próprios foram limpos. Hashes dos registros anteriores e configuração foram preservados. Manifestos de recuperação ausentes no fim. A limpeza reativa somente a conta própria quando necessário para encerrar sua sessão, antes da remoção definitiva. Sessão do controlador e do helper de cleanup também são invalidadas.

Harness OIDC corrigido: usar accountId da resposta POST do login, não GET token que pode retornar metadado sem seleção. Keycloak deste laboratório não preservou atributo de usuário não gerenciado; ownership usa username aleatório, lastname exata e mapeamento issuer/sub próprio. Renovar token administrativo do IdP imediatamente antes do cleanup. Aceitar tombstone nativo removed/purged apenas com ID/nome/descrição próprios e removed não nulo. Tentativas anteriores com falha de harness/cleanup foram recuperadas e não contam como aceite.

OBS02 permanece parcial para credenciais técnicas e transportes de logs/exec/métricas. Carga, filas anteriores à revogação e latência de fechamento ficam em OBS03. Nenhuma alteração em grants/usuários existentes foi necessária para os cenários aceitos.
