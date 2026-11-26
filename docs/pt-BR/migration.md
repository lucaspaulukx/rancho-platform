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

## Restauração automática no primeiro início

Prepare as [imagens modernas do backend e da Console](release.md#instalação-experimental-de-nó-único). Use um projeto Compose novo com volumes de destino vazios. Crie `.env.rancho-migration` e um arquivo privado com a frase secreta usada no backup selado. Faça o backup em uma janela sem escritas e mantenha o ambiente original disponível para rollback.

```dotenv
RANCHO_DB_PASSWORD=<unique-target-database-password>
RANCHO_MIGRATION_BACKUP_DIRECTORY=<absolute-path-to-backup-001>
RANCHO_MIGRATION_PASSPHRASE_FILE=<absolute-path-to-private-passphrase-file>
RANCHO_CONSOLE_PORT=18090
```

Execute os três comandos a seguir na raiz do repositório. Troque o nome do container de origem pelo da sua instalação. Se já tiver um backup selado, comece pelo comando Compose. Em uma instalação que usa autenticação local, mantenha no backup uma conta de administrador local funcional, já que o ensaio desliga o OIDC externo.

```sh
python -m migration.tool preflight --source-container rancher-server --output migration-runs/preflight-001 --check-tables
python -m migration.tool backup-db --source-container rancher-server --output migration-runs/backup-001 --include-server-identity
docker compose -p rancho-rehearsal --env-file .env.rancho-migration -f compose.modern.yaml -f compose.migrate.yaml up -d --build --wait
```

O Compose inicia o MariaDB, executa a imagem de restauração e só inicia o backend após a importação bem-sucedida. A imagem autentica o backup, importa o SQL, confere o inventário e instala a identidade criptografada do servidor quando presente. O backend aplica o schema versionado automaticamente. Acesse `http://localhost:18090/console/`. Se o Rancher de origem tinha autenticação, use a credencial local original. Repita o mesmo comando Compose para verificar que a importação foi pulada. O log registra `already-applied`. Para consultá-lo, use o mesmo projeto e arquivos Compose com `logs restore-backup`. O importador confere a identidade do backup em marcadores nos dois volumes. Um backup diferente ou um destino parcialmente importado exige projeto e volumes novos. Preserve os logs da falha e o backup original. O perfil isolado desliga OIDC, execução de catálogo e eventos do banco. Atualização do Docker dos hosts, cópia de volumes de workload e rede de produção exigem procedimentos próprios.

[Veja as capturas e os resultados do ensaio de migração](migration-evidence.md).

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

Forneça senha de backup separada, mínimo20 caracteres, pelo prompt sem eco ou secret privado `RANCHER_MIGRATION_BACKUP_PASSWORD`. Guarde-a separada do backup. O dump lógico usa single-transaction/routines/events/triggers/hex-blob; todas as tabelas precisam ser InnoDB e não pode haver DDL concorrente. SQL plaintext fica em memória limitada. `cattle.sql.enc` usa AES-256-GCM com scrypt e salt e nonce aleatórios. O selo separado `backup.json.enc` usa AES-GCM para autenticar os bytes exatos do `backup.json` legível, incluindo o ID da imagem de origem, as observações, o tamanho e os hashes do dump. Mantenha os três arquivos juntos e verifique-os com a mesma senha.

Backup de banco não basta. Capture também estado criptográfico Rancher consistente, dados/configuração/chaves completos do IdP dedicado, compose/manifests, certificados e imagens imutáveis correspondentes. Mantenha cópias protegidas fora do host e teste recuperação. Não chame arquivo de datadir MySQL ativo de backup consistente nem substitua volumes por `docker commit`. Veja [recuperação](recovery.md).

Para repetir a validação automatizada usando apenas recursos descartáveis, prepare as imagens locais do guia de release e compile a imagem de restauração. O teste também verifica que outro backup selado é rejeitado no mesmo banco já preenchido.

```sh
docker build -f migration/Dockerfile.restore -t rancho-migration-restore:local .
python -m migration.test_first_start_lab
```

## Ensaio offline

```sh
python -m migration.tool rehearse-db --output migration-runs/backup-001
```

O comando não conecta à origem. Autentica o bundle e inicia apenas cópia MySQL própria, network none, eventos SQL desligados, sem portas publicadas, mounts da origem, socket Docker ou engine Rancher. Restaura duas vezes, compara inventário/checksums, aplica migração aditiva versionada, verifica preservação/idempotência e restaura o backup novamente para provar rollback.

A ferramenta verifica o selo do manifesto e o dump antes de criar recursos no Docker. Para um backup antigo sem selo, use `--trusted-legacy-metadata-sha256` apenas com o SHA-256 dos bytes originais do `backup.json`, obtido de um registro independente e confiável. Calcular um novo hash do arquivo recebido não comprova sua procedência. Se o hash confiável não estiver disponível, gere um novo backup da origem confiável.

Recursos temporários têm identidades aleatórias e labels conferidas antes do cleanup. Não há prune global. Relatórios novos de operação/ensaio/falha excluem saída bruta do banco. Corrija a causa e repita com novo backup/diretório; não edite relatório para aprovar. Divergência entre observação da origem e dump pode refletir concorrência e não torna a origem quiescente.

## Hosts existentes e versões do Docker

Restaurar o servidor, atualizar o agente Rancher e atualizar o Docker Engine são três operações separadas. A restauração do banco recupera o cadastro dos hosts. O container do agente, seu estado local e o Docker Engine continuam em cada VM. Se o Rancher restaurado usar a mesma URL acessível, TLS confiável e credenciais e estado correspondentes entre servidor e agente, o agente existente pode tentar reconectar com a mesma identidade de host. Confirme isso em uma cópia isolada. Um host no inventário restaurado confirma o cadastro no banco. Confira se o agente está conectado e se as operações funcionam.

| Plano | O que a beta comprova |
|---|---|
| Restaurar o servidor e consultar o inventário | O Docker das VMs de workload pode ficar como está. O servidor e a console sobem sem hosts de workload. |
| Manter o Docker Engine, o agente e os serviços de sistema Cattle existentes | Ensaie essa combinação primeiro. O Rancher 1.6.30 listava o Docker 19.03 entre as versões suportadas. Um agente legado reconectou no Docker 19.03.15 e executou o reinício de um workload no ensaio abaixo. A cobertura completa de workloads Cattle nesses engines segue em aberto. |
| Usar o agente e as imagens de sistema recompilados | VMs novas Linux amd64 com Docker Engine **29.9.2**, kernel Ubuntu **6.8** e **cgroups v2** passaram em registro, rede gerenciada, IPsec e DNS de serviço. O reinício e a reconexão também foram testados com o agente persistente já modernizado. O ensaio abaixo cobre a atualização com dados persistentes em um host. A mistura de gerações no mesmo environment segue sem validação. |

A imagem de bootstrap moderna inclui o **CLI** do Docker fixado em 29.9.2. Alguns componentes recompilados do agente e da rede usam a API Docker **1.40**. Confira a seção **Server** de `docker version` em cada host. O intervalo de APIs aceito pelo daemon precisa incluir a 1.40. Isso confirma apenas a compatibilidade de API para essas chamadas. Por exemplo, o Docker 19.03 anuncia a API 1.40 e o Docker 18.09 anuncia até a 1.39. O daemon Docker 29.9.2 testado rejeitou as chamadas do agente legado pela API 1.22. Confira a versão exata do engine e o intervalo de APIs antes de escolher a substituição. [Matriz de APIs do Docker Engine](https://docs.docker.com/reference/api/engine/) · [Notas do Rancher 1.6.30](https://forums.suse.com/t/rancher-release-v1-6-30/17359)

1. **Inventarie cada host.** Registre `docker version`, o ID da imagem do agente em execução (`docker inspect --format '{{.Image}}' rancher-agent`, usando o nome real do container), a URL do servidor e a confiança TLS, o mount de estado do agente e as imagens de sistema Cattle em uso. Preserve a configuração e as referências de imagem originais.
2. **Ensaie primeiro a migração do servidor com o software atual do host.** Use cópias do servidor e de um host representativo em uma rede isolada da produção. Preserve as definições das stacks de infraestrutura existentes e deixe o override do catálogo moderno fora desse ensaio. Confirme a mesma identidade do host, reconexão do agente, ciclo de vida dos workloads, logs e terminal, volumes e, quando aplicável, rede e DNS entre hosts. Repita as verificações após reiniciar o agente. Se algum teste falhar, use o procedimento de rollback abaixo.
3. **Planeje a atualização do Docker separadamente.** A atualização do pacote é uma operação explícita em cada VM, feita pelo gerenciador de pacotes do sistema ou pela automação do operador, em janela de manutenção. O instalador do Rancho não altera esse pacote. Use um host descartável novo e um environment Cattle novo para validar o agente e o catálogo modernos antes de planejar a migração dos workloads. Mantenha o host original disponível para rollback. Uma mudança de tag não substitui o container do agente em execução. Agentes existentes e o contêiner principal IPsec exigem ensaio próprio de atualização e rollback antes de uma substituição no mesmo ambiente.

### Ensaio com volume persistente

Em uma VM Linux amd64 descartável no QEMU, o Rancher 1.6.30 registrou o agente original 1.2.11 no Docker Engine 19.03.15. Um serviço gravou dados em um volume local nomeado. Os dados foram lidos e tiveram o checksum calculado antes da atualização.

1. Restaure o banco e a identidade correspondente do servidor Rancher no mesmo endpoint. No ensaio, o backend do Rancho com MariaDB preservou o host, a stack e o serviço originais. O agente existente reconectou no Docker 19.03.15 e um reinício solicitado pela API foi concluído.
2. Faça backup da VM cliente e do armazenamento persistente antes de trocar o engine. O ensaio passou para Docker Engine 29.9.2 com o mesmo `/var/lib/docker`, `overlay2` e cgroups v1. A primeira inicialização falhou porque o BuildKit rejeitou os metadados do cache antigo. Na VM descartável, o diretório do cache antigo foi preservado fora do diretório de dados do Docker antes de tentar novamente. Preserve ou migre o cache de build separadamente se ele for importante para o host. Mantenha o armazenamento de imagens e o driver de storage consistentes durante essa troca. [Drivers de armazenamento do Docker](https://docs.docker.com/engine/storage/drivers/select-storage-driver/)
3. Carregue a imagem moderna do agente com a tag canônica `rancher/agent:v1.2.11` antes de chamar o comando `upgrade` do agente no host existente. Guarde a imagem original com outra tag para recuperação. O Docker 29 rejeitou o agente antigo pela API 1.22. O container moderno tentou voltar para a imagem original enquanto ela ainda estava na tag canônica. Após corrigir a tag, o agente moderno reutilizou as credenciais e o estado existentes e reconectou como o mesmo host. A atualização dispensou um novo token de registro.
4. Valide o host e o serviço no Rancho, o container efetivamente em execução no Docker e o checksum dos dados. O container existente voltou com o mesmo ID do Docker e o mesmo checksum no volume. Ao removê-lo explicitamente na VM descartável, o Rancher criou outro container automaticamente. O substituto leu os mesmos dados do volume nomeado.

### Rollback a frio da VM e do banco

Um ensaio isolado desligou a VM com Docker 19 e capturou o disco inteiro junto com o banco Cattle e a identidade do servidor correspondentes. Em uma cópia, o Docker 29.9.2 preservou o ID do container original. O workload precisou ser iniciado explicitamente após a atualização do Engine. Depois disso, retornou o checksum original do volume e respondeu a um reinício solicitado pela API do Rancher.

A restauração do disco anterior e do banco correspondente no endereço original do servidor recuperou o Docker 19.03.15, o agente original e os mesmos IDs de host, serviço e container. O workload passou pelo reinício solicitado pela API e pela conferência do checksum original do volume. O marcador no disco e o registro no banco criados após a captura estavam ausentes depois da restauração. O ensaio usou binários estáticos, cgroups v1, `overlay2`, um workload no modo de rede host e um volume local. Atualização por gerenciador de pacotes, armazenamento compartilhado e redes gerenciadas ainda exigem ensaios próprios. Capture tanto o disco da VM quanto o estado do Rancher antes de alterar um ambiente existente.

### Redes IPsec existentes

Em um laboratório separado com dois hosts, a stack IPsec existente transportou tráfego HTTP entre dois workloads no Docker 29.9.2 antes da atualização. A primeira solicitação de upgrade nativo incluiu o sidekick do roteador e a configuração primária inalterada. O Cattle atribuiu uma nova versão de configuração ao holder e tentou substituí-lo no primeiro host. O substituto ficou sem iniciar. O tráfego entre hosts voltou após a inicialização manual do holder e dos sidekicks originais, enquanto o serviço ainda informava `rolling-back`. Um ensaio seguinte enviou apenas a configuração secundária modificada. Em um serviço com escala zero, o upgrade parcial e o rollback preservaram as versões das configurações do container primário e do outro sidekick. O ensaio com dois hosts usou as imagens atestadas do backend e do roteador do commit `cf49b7c` e confirmou tráfego HTTP e atividade XFRM antes da troca. Os dois holders continuavam em execução quando o primeiro roteador novo passou para `starting`. O serviço ficou em `upgrading` durante a janela do teste, que encerrou antes do rollback físico.

Uma nova execução do mesmo upgrade restrito ao roteador chegou a `upgraded` nos dois hosts e voltou a `active` com o roteador original após o rollback. Os dois holders mantiveram seus IDs de container Docker e a versão da configuração primária. Os workloads mantiveram seus IDs de container e trocaram HTTP após as duas transições, com pacotes registrados pelo XFRM nos dois hosts. A interrupção da execução anterior deixa a repetibilidade em aberto. As imagens do holder e do CNI permaneceram nas versões originais neste ensaio.

Outro ensaio em dois hosts usou o upgrade nativo para mover o scheduler original para a rede bridge do Docker. Depois de verificar upgrade, rollback e confirmação definitiva do roteador, o teste atualizou e reverteu o holder e o verificador de conectividade em conjunto. Em seguida, atualizou e reverteu o serviço separado do driver CNI. O tráfego HTTP entre hosts e os contadores XFRM passaram após cada transição. Os workloads mantiveram seus IDs Docker, IPs gerenciados e contagens de inicialização. Esse ensaio verificou o tráfego após cada transição. Disponibilidade contínua, estado final com todos os componentes modernos e ambientes com outras revisões do catálogo exigem validação própria. Use o procedimento de environment separado abaixo para adotar o catálogo moderno completo.

#### Troca de tráfego para um environment separado

Um ensaio com quatro VMs manteve online o environment com o catálogo original e um environment novo com o catálogo moderno. Cada um tinha dois hosts com Docker 29.9.2. Em cada environment, um cliente gerenciado acessou um workload HTTP no outro host, e os roteadores registraram pacotes IPsec. Um único endpoint privado do Nginx encaminhou tráfego aos workloads modernos, voltou aos originais e depois retornou aos modernos. Cada troca entregou a resposta do environment esperado em até três segundos após recarregar o Nginx. Esse tempo descreve as requisições sintéticas nessa topologia.

1. Suba o environment de destino em hosts separados com o catálogo moderno. Mantenha em execução o environment original e seus serviços IPsec.
2. Recrie a stack da aplicação no destino. Restaure o estado persistente separadamente e valide gravações, descoberta de serviços, tráfego entre hosts e verificações de saúde antes de direcionar clientes. Para dados em NFS compartilhado, use o [procedimento de recuperação de armazenamento](recovery.md#ensaio-com-armazenamento-nfs-compartilhado).
3. Troque o destino no ingress durante a janela de mudança. Confira as respostas pelo mesmo endpoint dos clientes e monitore erros da aplicação e as duas redes. Mantenha a configuração de ingress anterior disponível até encerrar a janela de rollback.
4. Se a validação falhar, aponte o ingress para o environment original e verifique pelo mesmo endpoint dos clientes. Se o destino já aceitou gravações, reconcilie os dados antes de devolver tráfego a um ambiente original com escrita habilitada.

O teste usou um workload HTTP sem estado e a recarga controlada do ingress. Migração de workloads com estado, propagação de DNS e metas de disponibilidade exigem verificações específicas da aplicação.

## Identidade, engine e gates de cutover

Preserve grants diretos até [migração de acesso](access-migration.md) explícita. Teste novo usuário sem acesso, readonly/member, administração local/OIDC e recuperação antes do login exclusivo. Confira versões exatas de agente/Docker, Compose, rede/LB/TLS/storage, logs/terminal e credenciais técnicas.

Engine restaurado pode controlar hosts originais ou enviar webhooks. Isole a cópia e neutralize endpoints externos somente nela antes do startup. Ensaio apenas de DB não inicia engine; recuperação de engine é procedimento separado. Cobertura sintética de upgrade/rollback com20 environments não substitui ensaio específico da instalação.

Cutover produtivo continua condicionado ao [roadmap](roadmap.md): aprovar recuperação/release completos, bloquear escritas, parar engine anterior, obter backup final consistente e usar imagem/configuração/schema validados. Confira identidade, acesso efetivo, inventário e operações autorizadas. Nunca execute dois engines sobre a mesma base.

Se houver divergência de acesso/dados, falha de login, erro crítico ou prazo excedido, pare o novo engine, restaure banco/estado/configuração correspondentes e inicie a imagem anterior. Não faça downgrade contra banco alterado sem compatibilidade comprovada. Guarde logs sanitizados de horários/decisão e confira acesso administrativo/estabilidade após recuperar. As ferramentas não automatizam nem autorizam esse cutover final.
