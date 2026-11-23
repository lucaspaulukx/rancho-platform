# Backup e recuperação isolada

<!-- rancho-language-navigation:start -->
[Português (Brasil)](recovery.md) | [English](../en/recovery.md)
<!-- rancho-language-navigation:end -->


## Fronteira suportada

A automação de recuperação fria cobre compose local com Rancher1.6.30/MySQL5.5 interno, volumes Docker locais e Keycloak26/H2 dedicado. Rejeita banco/storage externos não suportados, binds graváveis, mounts desconhecidos e writers ativos compartilhados. Não descobre universalmente toda customização. IdP compartilhado, HA e volumes remotos exigem outro procedimento validado.

Selecione explicitamente os três containers distintos se os nomes diferirem. `plan` é somente leitura, mas saúde/checksum do banco pode gerar I/O/locks. Prepare ferramentas/imagens e espaço antes da manutenção.

```sh
python -m pip install -r migration/requirements.txt
docker pull node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f
python -m migration.recovery plan --rancher rancher-server --keycloak keycloak-server --console rancho-console
python -m migration.recovery backup --rancher rancher-server --keycloak keycloak-server --console rancho-console --output migration-runs/cold-001 --quiesce --include-images
python -m migration.recovery rehearse-files --output migration-runs/cold-001 --load-images
python -m migration.engines --output migration-runs/cold-001
```

Nomes são exemplos a substituir, não ordem para parar serviços alheios com nomes parecidos. Use diretório novo. A senha é pedida sem eco, mínimo20 caracteres, ou fornecida privadamente em `RANCHER_MIGRATION_BACKUP_PASSWORD`. Guarde-a fora do bundle.

## Captura fria e retomada

`--quiesce` é obrigatório no backup: para somente os serviços selecionados/suportados, captura dados frios e tenta retomar os mesmos IDs previamente ativos em ordem inversa, inclusive após parada parcial. Não inicia baseline compartilhado nem remove volumes da origem. Comando start aprovado não prova HTTP/login; confira a recuperação dos serviços.

Arquivos de volume/configuração usam criptografia autenticada. O tar preserva IDs numéricos, modos, ACLs/xattrs; comparação independente de ACL/xattr continua pendente. Binds de configuração readonly ficam nos metadados criptografados, até1MiB por arquivo. Helpers não usam rede de aplicação, mounts graváveis da origem, socket Docker ou logs Docker em plaintext. Journals contêm etapas/status/tamanhos, não inspect/configuração privada ou payloads.

`--include-images` exporta IDs imutáveis das imagens selecionadas/helper antes da parada, autenticando `images.tar.enc` pelos metadados. Limite do arquivo de imagens20GiB. Estimativa de imagens mais margem não prevê exatamente todos os volumes/operações concorrentes. `--load-images` permite explicitamente carregar imagens ausentes do bundle; sem essa opção nada é importado. Tags não garantem identidade.

## Ensaio de arquivos

Autentique todos os arquivos/hashes vinculados antes de alocar destinos. Restaure somente em volumes novos, aleatórios e próprios. Compare hashes, caminhos, symlinks, UID/GID e modos; rejeite arquivos especiais. Cleanup confere ownership exato antes da remoção. Não há prune global ou remoção de volumes de origem.

Recuperação de arquivos não inicia engines nem comprova login. Configuração criptografada e imagens correspondentes são necessárias; export isolado de realm não recupera o IdP completo. Retenha cópia protegida fora do host e confira se o operador consegue descriptografá-la.

## Ensaio de engine e identidade

`migration.engines` inicia cópias restauradas Rancher/IdP em um namespace loopback-only, sem egress externo, portas publicadas, storage da origem ou socket Docker. Helpers usam somente esse namespace. Ajustes de hostname/IP/callback devem ficar na cópia; não mude a origem para aprovar o ensaio.

Forneça credenciais administrativas restauradas por prompts sem eco ou variáveis privadas `RANCHER_RECOVERY_ADMIN_PASSWORD` e `RANCHER_RECOVERY_IDP_PASSWORD`. Overrides de usuário: `RANCHER_RECOVERY_ADMIN_USERNAME` e `RANCHER_RECOVERY_IDP_USERNAME`. Não há fallback automático de login na origem. Engines exigem imagens imutáveis locais; prepare as ausentes pelo ensaio de arquivos.

Valide inventário/grants restaurados, login Rancher/IdP, descoberta/callback/ticket OIDC, novo usuário sem acesso, criação de environment negada e revogação de sessões. Upgrade original→custom sintético/rollback e retorno de workloads são aceites separados de restaurar o mesmo artefato. `engineRecoveryAccepted` identifica somente o recorte medido; `completeMigrationAccepted` segue false até todos os gates de release.

## Rollback e limites

Recupere banco, estado criptográfico Rancher, IdP e imagem/configuração correspondentes. Pare o engine novo antes de restaurar o conjunto anterior. Não execute engines antigo/novo sobre storage compartilhado nem suponha que desligar schema desfaz DDL. Preserve resultados sanitizados de erro/cleanup/retomada e trate recuperação falha como gate reprovado. Veja [migração](migration.md), [migração de acesso](access-migration.md) e [roadmap](roadmap.md).
