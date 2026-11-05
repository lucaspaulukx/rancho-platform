# 77 — Versionamento de schema no startup e atualização de engine

Plano REL01, antes da implementação: manter a migração001 em uma única fonte SQL, embutida no artefato, com checksum igual ao ensaio offline72. Nova flag independente `RANCHER_SCHEMA_MIGRATIONS_ENABLED`, defaultfalse e dependente da customização. Off preserva o bootstrap legado de tabelas; não remove dados nem desfaz DDL. Downgrade seguro exige backup/restauração correspondente.

On: lock nomeado MySQL por base para serializar inicializadores, detectar versão futura/checksum divergente, aplicar somente DDL aditiva/idempotente, verificar estrutura e registrar versão apenas ao terminar. DDL MySQL5.5 auto-commit: interrupção pode deixar tabelas parciais, deve permitir repetição sem registrar sucesso prematuro. Nunca renomear/dropar tabelas nem converter grants automaticamente.

Critérios de teste: configuração on/off/dependência/inválida; compilação Java; SQL embarcado e checksum iguais ao Python; instalação original sintética20envs; restart idempotente; corrupção do checksum recusada sem alteração; grants nativos preservados; engine anterior e posterior com volumes só da cópia, sem egress/portas/source storage. Rollback por restauração de estado/banco correspondentes, sem executar binário anterior contra dados incompatíveis. Toda fixture precisa cleanup de ownership, origem preservada e evidência sanitizada.

Status inicial: plano. Recuperação do mesmo artefato76 passou; isso não substitui atualização original→custom nem aceita este gate.

## Implementação e evidência — 05/11/2026

`CommunitySchemaMigrations` usa a001 do pacote, SHA256 com LF normalizado, GET_LOCK por base e versão, DDL aditiva e validação de colunas/tipos/tamanhos/nullability/engine/índices inclusive da própria tabela de versões. Só registra versão após a verificação. Não migra associação de identidade nem grants. `LocalGroupStore` escolhe esse fluxo sob a nova flag; off conserva seu caminho anterior. Compose base expõe a variável com defaultfalse; moderno não a força. Sobre apresenta a capacidade como informação booleana, sem controle de alteração de banco.

138 asserts de configuração em64 combinações,12 readiness,31 logout e10 writer passaram no artefato novo.36 testes de migração/crypto/recuperação/imagens +4 bootstrap passaram. Frontend605/71 + TypeScript/Vite passou após incluir o rótulo da capacidade.

### JDBC com MySQL5.5 real, sem engine

`python -m migration.test_runtime_schema_lab` usa dump autenticado somente leitura da origem e cria banco novo, sem egress/portas/storage da origem; apenas tests bind readonly. Nove gates aprovados:

1. Schema original20envs→001, mesmo checksum Python/Java, todos os checksums das tabelas anteriores preservados e reaplicação com o mesmo timestamp.
2. Checksum adulterado recusado sem reescrever metadata.
3. Versão futura recusada.
4. Coluna incompatível recusada.
5. Índice unique ausente recusado.
6. Estrutura inválida da tabela de versões recusada antes de registrar sucesso.
7. DDL parcial retomada idempotentemente.
8. Dois inicializadores concorrentes serializados, uma versão gravada.
9. Restore do snapshot original20 desfaz a migração e recupera todos os checksums, sem downgrade destrutivo.

As primeiras tentativas do harness falharam porque o driver embarcado é MariaDB1.5.8 (`org.mariadb.jdbc.Driver`), não o nome do driver MySQL. Corrigido no contrato; nenhuma escrita na origem e fixtures anteriores limpas. Não contam como aceite.

### Upgrade e rollback de engine

`python -m migration.test_original_engine_lab --quiesce` captura friamente apenas o laboratório selecionado e o retoma. Autentica backup, restaura volumes próprios e transforma **somente a cópia** em schema original com20 environments, retirando as tabelas customizadas. Não representa um dump real nem preservação de grupos de uma origem já customizada — essa recuperação é o recorte76.

A imagem oficial1.6.30 por digest inicia primeiro com schema original e comprova admin/inventário20. Ela é parada antes de criar o engine customizado com os **mesmos volumes da cópia**. Customizado com schema flagtrue passa15 checks de login/OIDC/PKCE/zero acesso, inventário e checksums de grants nativos. Reinício conserva versão/checksum/timestamp; corrupção proposital do checksum na cópia impede startup. Depois todas as cópias são removidas e o backup correspondente é restaurado em volumes novos; a imagem original inicia com20envs e sem tabelas customizadas. Não executa rollback simplesmente desligando a flag contra dados alterados.

O ensaio completo foi repetido após reforçar validação da tabela de versões. Original/custom/restart/falha fechada/rollback e limpeza aprovados; IDs e HTTP dos três serviços de origem preservados. Engines sempre no namespace loopback-only, sem egress, portas publicadas ou storage de origem. Origem segue no artefato anterior; flag nova não foi habilitada silenciosamente no laboratório.

### Pacote limpo

Encontrado defeito de distribuição: a regra genérica `*.sql` excluía a001, embora testes locais a encontrassem. Corrigida com exceção exclusiva `migration/sql/*.sql`; o SQL agora faz parte do Git e Dockerfile o embute no jar. Backups/dumps seguem ignorados. Outra falha de validação em checkout profundo no Windows deixou29 arquivos oficiais ausentes por limite de caminho; helper Git agora aplica `core.longpaths=true` por chamada, sem configuração global. Não houve descarte de código de trabalho: só arquivos oficiais ausentes foram restaurados na cópia descartável.

`python scripts/validate_clean_backend.py --reuse-local-upstream` exporta apenas o índice Git para diretório novo e usa os objetos oficiais locais como origem do clone, através de configuração Git restrita ao processo. Aplica e confere o patch fixado, verifica presença do SQL/ausência de .env/realm privado e compila o backend. Sem a opção, clona a URL oficial. Build limpo aprovado; não depende de SQL/capturas/credenciais soltas no worktree.

Limites: MySQL5.5 interno, instância local, base sintética20 e IdP dedicado do laboratório. Não cobre providers externos, HA, todos os agentes/workloads, migração de identidades LDAP/github para OIDC ou conversão de acessos diretos em grupos. Esses gates permanecem48. Instalação fresca do pacote completo, testes operacionais e aceite unificado ainda não estão fechados. Este recorte não habilita cutover de produção.
