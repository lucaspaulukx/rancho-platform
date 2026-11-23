# 89 — Validação automática de pull requests

Plano de05/11/2026, antes da implementação. Recorte REL04/REL06; CI de fontes não é aceite operacional do Rancher.

## Escopo e gates

Criar workflow de push/PR e execução manual para índice/histórico, testes do scanner, instalação pelo lockfile, formatação, testes frontend e TypeScript/Vite em Linux. Node24 acompanha Dockerfile. Actions externas fixadas por SHA, verificadas nos tags oficiais; token somente contents:read e checkout sem persistir credencial. Cancelar execuções superadas da mesma referência, com prazo máximo explícito.

CI não recebe .env, dumps, realm privado, fixture manifests, sessões ou evidências. Não inicia Docker/Rancher/Keycloak, não faz deploy, publicação de pacote, merge ou migração. Não usa pull_request_target nem injeta secrets em código de PR. Gates de patches/backend, browser físico, bancos, restore/rollback, HA, carga e release continuam separados.

Aceite: verificar YAML/estrutura local, executar os comandos possíveis em checkout sem dependências privadas e observar workflow real no GitHub. Registrar SHA/run/resultados. Falha é corrigida em commits da branch; não afrouxar testes para obter verde. Ausência de política/credenciais locais no runner limita os scanners aos padrões distribuídos; não chamar isso de auditoria completa de secrets ou licenças.
