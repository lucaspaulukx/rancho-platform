# 74 — Histórico Git e validação da base comunitária

Data:04/11/2026. O diretório passou a ter repositório Git próprio em `main`. As alterações anteriores não tinham commits locais do projeto; a base inicial sanitizada registra o estado encontrado, sem inventar cronologia retroativa. Clones oficiais e seus históricos continuam fora do pacote público. Próximas mudanças ficam em commits incrementais com testes e documentação correspondentes.

## Organização

- Fontes modernas em `console/`, extensão clássica preservada em `legacy-ui/`, alterações de Cattle em `patches/cattle.patch` e commit oficial em `upstream.json`.
- `python scripts/upstream.py apply`: obter/aplicar sem reset de alterações existentes. `export`: atualizar patch após editar Cattle. `check`: validar patch e impedir perda de alterações locais não exportadas.
- Bootstrap reproduzido num clone limpo local:22 arquivos de backend iguais à origem, aplicação repetida idempotente e verificação reversa aprovadas. Nenhuma referência externa de consulta é necessária para construir o produto.
- `.githooks/pre-commit` verifica arquivos preparados, segredos locais conhecidos e sincronismo do patch. Ativar com `git config core.hooksPath .githooks`. Política privada adicional pode ficar em `.git/private-policy.json`; não faz parte da distribuição.
- O checker não substitui auditoria de dependências, segredos históricos ou segurança de release. Dumps, manifests de teste, evidências, logs, credenciais e dependências instaladas são ignorados.

## Evidências atuais

Frontend595 testes/70 arquivos e TypeScript/Vite aprovados. Nova identidade sem segunda logo: modal Sobre em8 cenários com axe/layout e flag off; formulários em4 cenários com axe/layout e zero escrita;21 rotas em desktop/mobile (42 checks) sem erro JS/asset/overflow. Tokens próximos ao Rancher e tipografia Inter; temas e flags preservados.

Migração72:17 testes automatizados; diagnóstico real de110 tabelas; backup criptografado (~28MiB), restore repetido, integridade, migração aditiva/idempotência e rollback com checksums completos aprovados em cópia offline. Segundo ensaio removeu somente na cópia as tabelas novas e criou20 environments sintéticos; preservação de dados, migração, reaplicação e rollback aprovados. Recursos temporários removidos; nenhum engine na cópia, nenhuma rede, nenhum volume da origem montado.

Primeiro ensaio da fixture20 falhou por UUID obrigatório de account não informado; fixture corrigida e repetição completa aprovada. A tentativa falha continua como evidência privada, sem ser contada como aceite. Os testes não comprovam migração completa de Rancher/IdP, autenticação ou workloads no destino. OBS02 teve falha nativa confirmada73 e segue como próxima correção.
