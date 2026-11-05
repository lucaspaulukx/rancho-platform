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
