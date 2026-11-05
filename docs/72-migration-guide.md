# 72 — Migração assistida de Rancher1.6.30 Docker/Cattle

Estado: ferramenta inicial de diagnóstico, backup criptografado do banco e ensaio offline. **Ainda não é um instalador de migração completo nem autorização para cutover de produção.** Banco saudável e ensaio aprovado reduzem risco; não garantem ausência de falhas. Os gates de estado Rancher/IdP, login na cópia, operação de hosts e release continuam separados no roadmap48.

## 1. Inventário e preparação

Registrar versão/imagem/digest exatos do Rancher, MySQL interno ou externo, porta/URL pública, TLS, volumes, configuração, políticas de acesso, certificados/chaves, IdP e dependências. Guardar a composição original e suas variáveis em cofre privado, sem incorporar segredos nos relatórios. Confirmar o contexto Docker e espaço para backup + duas cópias + margem. Nomear responsável e critérios de rollback.

Ferramenta atual: Python3.10+, Docker CLI e dependência de `migration/requirements.txt`. O ensaio automático suporta o MySQL5.5 interno da imagem Rancher1.6.30, tabelas InnoDB e dump até256MiB. MySQL externo/mais recente, dumps maiores e orquestradores fora de Docker/Cattle exigem procedimento específico; não são aceitos silenciosamente. Windows: usar diretório privado com ACL restrita ao operador; chmod não substitui ACL do Windows.

```sh
python -m venv .venv
# Ative o ambiente virtual conforme o seu sistema.
python -m pip install -r migration/requirements.txt
python -m unittest migration.test_tool -v
```

## 2. Diagnóstico somente leitura

Substitua `rancher-server` pelo container de banco correto. Não passar senha como argumento. O padrão é cliente MySQL root local sem senha, compatível com o laboratório. Para outra configuração, use `--defaults-file /run/private/mysql-client.cnf`, um arquivo já existente DENTRO do container e protegido pelo operador. A ferramenta não cria esse arquivo na origem.

```sh
python -m migration.tool preflight --source-container rancher-server --output migration-runs/preflight-001 --check-tables
```

O diretório deve ser novo. São consultados versão, schemas, engines, contagens e checksums de todas as tabelas; `--check-tables` adiciona `CHECK TABLE QUICK`. Não há `REPAIR`, alteração de grant ou escrita de configuração. Leituras extensas e CHECK TABLE podem consumir I/O e obter locks de leitura: execute em janela adequada. Corrupção, tabelas ausentes, checksums indisponíveis e identificadores inesperados bloqueiam a sequência.

`preflight.json` contém contagens e resultados, sem nomes de clientes, conteúdo de registros ou segredos. Contagens/checksums da origem são observações sequenciais, não um snapshot único. Alterações concorrentes podem produzir diferença legítima; para confronto exato, usar janela sem escrita.

## 3. Backup anterior a qualquer alteração

```sh
python -m migration.tool backup-db --source-container rancher-server --output migration-runs/backup-001
```

A senha do backup é solicitada sem eco; mínimo20 caracteres. Guarde-a em cofre separado. Automação pode fornecer `RANCHER_MIGRATION_BACKUP_PASSWORD` pelo mecanismo privado de segredos, nunca em comando, arquivo público ou log. Não use a senha do Rancher como senha do backup.

O dump usa `--single-transaction --routines --events --triggers --hex-blob`; todas as tabelas devem ser InnoDB e não deve haver DDL concorrente. O dump fica somente em memória, com limite256MiB. O arquivo `cattle.sql.enc` usa AES-256-GCM com chave derivada por scrypt e salt/nonce aleatórios. `backup.json` registra versão, imagem, tamanho e hashes. A ferramenta autentica o backup inteiro antes de executar qualquer SQL na restauração.

**Este comando cobre apenas o banco.** Antes de cutover também são obrigatórios:

- Backup consistente de `/var/lib/cattle`, incluindo estado criptográfico, com o procedimento adequado ao armazenamento e a aplicação quiescente.
- Backup do IdP: banco/realm/chaves/configuração conforme a topologia; export de realm isolado não substitui backup completo do provedor.
- Compose/manifests, parâmetros, certificados e imagens anteriores identificados por digest.
- Cópia dos backups em armazenamento protegido independente do host e teste de leitura/recuperação pelo operador. Ter uma senha esquecida torna o backup inutilizável.

