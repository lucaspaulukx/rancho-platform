# 88 — Upgrade contextual de limites de processo

Plano de05/11/2026, antes da implementação; complementa87. Nenhum aceite de upgrade é inferido da criação.

## Contrato e experiência

Ulimits é imutável no container original: a edição de um serviço usa o serviceUpgrade nativo, preservando imagem/configuração/sidecars e substituindo instâncias conforme a estratégia revisada. Não expor PUT impossível para um container avulso. Usar o editor87 no drawer atual, com checkbox explícito de inclusão nesta atualização e revisão compartilhada.

Flag aditiva modules.workloadUlimitUpgrades=false quando ausente, independente da criação. A flag é revalidada no submit e na ação. Reconsultar schema ulimit, launchConfig, serviço e upgrade; snapshot completo before/fresh bloqueia alterações concorrentes antes do POST, sem alegar CAS atômico no servidor. Nenhum valor é enviado quando a edição não está selecionada. Arrays vazios só representam reset depois de comprovação nativa; não converter dado legado desconhecido em vazio.

Metadado nativo type=ulimit pode ser removido explicitamente da projeção editável; outras propriedades/formatos desconhecidos bloqueiam edição para não haver perda silenciosa. Limites mantêm inteiro de32 bits, nomes conhecidos, unicidade e relação soft/hard de87. Rejeitar no-op e conservar rascunho após erro de schema/conflito. Configuração de sidecars só muda por seu editor específico.

## Tasks e gates

1. Projeção editável, validação e payload nativo com testes de flags, snapshot concorrente, valores legados, limites, no-op, preservação de sidecars/configuração e reset.
2. Checkbox/editor/revisão no drawer compartilhado; contrato off sem operação nova, keyboard/dirty state e revalidação de permissões.
3. Linux unitários/TypeScript/Vite; serviço próprio escala0 para upgrade, rollback, finish e reset persistidos, sem instâncias inesperadas.
4. Fixture física própria confirma novos limites em Docker/processo; rollback/finish/reset e preservação de dados, controle de acesso e cleanup. Alocação90s com desvio temporário85 é evidência separada de estabilidade CNI nativa. Não ampliar timeouts nem tocar workloads anteriores.
5. Documentar limites, atualizar roadmap e PR da entrega. Manter flag pública off até os gates respectivos; demais opções de recursos/dispositivos e multi-host continuam separados.

## Implementação e gates intermediários

Flag workloadUlimitUpgrades, ausente=false, independente da criação87. Drawer usa checkbox explícito/editor/revisão; o submit e ResourcePanel validam flag e contratos atuais, incluindo schema ulimit. Payload troca somente os limites primários selecionados e preserva demais campos/sidecars; snapshot completo e no-op são verificados. Projeção editável remove apenas o discriminator nativo type=ulimit; outras propriedades incompatíveis permanecem visíveis e bloqueiam envio.

Sete testes novos de domínio/componente e regressões passaram; gate Linux654 testes/75 arquivos + TypeScript/Vite aprovado. Browser real em serviço próprio escala0 passou10 checks: flag off, revisão antes do POST, upgrade, rollback, finish, reset vazio persistido, contexto/zero JS e apenas três upgrades. Cleanup e sessão de controle removidos, sem instâncias físicas. Relatório local ignorado: console/ulimit-upgrade-results.json. Negação de upgrade após retirada de grant está sendo acrescentada a esse harness e requer repetição; não está incluída nesse primeiro aceite.

Tentativas intermediárias do harness corrigiram Accept application/json e slash final das actions nativas. Espera de menu passa a20s para cobrir o polling15s do inventário; prazo de transição nativa45s não foi ampliado. Falhas ficaram arquivadas e suas fixtures foram limpas.

Prova física nativa é separada do teste de UI: cria serviço próprio com uma réplica, mede herança, upgrade, rollback, finish e reset no Docker/processo. Relay diagnóstico admite janela menor de30–120s (default120 preservado; ensaio88 usa45s), com remoção antes de cada inspect. Contador de pongs cobre min(75, janela-5)s, não alegar75s em janela45s. Primeira tentativa detectou binário diagnóstico ainda fixo em120s; falhou antes de criar workload e limpou a fixture. Rebuild do helper com intervalo restrito está em ensaio; isso não altera scheduler/CNI do produto.

A janela experimental45s passou herança/primeiro upgrade, mas foi recusada no rollback por um pong timeout no intervalo observado, apesar de a instância física iniciar e a limpeza passar. Não é aceite de rollback físico. A janela curta mistura a conexão anterior do scheduler com a nova rota; foi retirada do helper e do binário, voltando ao contrato fixo120s de85 e à observação final75s. O prazo de alocação nativa continua90s e nenhum timeout de produto mudou. A repetição física usa o contrato diagnóstico anterior, sem afrouxar os critérios.

## Aceite do recorte — 05/11/2026

Browser repetido passou10 checks com serviço próprio escala0, mais negação real de upgrade após retirada de grant. Identidade, sessão e fixture limpas; noPhysicalInstancesScheduled/revokedIdentityUpgradeDenied/identityFixtureCleaned/controlSessionRevoked=true em console/ulimit-upgrade-results.json. Nenhum schema, descriptor ou dado nativo foi substituído; só a flag do contexto de teste.

`python console/tests/physical_ulimit_upgrades.py` passou as cinco fases físicas com janela fixa120s: herança inicial, upgrade1024/2048, rollback, novo upgrade e finish, reset vazio e finish. Cada fase removeu regra/arquivos antes do inspect, confirmou relay sem falhas/zero pongs nos75s finais, e manteve prazo90s para alocação. Upgrade e finish confirmaram nofile1024/2048 no Docker/processo; rollback/reset recuperaram HostConfig sem limites explícitos e processo1000000/1000000, iguais à herança medida no próprio daemon. Não universalizar esse default para outros hosts.

Seis checks físicos passaram com imagem, ambiente e escala preservados; cleanup comparou hashes das configurações anteriores e conjuntos de containers/volumes, removeu a stack própria e revogou a sessão de controle. Relatório local ignorado: console/physical-ulimit-upgrade-results.json, status passed/cleanupComplete/controlSessionRevoked=true. A janela curta foi revertida em código; o helper/binary distribuídos voltam ao contrato anterior120s.

Aceite restrito a serviço Docker Linux/nofile/um host, com UI em escala0 e efeitos nativos físicos separados. Não comprova tráfego, throughput, demais rlimits, alteração física de sidecars, CNI nativo ou multi-host. Flag pública workloadUlimitUpgrades permanece off por padrão. OPS11 inteiro continua aberto.
