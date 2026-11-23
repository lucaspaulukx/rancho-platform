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

## Compose moderno com MariaDB

O serviço atual do backend chama-se `rancho`, gerando `rancho-modern-rancho-1` com o nome padrão do projeto. O CLI de recuperação prioriza `--rancho` e continua aceitando `--rancher`; backups do nome anterior do serviço permanecem legíveis. Preserve o mesmo nome de projeto Compose e os volumes nomeados na atualização. Pare o projeto Compose antigo com `docker compose -f compose.modern.yaml down` antes de trocar a revisão e então inicie a nova revisão. Nunca acrescente `--volumes` ou `-v` a esse comando. Faça e verifique um backup antes. O novo backend também mantém o alias DNS interno anterior para imagens do Console já compiladas.

Para o `compose.modern.yaml`, selecione os contêineres Rancho, console e MariaDB 10.11 do mesmo projeto Compose. Use os nomes exibidos por `docker compose ps`. A captura começa após a parada limpa da console e do Rancho e registra o inventário e os checksums das permissões antes de parar o MariaDB. O backup criptografa e autentica os três volumes locais nomeados. Na retomada, aguarda o MariaDB ficar saudável antes de iniciar os demais contêineres. Confira a console e os hosts de origem após a janela.

```sh
python -m migration.recovery plan --rancho rancho-modern-rancho-1 --console rancho-modern-console-1 --database rancho-modern-db-1
python -m migration.recovery backup --rancho rancho-modern-rancho-1 --console rancho-modern-console-1 --database rancho-modern-db-1 --output migration-runs/modern-cold-001 --quiesce --include-images
python -m migration.recovery rehearse-modern --output migration-runs/modern-cold-001 --admin-user admin --load-images
```

Antes do backup, verifique se há um administrador local disponível. O ensaio pede a senha desse administrador separadamente da senha do backup. Restaura em novos volumes, inicia as imagens registradas em uma bridge isolada do Docker 29 sem portas publicadas e valida a integridade do MariaDB, as contagens do inventário e os checksums de todas as tabelas Cattle antes de iniciar o Rancho. Em seguida, verifica o login do administrador local e a visibilidade dos environments pela console. A cópia isolada desativa o OIDC e a execução do catálogo. Faça backups próprios do catálogo, das montagens personalizadas, do armazenamento dos workloads e da configuração e dos dados do provedor de identidade. Planeje e teste a recuperação deles antes da troca.

## Captura fria e retomada

`--quiesce` é obrigatório no backup: para somente os serviços selecionados/suportados, captura dados frios e tenta retomar os mesmos IDs previamente ativos em ordem inversa, inclusive após parada parcial. Não inicia baseline compartilhado nem remove volumes da origem. Comando start aprovado não prova HTTP/login; confira a recuperação dos serviços.

Arquivos de volume/configuração usam criptografia autenticada. O tar preserva IDs numéricos, modos, ACLs/xattrs; comparação independente de ACL/xattr continua pendente. Binds de configuração readonly ficam nos metadados criptografados, até1MiB por arquivo. Helpers não usam rede de aplicação, mounts graváveis da origem, socket Docker ou logs Docker em plaintext. Journals contêm etapas/status/tamanhos, não inspect/configuração privada ou payloads.

`--include-images` exporta IDs imutáveis das imagens selecionadas/helper antes da parada, autenticando `images.tar.enc` pelos metadados. Limite do arquivo de imagens20GiB. Estimativa de imagens mais margem não prevê exatamente todos os volumes/operações concorrentes. `--load-images` permite explicitamente carregar imagens ausentes do bundle; sem essa opção nada é importado. Tags não garantem identidade.

## Ensaio de arquivos

Autentique todos os arquivos/hashes vinculados antes de alocar destinos. Restaure somente em volumes novos, aleatórios e próprios. Compare hashes, caminhos, symlinks, UID/GID e modos; rejeite arquivos especiais. Cleanup confere ownership exato antes da remoção. Não há prune global ou remoção de volumes de origem.

Recuperação de arquivos não inicia engines nem comprova login. Configuração criptografada e imagens correspondentes são necessárias; export isolado de realm não recupera o IdP completo. Retenha cópia protegida fora do host e confira se o operador consegue descriptografá-la.

Use o ensaio de workload com volume nomeado para verificar se um serviço novo consegue iniciar e ler os dados recuperados de outro volume. O teste cria um workload sintético, para a escrita de forma limpa, criptografa o volume original e o restaura em um volume novo. O workload confere o checksum ao iniciar. A ferramenta compara hashes de arquivos, IDs de proprietário, permissões e destinos de links simbólicos, confirma que o volume original está intacto e remove os recursos temporários. Carregue as imagens fixadas do Rancher original e do Node usadas acima e a imagem local `alpine:3.20`. O ensaio roda diretamente no Docker com a rede desabilitada. A recuperação pelo scheduler do Rancher e os drivers de volume compartilhado exigem testes próprios.