Não arquivar diretamente um datadir MySQL ativo para chamá-lo de backup consistente. Não usar `docker commit` como substituto de backup dos volumes.

## 4. Ensaio offline antes do cutover

Complemento76: `python -m migration.recovery plan|backup|rehearse-files` cobre backup frio criptografado dos volumes/configuração Rancher/MySQL/Keycloak e comparação de arquivos em destinos próprios. Requer manutenção explícita e não inicia engines nem comprova login recuperado; consulte os limites e a sequência em [76](76-complete-recovery-plan.md). Não substitui o dump lógico abaixo nem libera cutover.

```sh
python -m migration.tool rehearse-db --output migration-runs/backup-001
```

O comando não aceita conexão de origem. Ele verifica hashes/autenticidade, cria um volume próprio e inicia somente MySQL, com `--network none`, eventos SQL desligados, sem portas, mounts da origem, socket Docker ou engine Rancher. Restaura duas vezes e compara inventário/checksums; aplica a migração aditiva versionada, verifica preservação dos dados e reaplicação idempotente; restaura o backup novamente para comprovar rollback.

Cada recurso temporário recebe um identificador aleatório e label de propriedade. Cleanup confere essa label antes de remover. Nunca há prune global. Relatórios `rehearsal-*.json`, `operation-*.json` e `failure-*.json` são novos, com status explícito e sem stdout/stderr privado do banco. Se falhar, corrigir a causa e repetir com novo diretório/backup; não editar um relatório para liberar a migração.

`sourceObservationMatchedDump=false` pode indicar escrita concorrente entre diagnóstico e dump. O teste de restauração usa o próprio snapshot autenticado como referência; isso não torna a origem quiescente. `completeMigrationAccepted` permanecefalse até os demais gates.

## 5. Acessos e compatibilidade

As associações diretas existentes não são apagadas. Gerar um diff explícito para eventual conversão em grupos, testar com20 environments sintéticos e comprovar que nenhum acesso foi ampliado/perdido. Novos usuários devem começar sem acesso e sem environment automático. Antes de OIDC exclusivo, comprovar administrador OIDC e caminho de recuperação em cópia isolada.

Testar versão exata de agentes/Docker, stacks/Compose, rede/LB/TLS/volumes, logs/terminal e chaves técnicas. Uma cópia do engine com banco real pode tentar controlar hosts ou enviar webhooks; ela deve permanecer isolada e ter endpoints externos neutralizados **na cópia**, com evidência dessa neutralização, antes de iniciar o engine. O ensaio automático atual evita esse risco ao não iniciar o engine.

## 6. Cutover e rollback — gate ainda fechado

1. Aprovar os gates REL01–06, incluindo backup completo/restore de estado e IdP, smoke de login/grants e instalação reproduzível.
2. Abrir janela, bloquear alterações, parar o engine anterior e gerar o backup final consistente. Confirmar que somente um engine poderá acessar a base.
3. Aplicar o pacote identificado por commit/digest, configurações/flags revisadas e migração validada. Não ativar módulos experimentais por conveniência.
4. Verificar login local/OIDC conforme política, administrador, usuário sem acesso, usuário readonly, inventário e operações de workloads autorizadas.
5. Se houver divergência de acesso/dados, falha de login, erro crítico ou prazo excedido: parar o novo engine, restaurar banco **e estado correspondentes** e iniciar a imagem/configuração anterior. Nunca fazer downgrade de binário contra uma base alterada sem compatibilidade comprovada.
6. Preservar logs sanitizados, decisão e horários; confirmar ambiente estável e acesso administrativo após rollback. O roteiro automatizado de cutover somente será liberado após esse teste completo.

## Evidência e limites atuais

O laboratório comprova recuperação offline e esquema aditivo; o ensaio sintético original com20 environments não substitui dump real. Dados reais permanecem fora deste desenvolvimento até autorização própria. O histórico de alterações fica em commits locais; publicação e canal privado de segurança serão configurados antes de abrir o repositório.

## Atualização de engine em cópia original20

O [recorte77](77-runtime-schema-migration.md) agora comprova imagem oficial1.6.30→custom usando os mesmos volumes da cópia, migração runtime sob flag, restart, checksum divergente recusado e rollback por restauração correspondente com20 environments sintéticos. É evidência adicional ao banco72 e recuperação76, com isolamento de rede e cleanup. Não substitui ensaio do ambiente real, agentes/workloads/HA ou liberação do cutover. A origem do laboratório não teve a nova flag ativada por este teste.
