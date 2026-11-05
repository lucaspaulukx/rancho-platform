# Migração a partir do Rancher 1.6

<!-- rancho-language-navigation:start -->
[Português (Brasil)](migration.md) | [English](../en/migration.md)
<!-- rancho-language-navigation:end -->


## Ensaio suportado e pré-requisitos

As ferramentas oferecem diagnóstico, backup criptografado e ensaios isolados, não instalador universal ou aprovação de cutover produtivo. Banco saudável e ensaio aprovado reduzem risco; não garantem sucesso em toda instalação.

Inventarie imagem/digest Rancher exatos, topologia/versão MySQL, URL pública/TLS, mounts, estado criptográfico, IdP, política de acesso, agentes e integrações externas. Proteja composição/configuração originais e imagens anteriores independentemente. Confira contexto Docker, espaço para backup mais duas cópias e margem, operador responsável e critérios de rollback.

A automação de banco suporta MySQL5.5 interno do Rancher1.6.30, tabelas InnoDB e dumps até256MiB. MySQL externo/mais recente, dumps maiores e outros orquestradores precisam de procedimento validado separado. Exige Python3.10+, Docker CLI e dependências de migração. No Windows, use diretório privado com ACL restrita; chmod não substitui ACL.

```sh
python -m venv .venv
python -m pip install -r migration/requirements.txt
python -m unittest migration.test_tool -v
```

Ative o ambiente virtual com o comando apropriado à plataforma antes de instalar dependências.

## Diagnóstico somente leitura

Substitua `rancher-server` pelo container de banco correto. O cliente MySQL padrão usa root local sem senha, adequado apenas a configurações locais compatíveis. Nos demais casos, use `--defaults-file /run/private/mysql-client.cnf`, arquivo protegido já existente dentro do container. A ferramenta não o cria na origem; não coloque senhas nos argumentos.

```sh
python -m migration.tool preflight --source-container rancher-server --output migration-runs/preflight-001 --check-tables
```

O diretório de saída deve ser novo. O diagnóstico lê versão, schemas, engines, contagens e checksums; `--check-tables` acrescenta `CHECK TABLE QUICK`. Não faz repair, alteração de grants ou configuração. Leituras podem consumir I/O e obter locks; escolha uma janela adequada. Corrupção, tabelas ausentes, checksums indisponíveis e identificadores inesperados bloqueiam continuidade.

Relatórios contêm contagens/resultados, não registros ou identidades de clientes. As observações são sequenciais, não snapshot transacional único; escritas concorrentes podem causar diferenças legítimas. Use janela sem escrita para comparação exata.

## Backup antes de alterações

```sh
python -m migration.tool backup-db --source-container rancher-server --output migration-runs/backup-001
```

Forneça senha de backup separada, mínimo20 caracteres, pelo prompt sem eco ou secret privado `RANCHER_MIGRATION_BACKUP_PASSWORD`. Guarde-a separada do backup. O dump lógico usa single-transaction/routines/events/triggers/hex-blob; todas as tabelas precisam ser InnoDB e não pode haver DDL concorrente. SQL plaintext fica em memória limitada. `cattle.sql.enc` usa AES-256-GCM com scrypt e salt/nonce aleatórios; metadados vinculam versão, imagem, tamanho e hashes. A autenticação é verificada antes de restaurar SQL.

Backup de banco não basta. Capture também estado criptográfico Rancher consistente, dados/configuração/chaves completos do IdP dedicado, compose/manifests, certificados e imagens imutáveis correspondentes. Mantenha cópias protegidas fora do host e teste recuperação. Não chame arquivo de datadir MySQL ativo de backup consistente nem substitua volumes por `docker commit`. Veja [recuperação](recovery.md).

## Ensaio offline

```sh
python -m migration.tool rehearse-db --output migration-runs/backup-001
```

O comando não conecta à origem. Autentica o bundle e inicia apenas cópia MySQL própria, network none, eventos SQL desligados, sem portas publicadas, mounts da origem, socket Docker ou engine Rancher. Restaura duas vezes, compara inventário/checksums, aplica migração aditiva versionada, verifica preservação/idempotência e restaura o backup novamente para provar rollback.

Recursos temporários têm identidades aleatórias e labels conferidas antes do cleanup. Não há prune global. Relatórios novos de operação/ensaio/falha excluem saída bruta do banco. Corrija a causa e repita com novo backup/diretório; não edite relatório para aprovar. Divergência entre observação da origem e dump pode refletir concorrência e não torna a origem quiescente.

## Identidade, engine e gates de cutover

Preserve grants diretos até [migração de acesso](access-migration.md) explícita. Teste novo usuário sem acesso, readonly/member, administração local/OIDC e recuperação antes do login exclusivo. Confira versões exatas de agente/Docker, Compose, rede/LB/TLS/storage, logs/terminal e credenciais técnicas.

Engine restaurado pode controlar hosts originais ou enviar webhooks. Isole a cópia e neutralize endpoints externos somente nela antes do startup. Ensaio apenas de DB não inicia engine; recuperação de engine é procedimento separado. Cobertura sintética de upgrade/rollback com20 environments não substitui ensaio específico da instalação.

Cutover produtivo continua condicionado ao [roadmap](roadmap.md): aprovar recuperação/release completos, bloquear escritas, parar engine anterior, obter backup final consistente e usar imagem/configuração/schema validados. Confira identidade, acesso efetivo, inventário e operações autorizadas. Nunca execute dois engines sobre a mesma base.

Se houver divergência de acesso/dados, falha de login, erro crítico ou prazo excedido, pare o novo engine, restaure banco/estado/configuração correspondentes e inicie a imagem anterior. Não faça downgrade contra banco alterado sem compatibilidade comprovada. Guarde logs sanitizados de horários/decisão e confira acesso administrativo/estabilidade após recuperar. As ferramentas não automatizam nem autorizam esse cutover final.