```sh
python -m migration.test_workload_volume_recovery_lab
```


Um ensaio separado em uma VM Linux isolada usou Docker 29.9.2 e o agente moderno do Rancher. Depois de desativar o serviço no Cattle e confirmar no Docker que nenhum container escrevia no volume, o ensaio autenticou e descriptografou o backup do volume local. O Cattle criou outro container para o mesmo serviço. Ele leu os dados restaurados com o checksum, proprietário, permissões e link simbólico originais. O retorno aos dados originais do volume, seguido de reativação do serviço, passou pelas mesmas verificações. O ensaio usou um serviço no modo de rede host e um volume local do Docker. Consulte o [ensaio de rollback a frio da VM e do banco](migration.md#rollback-a-frio-da-vm-e-do-banco). Drivers de volumes compartilhados ainda exigem teste de recuperação próprio.

## Ensaio com armazenamento NFS compartilhado

Dois hosts isolados com Docker 29.9.2 montaram a mesma exportação NFSv3 com o driver local de volumes do Docker. Um workload Cattle gravou na exportação pelo primeiro host, e um workload somente leitura no segundo host verificou os dados e os metadados. Depois de parar os dois workloads e confirmar que nenhum container em execução usava o volume, o ensaio arquivou a exportação no servidor de armazenamento e autenticou o arquivo criptografado. Um novo workload Cattle no segundo host leu os dados de uma exportação restaurada separada. O checksum, os IDs numéricos de proprietário, as permissões e o destino do link simbólico coincidiram. Um workload no primeiro host confirmou que a exportação original continuava legível.

Para uma instalação existente, inventarie a exportação, as opções de montagem e todos os workloads que gravam antes de capturar um backup. Pare todas as gravações, use o procedimento de backup do sistema de armazenamento e restaure em uma exportação separada. Inicie um workload somente leitura em outro host para conferir os dados e o proprietário antes de direcionar tráfego ou habilitar gravações. Preserve a exportação original para rollback e inclua no plano de recuperação os dados gravados após a troca. A recuperação automática do Rancho cobre volumes locais sem opções de driver. Ela recusa NFS e outras montagens remotas, cujo backup e restauração ficam a cargo do operador.

## Ensaio de engine e identidade

`migration.engines` inicia cópias restauradas Rancher/IdP em um namespace loopback-only, sem egress externo, portas publicadas, storage da origem ou socket Docker. Helpers usam somente esse namespace. Ajustes de hostname/IP/callback devem ficar na cópia; não mude a origem para aprovar o ensaio.

Forneça credenciais administrativas restauradas por prompts sem eco ou variáveis privadas `RANCHER_RECOVERY_ADMIN_PASSWORD` e `RANCHER_RECOVERY_IDP_PASSWORD`. Overrides de usuário: `RANCHER_RECOVERY_ADMIN_USERNAME` e `RANCHER_RECOVERY_IDP_USERNAME`. Não há fallback automático de login na origem. Engines exigem imagens imutáveis locais; prepare as ausentes pelo ensaio de arquivos.

Valide inventário/grants restaurados, login Rancher/IdP, descoberta/callback/ticket OIDC, novo usuário sem acesso, criação de environment negada e revogação de sessões. Upgrade original→custom sintético/rollback e retorno de workloads são aceites separados de restaurar o mesmo artefato. `engineRecoveryAccepted` identifica somente o recorte medido; `completeMigrationAccepted` segue false até todos os gates de release.

O laboratório sintético indicado pode testar o modo híbrido e o OIDC exclusivo em duas cópias independentes do mesmo backup. Execute durante uma janela de manutenção local. A origem é interrompida brevemente para captura a frio e reinicia com a configuração anterior. O controle híbrido aceita a senha do administrador local. A cópia exclusiva anuncia entrada automática, recusa essa senha e conclui o fluxo real de código de autorização no Keycloak. As duas cópias validam o banco restaurado. A navegação automática no navegador tem teste de aceite próprio.

```sh
python -m migration.test_engine_recovery_lab --quiesce --backend-image rancho-backend:candidate --exclusive-oidc
```

## Rollback e limites

Recupere banco, estado criptográfico Rancher, IdP e imagem/configuração correspondentes. Pare o engine novo antes de restaurar o conjunto anterior. Não execute engines antigo/novo sobre storage compartilhado nem suponha que desligar schema desfaz DDL. Preserve resultados sanitizados de erro/cleanup/retomada e trate recuperação falha como gate reprovado. Veja [migração](migration.md), [migração de acesso](access-migration.md) e [roadmap](roadmap.md).
