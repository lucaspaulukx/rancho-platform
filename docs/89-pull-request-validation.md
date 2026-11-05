# 89 — Validação automática de pull requests

Plano de05/11/2026, antes da implementação. Recorte REL04/REL06; CI de fontes não é aceite operacional do Rancher.

## Escopo e gates

Criar workflow de push/PR e execução manual para índice/histórico, testes do scanner, instalação pelo lockfile, formatação, testes frontend e TypeScript/Vite em Linux. Node24 acompanha Dockerfile. Actions externas fixadas por SHA, verificadas nos tags oficiais; token somente contents:read e checkout sem persistir credencial. Cancelar execuções superadas da mesma referência, com prazo máximo explícito.

CI não recebe .env, dumps, realm privado, fixture manifests, sessões ou evidências. Não inicia Docker/Rancher/Keycloak, não faz deploy, publicação de pacote, merge ou migração. Não usa pull_request_target nem injeta secrets em código de PR. Gates de patches/backend, browser físico, bancos, restore/rollback, HA, carga e release continuam separados.

Aceite: verificar YAML/estrutura local, executar os comandos possíveis em checkout sem dependências privadas e observar workflow real no GitHub. Registrar SHA/run/resultados. Falha é corrigida em commits da branch; não afrouxar testes para obter verde. Ausência de política/credenciais locais no runner limita os scanners aos padrões distribuídos; não chamar isso de auditoria completa de secrets ou licenças.

## Primeiro aceite remoto

Workflow real aprovado no GitHub em05/11/2026, commit a5889b0d0c2f5f85477eeaa07ab0b1b201b1f8e7, run https://github.com/lucaspaulukx/rancho-platform/actions/runs/42084849262. Passaram scanners/testes do scanner, npm ci, formatação, testes frontend e TypeScript/Vite em runner Ubuntu limpo, sem arquivos privados do laboratório.

Este checkout parte da main96f1fc5; o aceite remoto corresponde a essa base e ao workflow, não às branches de ulimits ainda em desenvolvimento. Contratos físicos/restore/migração e CI backend continuam fora desse job. Nenhum deploy, merge ou release foi executado.
