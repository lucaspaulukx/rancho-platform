# 76 — Backup completo e ensaio de recuperação isolado

Próximo gate REL02/REL01: complementar o dump72 com estado criptográfico Rancher, dados do IdP dedicado e configuração/imagens identificadas. Um dump do banco não comprova recuperação completa.

## Contrato e limites

Primeiro suporte: composição local, Rancher1.6.30 com MySQL5.5 interno, volumes Docker locais e Keycloak26 dedicado com H2. MySQL externo/HA, volumes remotos e IdP compartilhado devem ser detectados e bloqueados neste automatismo, com orientação explícita. Nenhum ensaio pode atingir agentes, webhooks ou provedores reais.

1. Planejar/validar somente leitura: containers selecionados, imagem imutável, mounts, writers compartilhados, engines, integridade e espaço. Preparar helpers antes da janela.
2. Backup frio somente por opção explícita: interromper os serviços selecionados, preservar os estados anteriores e voltar a iniciá-los no finally. Nunca parar serviços de outros projetos nem iniciar baseline compartilhado. Sem prune ou remoção de volumes de origem.
3. Capturar volumes/configuração em arquivos criptografados e autenticados. Não escrever tar/SQL/configuração privada em plaintext no host ou em logs Docker dos helpers. Usar logs estruturados de etapas, hashes e status.
4. Restaurar somente em volumes novos com labels próprias. Verificar autenticação criptográfica antes de extrair; validar conteúdo/ownership/modos e integridade do banco. Remoções exigem labels exatas e IDs gerados pela própria execução.
5. Subir cópias do engine/IdP somente em namespace sem rede externa, sem portas publicadas, socket Docker ou mounts de origem. Helpers compartilham apenas esse namespace isolado para conferir HTTP local. Documentar qualquer alteração de endpoint feita exclusivamente na cópia.
6. Provar login, inventário e grants; para cenário original, usar cópia sintética com20 environments e schema original. Testar atualização com imagem alvo, novos usuários sem acesso, e rollback por restauração de banco/estado/imagem correspondentes.
7. Restaurar política/containers da origem, limpar somente recursos próprios e atualizar roadmap/evidências/Git. Falhas de retomada ou cleanup devem permanecer visíveis e impedir aceite.

## Critérios

Testes de criptografia/tamper/limites, ownership/isolamento, erro e retomada da origem. Ensaio real de volumes e recuperação de autenticação, não apenas checksums. Nenhum claim de migração universal ou garantia de ausência de falha. A liberação de cutover continua condicionada aos demais gates48.

## Implementação aceita — arquivos, 05/11/2026

`python -m migration.recovery plan` faz inspeção somente leitura e CHECK TABLE QUICK. Não altera schema nem para serviços; checksums/health podem gerar carga e locks de leitura. Exige três containers distintos com volumes locais reconhecidos, sem outro container ativo compartilhando armazenamento. Recusa configuração externa de banco/driver, bind gravável e mounts desconhecidos; não é detector universal de personalizações externas.

Preparar dependências antes da janela:

```sh
python -m pip install -r migration/requirements.txt
docker pull node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f
python -m migration.recovery plan
python -m migration.recovery backup --output migration-runs/cold-001 --quiesce
python -m migration.recovery rehearse-files --output migration-runs/cold-001
```

Senha solicitada sem eco, mínimo20 caracteres, ou variável privada `RANCHER_MIGRATION_BACKUP_PASSWORD`. Guardar em cofre independente do bundle; não colocar em comandos, Compose versionado ou Git. A CLI permite selecionar nomes com `--rancher`, `--keycloak`, `--console`. Diretório de backup deve ser novo. A flag `--quiesce` é obrigatória: interrompe console, Rancher/MySQL e Keycloak, captura friamente e retoma em ordem inversa os mesmos IDs previamente ativos. O finally também tenta retomar se um stop falhar após produzir efeito. Operador confirma saúde HTTP/login; sucesso do comando start não comprova aplicação pronta.

Cinco volumes reais passaram no laboratório: estado Rancher, datadir MySQL, logs MySQL (volume anônimo criado pela imagem), dados Keycloak/H2 e cache da console. Arquivos bind somente leitura ficam dentro dos metadados criptografados, limitados a1MiB por arquivo. Inspect completo/configuração contêm segredos e nunca são impressos nem gravados abertamente. Arquivos de volume usam tar GNU com ACL/xattrs/IDs numéricos e criptografia AES256-GCM+scrypt em streaming; todos os helpers usam `--log-driver none`, evitando plaintext em logs Docker, rede none e nenhum socket/porta/volume de origem gravável.

Antes de restaurar, autentica **todos** os arquivos e seus hashes vinculados aos metadados. Somente depois cria volumes aleatórios com label própria. Compara SHA256 de cada arquivo, symlinks, caminhos, UID/GID e modos antes de permitir uso. ACL/xattrs são preservados pelo tar, mas ainda não têm comparação independente nesta bateria. Recusa arquivos especiais. Remove somente volumes cuja label continua correta. Não inicia engines; `engineRecoveryAccepted` e `completeMigrationAccepted` permanecemfalse.

Evidência:29 testes Python (17 anteriores +7 criptografia +5 recuperação), backup frio e restauração real dos5 volumes, metadados autenticados, cleanup e preservação dos IDs originais. As duas primeiras tentativas de preflight recusaram um default herdado da imagem (`CATTLE_DB_CATTLE_DATABASE=mysql`); corrigido sem interromper serviços. Senha aleatória do ensaio descartada: esses artefatos de teste não são backups operacionais reutilizáveis. Journal JSONL registra etapas/status/tamanhos sem payload, nomes privados, tokens ou configuração.

Limites ainda abertos: imagens não estão incluídas no bundle (reter os IDs locais e distribuir imagem exata antes de desastre); teste de credenciais/grants e estado criptográfico com engines recuperados; comparação independente ACL/xattrs; capacidade exata e recuperação de host/daemon. Checagem mínima de1GiB livre na saída não estima o tamanho real: reservar capacidade pelo tamanho dos volumes e imagens. Cada arquivo comprimido tem limite de10GiB, metadados64MiB; arquivos maiores exigem estratégia própria. Proteger permissões/ACL do diretório de saída no sistema operacional e manter cópia independente. Não disponibiliza cutover automático.
