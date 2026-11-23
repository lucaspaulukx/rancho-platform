## Checkpoint87 — limites de processo na criação (05/11/2026)

Nova flag opcional workloadUlimitEditors, ausente=false. Editor compartilhado de ulimits em container/launchConfig/sidecar, validação32bits/duplicatas/soft-hard e revalidação de schema antes do POST. Linux647 testes/74 arquivos + TypeScript/Vite passaram. Fixture real criou container pelo drawer: nofile1024/2048 confirmado na API, Docker e processo; identidade sem grant recebeu negação. Cleanup de recursos/identidade/sessão e desvio temporário completos, configurações/volumes anteriores preservados.

Aceite físico restrito a container avulso Linux/nofile/um host. Serviços/sidecars têm testes de contrato/componente, sem aceite físico equivalente ainda. Upgrade/reset/rollback são recorte88; OPS11, CNI nativo, multi-host e release continuam abertos. Ver87 para falhas preservadas e limites. Código sob flag off no pacote; não houve mudança no Ember/backend.

## Checkpoint86 — Rancho Platform e aceite83/84 (05/11/2026)

Destino Git autorizado: https://github.com/lucaspaulukx/rancho-platform, inicialmente vazio e privado. Preservar histórico comunitário; fluxo86 descreve commits por mudança e branches/PRs após importação. Conferência de21 commits/777 objetos não encontrou credenciais locais conhecidas, padrões configurados ou identidades aposentadas. Scanner não substitui auditoria completa.

83: lease320s/quatro transportes/três réplicas e teto30s aprovados com controles/cleanup; HTTP continuou200 no prazo do socket, distinguindo prazo da conexão de expiração da chave. Comparações off pessoal/compartilhada no mesmo artefato reproduziram falha legada, com limpeza completa. Runtime local API-key on/teto86400s; default distribuído false. Alocação usou relay temporário85, removido antes dos streams; estabilidade CNI nativa continua aberta.

84 implementou métricas contextuais por réplica, sem agregação inventada; Linux639 testes/73 arquivos + TypeScript/Vite passaram. Teste físico do menu real passou10 checks em três réplicas: CSV, seleção na mesma conexão, contraste claro/escuro, mobile e revogação1008 sem reconexão; quatro transportes com novos401/zero dados, controles e cleanup. Flag pública continua ausente/off, habilitável explicitamente pela configuração. Não declarar OPS13 completo: demais tipos/gráficos, escala e acessibilidade manual continuam no roadmap. Checkpoints seguintes são históricos; seus pendentes já resolvidos não prevalecem sobre este resumo.

## Checkpoint85 — diagnóstico de scheduler e estado83 (05/11/2026)

83 ampliou aceite para retirada de grant OIDC e conta local desativada com cookie antigo, nos3 transportes, com controles/cleanup. Longa4 transportes/3 réplicas falhou na alocação240s; não mede segurança. Harness passou a rastrear instâncias durante criação e preserva falhas. Runtime local está com API-key guard on para ensaios; default moderno dessa flag ainda false. Comparação off do mesmo artefato, prazo físico do socket, lote e lease longa seguem pendentes.

85 investiga o bloqueio: scheduler1037 running/healthy registrou11 pong timeouts/15min. Controle próprio com biblioteca pinada, Go1.27.3/1.9.7, rota global e ping vazio mediu6/6 sem timeout tanto host quanto guest em35s. Isso não reproduz o processo real nem prova correção/causa. Controle no namespace reproduziu falha; bridge padrão saudável, MSS1000 falhou. Relay temporário pelo gateway passou6/6 e ensaio de 3 réplicas em3.15s/zero timeout nos75s finais, com remoção exata da regra e cleanup. Próximo: reaproveitar só a preparação de alocação para teste longo83. Gate CNI nativo continua aberto. Helpers scripts/build_scheduler_probe.py e console/tests/scheduler_heartbeat.py, relatórios ignorados. Conferir manifesto scheduler-heartbeat antes de outros testes. Ver85; plano84 de métricas de serviço foi escrito, ainda sem implementação.

## Checkpoint83 — guarda de API keys em validação (05/11/2026)

Baseline pessoal/compartilhada confirmou streams válidos após desativação da chave. Implementação opcional false liga prova à credencial nativa realmente comparada, owner/scope/host/rota/role e teto configurável de socket30–86400s; marca agente separadamente, impede downgrade legado quando on e protege lotes/negociação. Java173 configuração/46 envelope/19 callback, Go upstream/novos/race, Linux628/72+TypeScript/Vite e build limpo aprovados.

Novo artefato passou desativação pessoal+compartilhada em3 transportes pelo18090 com HTTP401, novosWS401,1008/zero dados e controles/cleanup. Grupo OIDC está em execução; conta/cookie/lease/lote e off do mesmo artefato ainda pendentes. Flag moderna não ativada por default; runtime local on somente para ensaios. Ver83; não encerrar OBS02/RBAC05/48 por esse recorte parcial.

## Checkpoint82 — proteção de credenciais na auditoria (05/11/2026)

Baseline própria confirmou que readonly conseguia ler e reutilizar token admin de terminal pela auditoria do environment. Corrigidas gravação recursiva e projeção de registros novos/antigos, sob flag independente. Mesmo artefato on preservou capacidades legítimas e ator/ação/status, retirou tokens de novos registros no banco e protegeu2 antigos sem reescrevê-los; readonly sem acesso ao token, global404 e execute ausente. Revogação dos3 streams1008/novos401/zero dados, controles e cleanup aprovados.

Java155/129 (off/on/customização off), Linux628/72+TypeScript/Vite e build backend limpo aprovados. Compose moderno habilita redação por default substituível false; base continua false. Histórico/backups continuam sensíveis e rollback/off reexpõe valores anteriores; não houve saneamento destrutivo. Ver82 para limites e tentativas falhas preservadas. Próximo: contas técnicas/API keys em streams e demais gates48.

## Checkpoint81 — transporte de métricas e lease pelo proxy (05/11/2026)

Métricas grandes negociadas por primeiro frame, sem ampliar limite de URI; serviço próprio3 réplicas passou por18090 em4 transportes. Admin+seis casos locais/OIDC passaram revogação/controles; ensaio final320s e navegador8 checks confirmaram renovação, dados reais, envio único e fechamento1008/zero dados após revogação. Mesmo artefato off reproduziu falha legada, com relatório bruto failed preservado. Cleanup final completo, sem manifesto próprio pendente.

Linux628/72 + TypeScript/Vite, Java149/58/39, Go upstream/race e build limpo aprovados. Compose moderno e config pública habilitam transporte/guarda com override false; base Java/compose mantém false. Runtime efetivo conferido. Ver81 para hashes, evidências e limites. Interface agregada de serviço OPS13 não entregue pelo teste de transporte. Próximo: revisão de credenciais na auditoria, guarda de contas técnicas/API keys e demais gates48; estabilidade51/69, carga/HA/licenças/release continuam abertos. Checkpoints seguintes são históricos e suas contagens/flags anteriores não descrevem o estado atual.

## Checkpoint79 — matriz/lease e métricas de serviço (05/11/2026)

Admin+seis casos locais/OIDC (grant, desativação, expiração real45s) passaram em3 transportes: HTTP401/404, novosWS401,1008/zero dados após revogação e controles válidos; contas/grupos/sessões/settings limpos. Lease admin320s confirmou novos dados em logs/exec/métricas após prova300s e posterior revogação correta, sem alterar expiração global. Getter de métricas de serviço foi corrigido para assinar path completo; proxy valida lotes sem payload antes do upgrade. Build/testes Go/race passaram;4 transportes e serviço3 réplicas passaram direto no backend.

Proxy moderno real18090 com3 réplicas reproduziu414 no token agregado10524 chars; não marcar esse caso aceito. Primeira tentativa dizia proxy mas ainda usava18080: evidência inválida para proxy, preservada; harness agora confirma porta no evento ready. Comparação off no mesmo artefato256a2a53, através de18090, passou como baseline legado inseguro nos4 transportes, com cleanup/controles. Guarda de host deixada **off** no runtime e nos defaults até corrigir negociação de payload81; UI608/71 permanece servida.

Helper HTTP de testes conecta localhost por127.0.0.1 preservando URL/Host/cookies/redirect/timeouts;2 contratos e login real passaram. Medido ping Python2039ms→2ms, eliminando fallback IPv6 do Windows, sem mudar DNS/hosts/timeout do servidor nem o gate de instabilidade do scheduler. Keycloak helper aceita opener opcional; padrão de outros usuários não alterado. Próximo81: payload assinado no primeiro frame opt-in e teste de terminal ocioso pelo proxy; API keys/HA/carga seguem gates distintos.

## Checkpoint80 — inventário offline de artefatos (05/11/2026)

CLI plan/scan implementada com Syft1.56.0 por digest, archive pelo ID local, sem rede/socket/restart de apps e com cleanup verificado. Dez contratos e scan real repetido passaram;486 pacotes backend/73 console/209 lockfile+dev, com145/1/0 licenças não identificadas. Projeção CycloneDX exclui arquivos/env/config/metadados desconhecidos e liga hashes dos manifests congelados. Console declara Apache-2.0 nos manifests, coerente com LICENSE. Raw/temp removidos e IDs preservados. REL04 segue parcial: falta revisão de licenças, detecção completa de binários, CVEs/procedência/schema independente e demais gates48. Não converter inventário em aprovação legal/segurança. Matriz79 de seis identidades local/OIDC passou; renovação longa está em execução, ainda sem aceite.

## Checkpoint79 — primeiros controles físicos (05/11/2026)

Baseline off repetido com3 transportes saudáveis confirmou entrega indevida após logout (novosWS101, logs17/exec1/métricas23), fixture/sessões limpas e sem churn nessa repetição. Nova imagem com guarda on passou admin:9 tentativas de assinatura/prova compacta/caminho401, HTTP401 após revogação, novosWS401,3 sockets1008 e zero dados posteriores com3 controles válidos. Remoção de grant de usuário local via grupo member também passou com HTTP404 e os mesmos controles, conta/grupo próprios removidos. OIDC, desativação, expiração e renovação longa continuam em execução/pendentes; não é fechamento de OBS02 nem do roadmap.

A primeira tentativa on falhou fechada porque ApiRequestFilter usa a propriedade Archaius api.ignore.paths, não o parâmetro XML; servia indexHTML200 no callback. Corrigido o defaults.properties e prefixo sem slash final; matrix agora exige403JSON/no-store sem chave interna antes de criar fixtures. Remoções autônomas de scheduler e volumes-root associados são relatadas separadamente; preservação de serviços e containers/volumes de aplicação continua obrigatória. Baseline estrito anterior permanece falho, sem reescrever a evidência. Código/template de migração/DB não alterados por esta correção.

## Checkpoint79 — implementação em validação (05/11/2026)

Guarda opcional de logs/exec/métricas implementada em patches Cattle+proxy Go pinados; defaultfalse, prova compacta RS256, revalidação de sessão/conta/role/escopo, renovação privada e encerramento1008. Java143 configuração+26 regras+12 readiness+31 logout+10 writer; testes Go upstream/novos e race, frontend608/71+TypeScript e build Linux aprovados. Pacote limpo do índice clona/aplica/checka os dois upstreams e compila sem artefatos privados; testes Go não usam egress. Console nova publicada somente no laboratório. Backend de laboratório recebeu artefato novo com proteção off, sem alteração de schema. Matriz física on/off e identidades ainda em validação: primeiro off sofreu churn autônomo do scheduler1i956; guardar evidência e não afirmar aceite. OBS02, carga e demais gates48 permanecem abertos. Ver79 para detalhes/limites.

# Checkpoint — baseline de streams de host (05/11/2026)

Host legado1h1/UI-OPS-LAB ativo, Docker19.03.15/cgroupfs. Helpers repõem token existente em arquivo privado e revogam sessão própria. Baseline79 confirmou falha: HTTP401 após logout, novosWS101 e sockets abertos com logs17/exec1/métricas23 posteriores;3 controles saudáveis. Uma fixture própria removida, config/volumes preservados e manifesto ausente. Não é aceite OBS02: guarda Go/Java ainda não implementada. Oficial websocket-proxyv0.23.12/5b4d22 em migration-runs; compila e upstream tests passam com Go1.27.3-alpine@sha256:d200d2dd76b03a99b52651fd1325aff7dcd35422c35c01bac56571b0507f3deb, sem rede. Próximo: binding UI assinado + revalidação contínua/idle no proxy, defaultfalse e on/off real. SourceRancher ainda imagem antiga; demais VMs paradas, baseline parado, projeto alheio intocado.

# Checkpoint — grupos/cutover API original20 (05/11/2026)

Recorte78 API passou35 checks em cópia original20:3 users/5 bindings→2 grupos, matrix60 preservada em coexistência/cutover nativo/rollback, owner direto conservado, readonly405 e admin404 com controle positivo e zero criação proibida, revogação na sessão e revisão antiga409. Sessões/cópias limpas, origem IDs/HTTP preservados. Planner público segue readonly; harness não é apply de produção, precheck nativo não é CAS. Próximo: OBS02 logs/exec/métricas e demais gates48. Pesquisa preliminar fonte oficial websocket-proxy v0.23.12/5b4d22 no diretório ignorado migration-runs; nenhuma mudança nesse componente ainda.

# Checkpoint — plano de acessos diretos (05/11/2026)

Planner78 somente leitura/transaction consistente e plano AES-GCM:13 testes (grafo50×20), CLI real sem alteração da origem e fixture original20/3users/5grants→2grupos repetida3 restores aprovada. Fonte real tem só7 diretos adminglobais,0 propostas corretas. Nenhum apply/cutover disponível; Native setmembers exige owner direto, não remover o último no futuro. Próximo: grupos/API, matriz60 efetiva, cutover nativo/negação/revogação/rollback em cópia. Total53 testes Python no conjunto incluindo bootstrap; frontend605/71 e recorte77 permanecem. Roadmap48 ainda aberto.

# Checkpoint — schema runtime e upgrade original20 (05/11/2026)

Recorte77:9 JDBC reais e138 configuração/64 combinações;001 embarcada/versionada, flagfalse e checksum/lock/estrutura validados. Engine oficial original20→custom sobre mesmos volumes copiados passou login/OIDC/PKCE/zero acesso, restart idempotente, recusa de checksum inválido e rollback por snapshot original. Cleanup e origem IDs/HTTP preservados. SQL estava indevidamente ignorado: corrigido; helper Git trata caminhos longos e build limpo do índice+patch funciona sem artefatos privados. Frontend605/71 + TypeScript/Vite,40 testes Python e contratos Java12 readiness/31 logout/10 writer. Nova imagem validada em cópias; não habilitada na origem. Roadmap48 segue aberto; próximo RBAC03/grants e demais gates.

# Checkpoint — engines recuperados (05/11/2026)

Recuperação76 passou36 testes Python,5 volumes,4 imagens criptografadas e15 checks reais: admin Rancher/Keycloak restaurados, OIDC-PKCE, novo usuário sem acesso/environment, inventário7envs e checksums de grants preservados. Engines em namespace loopback sem egress/portas/storage da origem.3 containers/5 volumes próprios removidos; origem com IDs e HTTP preservados. Import de imagem scratch própria provou perda/recuperação sem remover imagens da aplicação. Ainda não é migração original20envs+upgrade/rollback de engine nem aceite integral48. Próximo: versionamento runtime de schema/migração de grants e gates operacionais abertos.

# Checkpoint — recuperação de arquivos (05/11/2026)

Backup frio76 passou nos5 volumes Rancher/MySQL/logs/Keycloak/cache e configuração criptografada. Restauração em volumes próprios comparou conteúdo, UID/GID e modos, cleanup e IDs de origem preservados.29 testes Python. Engines não iniciados nas cópias, senha do ensaio descartada; não é backup operacional nem aceite de migração. Próximo: engines/login isolados, imagens e demais gates48. Frontend605/71 não mudou.

# Checkpoint — logout federado e pacote comunitário

Frontend605 testes/71 arquivos + TypeScript/Vite em Docker. Logout62 aceito15 checks/4 fluxos reais/8 axe-layout: confirmação Keycloak, replay401, conta local conserva SSO, tela sem acesso e IdP parado em exclusivo/autologin. Política/cliente/provedor e fixtures restaurados; flag de logout defaultfalse. Contratos Java134 configuração +31 regras de logout +10 writer. Troca de tema atômica corrigiu baixo contraste transitório. Git contém commits incrementais, incluindo pacote limpo4c9e645 com595/70 no checkpoint anterior; schemas de teste sanitizados em src/test/fixtures. Ainda não é100%: roadmap48 aberto. Próximo: recuperação completa Rancher/IdP e migração72, além de streams logs/exec/métricas e demais gates.

# Checkpoint — 04/11/2026

Base comunitária74 e guia/ferramenta de migração72 entregues em recortes testados. Frontend595/70, TypeScript/Vite; Sobre8 + formulários4 axe/layout, rotas42. Migração17 testes +110 tabelas reais e fixture original20 environments offline: backup criptografado, integridade, restore, esquema aditivo/idempotência, rollback e cleanup aprovados. Nenhuma escrita na origem. OBS02/73 falhou nativamente: após revogar sessão, HTTP401 mas socket anterior entregou novo evento. Corrigir antes de considerar segurança de streams aceita. Roadmap48 permanece aberto; nenhuma liberação de produção.

# 08 — Situação real e próxima execução

## Checkpoint vigente — CPU/IO e upgrades contextuais (26/10/2026)

Build595 testes/70 arquivos + TypeScript/Vite implantado na console18090. Criacao64 aceita: dez checks visuais/oito cenarios claro/escuro x1440/390, criacao real pela interface (escala0/inativa/sem instancias), conta sem grant negada e cleanup preservando baseline. Fisico64 passou7 checks com reserva250/peso256 e7 sem reserva/peso512; HostConfig e cgroups conferiram CFS/quota/cpuset/IO. A reserva CPU prevalece sobre cpuShares no agente Cattle; ajuda corrigida a partir de evidencia real e fonte agent c8663d12. Nao confundir reserva/peso com quota. Configuracoes, containers e volumes anteriores preservados; manifestos64 ausentes.

Upgrade CPU/IO66 reutiliza drawer e workloadResourceUpgrades com opt-in separado da memoria. Cinco novos testes cobrem contrato/preservacao/conflito/reset/revisao/flag off. CPUset vazio e conservado explicitamente apos serializacao; nao e descartado silenciosamente. Navegador passou14 checks e quatro cenarios axe/layout: persistencia, rollback, finish, reset, contexto preservado, flag off e usuario sem grant negado. Fixture configuracao escala0 removida com baseline intacto. Fisico66 passou7 checks de upgrade/rollback/finish na mesma imagem: CFS/quota/cpuset/peso/IO conferidos em HostConfig e cgroups, memoria128MiB/readOnly/privileged preservados. Stack/container removidos, baseline preservado e manifesto ausente. Reset fisico/throughput ainda separados. Gate67 passou8 checks em repeticao pelo backend direto18080: host-label obrigatoria, fallback soft, erro nativo sem candidato, recuperacao, cleanup e restauracao das labels anteriores. Manifesto ausente. Primeira execucao teve limpeza interrompida por recriacao do proxy da console; recuperacao removeu somente stack/containers/chave proprios e preservou baseline. Nenhuma fixture mutavel permanece ativa. Probe69 concluido: seis pings/pongs tanto idle como durante reset70, RTT1.23–1.48ms e0.94–1.38ms, close1000, sessoes proprias revogadas; frames descartados sem salvar. Isso nao resolve o caminho Go/guest nem e soak. Reset fisico70 passou7 checks: defaults CFS/quota/cpuset/IO e minimo de shares conferidos, rollback/finish, memoria/seguranca preservadas e cleanup completo. Proximo gate OBS02: medir revogacao de uma sessao propria mantendo conexao aberta e publicando somente metadados de recurso descartavel; ainda nao executado, nao afirmar revogacao de streams. Nenhuma aprovacao pendente; sandbox autorizado.

Rascunhos68 aceitos: dois testes no SchemaForm e quatro fluxos reais servico/container x CPU/memoria passaram. Primeira entrada invalida marca dirty, cancelar descarte conserva texto e confirmar remove formulario; envio bloqueado, zero escrita de negocio/erro JS. Texto invalido fica apenas no rascunho em memoria, fora de caches/storage/API.

Sidecar63 aceito10 checks fisicos: criacao, upgrade, rollback, adicao/finish, remocao seletiva/finish e cleanup; rede/volume compartilhados reais. Manifesto ausente. Lento no guest; scheduler registrou8 pong timeouts/15min. Nao alterar heartbeat para mascarar; estabilidade/latencia51 permanece aberta. Interrupcao Docker255 anterior recuperada com stack propria removida e baseline preservado; so quatro servicos proprios retomados, rede/IPs estaveis e host original1h1 conservados. Baseline parado e outros projetos intocados.

Regressao65 passou42 checks (21 rotas x1440/390): Administracao/Integracoes inclusive, sem erro JS/asset/overflow; navegacao movel abre/fecha. Somente leitura/render, nao CRUD/paridade. AUTH04a61 passou27 reais e quatro cenarios axe com Keycloak parado/religado hibrido/exclusivo/automatico/callback invalido; contratos Java124/64 e12 cache. Preflight default true somente no compose moderno (override false/classico off). Logout federado62 segue pendente. Roadmap48 continua canonico; nao e100%.

### Checkpoints anteriores

## Checkpoint vigente — rede estável e aceites físicos (26/10/2026)

Frontend build577 testes/66 arquivos + TypeScript/Vite e formatação, implantado na console18090; smoke atual passou. Configuração versionada/CLI53, expiração real local+OIDC54, validação de dependências55 e sidecar físico56 entregues em recortes comprovados. Configuração:7 checks de navegador e9 CLI; expiração:6 de integração e6 de navegador, override/default restaurado, sem JWT salvo. Esses recortes não substituem a bateria unificada REL06.

Rede gerenciada51 passou7 checks (DNS/HTTP reais e isolamento); HTTP healthcheck/recreate52 passou6, com novo DockerID após falha controlada. Sidecar56 passou7: dois containers no host original, modo container apontando ao primário, volume e HTTP via loopback compartilhados; cleanup preservou configurações/containers/volumes. Falha inicial por modo de rede ausente foi arquivada, formulário passou a recusar referência sem networkMode=container sob flags existentes. Upgrade físico de sidecars continua pendente.

Reinício do Docker Desktop trocou novamente IPs; empacotamento57 fixa Rancher .4 e console .6 em rede externa dedicada validada. Executar python ensure-lab-network.py antes do primeiro up. Preflight passou8 checks em bridge temporária removida, preservando redes anteriores; restart somente do backend passou7 (sessão, grupos/environments, volumes, rede/IP e agente+seis serviços nativos). Baseline parado; nenhum projeto externo reiniciado. Instabilidade intermitente de pong observada anteriormente não é considerada resolvida apenas por estes recortes; evitar alegação de operação estável em produção.

Gate físico58 passou8 checks: upgrade/rollback de memória e reset/finish de capabilities/readOnly na mesma imagem. Stack/container próprios removidos e baseline preservado; manifesto removido. Referências de sidecars foram agrupadas nas seções Rede/Armazenamento;7 checks de navegador confirmam bloqueio antes de POST e correção do modo no mesmo formulário. Correção local59 rotacionou segredo OIDC exposto por leitura de diagnóstico e removeu valores fixos do realm de importação; readback local/OIDC/sem-acesso passou e segredo antigo é recusado. AUTH05/doc60 passou12 checks nativos e6 de navegador: administrador OIDC explícito no híbrido/exclusivo, login local recusado no exclusivo e recuperação híbrida comprovada. Conta/identidade temporárias e overlay removidos; baseline de contas/grupos/environments preservado. Próximos: OPS07 upgrades físicos/OPS08 afinidades e demais pendências do roadmap48. Ainda não é100%.

### Checkpoints anteriores

## Checkpoint vigente — configuração versionada e investigação física

Build575 testes/66 arquivos + TypeScript/Vite, formatação aprovada. Configuração schemaVersion1 validada; legado sem versão migra somente em memória com flags ausentes false. CLI reutiliza contrato e cria saída nova com SHA256 sem sobrescrever origem. Sete checks de navegador e nove CLI passaram. Doc53 e relatórios config-migration-*.json; CFG02 aceito neste recorte, banco/rollback de artefato/matriz completa de flags ainda separados.

Infra: seis serviços nativos active/healthy na precondição. Nova bateria de rede com orçamento padrão voltou a falhar em alocação; cleanup removeu serviços e conferência posterior encontrou zero containers temporários console-network. Scheduler ficou estável ocioso por mais de dez minutos, porém voltou a perder pong ao receber operações. API autenticada de dentro do scheduler respondeu HTTP200 em9ms, afastando indisponibilidade HTTP permanente; não prova ausência de problema no transporte/eventos. Alocação do servidor chegou a concluir após duas tentativas, cliente não concluiu no orçamento. Fonte oficial scheduler v0.8.6 obtida em references/rancher-scheduler, commit d9a8d0a5b624a47649df52c72e125f29d582f36f, somente leitura. Não houve alteração de timeout/serviços originais para mascarar falha. Observação adicional com orçamento480s em execução; atualizar resultado antes de fechar checkpoint. Healthcheck52 ainda não executado.

Próximo: corrigir operação/event stream, comprovar rede e seguir saúde/sidecars/afinidades e demais gates do roadmap48. Não declarar100%.

### Checkpoints anteriores

## Checkpoint vigente — infraestrutura recuperada; gate de rede ainda falha

Os seis serviços nativos passaram active/healthy após substituir instâncias com IP antigo. Teste físico de rede repetido passou precondição e persistência do vínculo, mas criação/alocação dos containers não concluiu; cleanup nativo removeu serviços próprios. Relatório physical-network-test-results.json registra falha atual, não usar resultado histórico como aceite deste build.

Scheduler estabelece conexão no endereço atual, mas logs sanitizados mostram websocket pong timeout e reconexões. Fonte event-subscriber usa MaxPongWait10s; causa ainda em diagnóstico, não aumentar limite sem demonstrar. Memória disponível do guest cerca780MiB. Doc51 e roadmap48 registram próximos passos. physical_healthcheck.py e plano52 adicionados para próximo gate, ainda sem execução/aceite. Fonte frontend permanece567 testes/65 arquivos; nenhum novo teste físico de saúde aprovado.

Próximo: corrigir heartbeat/alocação, repetir rede e então saúde/sidecars/afinidades físicos. Sem alterações em Ember/produção/volumes anteriores. Não declarar100% enquanto gates abertos.

### Checkpoints anteriores

## Checkpoint vigente — segurança contextual e reconexão da infraestrutura

Build567 testes/65 arquivos + TypeScript/Vite. workloadSecurityUpgrades=true após14 checks/quatro cenários axe-layout: capacidades/readOnly/privileged, preservar imagem/bindings/env/comando/rede/escala0/contexto, rollback/finish e reset arrays vazios/false comprovados. Fixture1st120/1s152 removida, configuração/volumes anteriores preservados; nenhum container agendado. Doc50. Smoke/Sobre atuais aprovados.

Preparação dos gates físicos encontrou metadata apontando ao IP Rancher antigo172.21.0.3:8080; atual172.21.0.4. Removidas nativamente apenas duas instâncias paradas antigas1i782/1i784 após validação de propriedade; definições dos serviços preservadas. Metadata reconciliou active/healthy com1i922/1i923 running; scheduler passou active/initializing. Healthcheck/IPsec ainda não saudáveis no último snapshot. Doc51 registra diagnóstico sem logs/env privados. Tentativa posterior de remoção do healthcheck abortou pela mudança de estado antes do POST. Não declarar recuperação completa.

Próximo passo roadmap48: concluir reconciliação da infra e testes físicos OPS06–08; demais gates continuam listados. Baseline compartilhado parado. Sem Ember/produção/push/release.

### Checkpoints anteriores

## Checkpoint vigente — roadmap mestre e upgrade de memória

Roadmap completo48 centraliza todos os domínios, estados, dependências e critérios de100%; prevalece sobre prioridades históricas. Execução sandbox sem novas confirmações. Ainda não é solução concluída.

Build566 testes/65 arquivos + TypeScript/Vite. Upgrade de memória49 habilitado: opt-in contextual com MemoryEditor, schema/snapshot completo, revisão, imagem igual, rollback/finish/reset explícito0.14 checks integrados/quatro cenários claro-escuro1440/390; demais configs/contexto/escala0 preservados; usuário sem environment negado. Fixture1st119/1s151 removida, configurações/volumes anteriores preservados e sem instâncias. Upgrade físico segue gate próprio.

Próxima execução: OPS10 upgrade de segurança e restante da ordem48. Flags novas não alteram configurações existentes; Ember/produção/publicação fora do escopo. Não declarar100% com gates abertos.

### Checkpoints anteriores

Roadmap completo e ordem de execução vigente: [Roadmap mestre](48-master-roadmap.md). Estado por entrega, gates restantes e critérios para100%; checkpoints abaixo preservam o histórico.

## Checkpoint vigente — 23/10/2026, capabilities e prova física de recursos

Build565 testes/65 arquivos + TypeScript/Vite. workloadSecurityEditors=true: capAdd/capDrop estruturados com opções atuais, linhas estáveis, validação recursiva/schema fresco e fallback JSON por flag.11 checks browser/oito cenários de tema/tamanho, persistência de readOnly true/privileged false/drop ALL/add NET_BIND_SERVICE em serviço inativo escala0,403 sem acesso. Fixture removida, configurações/volumes/containers anteriores preservados.

Container físico próprio no host1h1 confirmou HostConfig de memória128MiB/reserva64MiB, readonly true, privileged false, add NET_BIND_SERVICE/drop ALL. Coleta filtra somente campos selecionados. Primeira tentativa teve filtro JSON e cleanup incompleto; recuperado1i920 via stop/remove, repetição usa stop→stopped→remove→removed e confere baseline. Doc47 e physical-resource-security-results.json. Não prova OOM/multi-host/sidecars/upgrade nem todas as opções securityOpt/devices.

Smoke do build servido passou. Paridade total permanece pendente: upgrades de recursos/segurança, campos avançados/Compose, infraestrutura/streams/identidade e consolidação/restore/migração. Não declarar100%. Sem mudança Ember/produção/publicação. Baseline original compartilhado continua parado.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, memória legível na criação

Build559 testes/64 arquivos + TypeScript/Vite. workloadResourceEditors=true oferece Bytes/MiB/GiB para limite e reserva no formulário contextual, com conversão exata e validação recursiva antes do POST/schema fresco. Off retorna campo numérico genérico.11 checks browser/oito cenários axe/layout, serviço128MiB/reserva64MiB persistido inativo/escala0/sem instâncias e403 sem acesso. Cleanup confirmou configurações/containers/volumes anteriores preservados e manifesto removido. Doc46 e resources-*-results.json. Primeiro harness continha asserção residual de labels; limpeza e repetição completas passaram.

Este recorte não inclui upgrade nem aceite de limite físico/valores arbitrariamente grandes no backend legado. Sidecars recebem componente comum e validação recursiva, sem persistência específica. Segurança avançada, gates físicos, identidade/streams e consolidação/migração/recovery continuam pendentes; não declarar100%.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, fontes delegadas por environment

Build555 testes/63 arquivos + TypeScript/Vite. environmentCatalogDelegation=true oferece fontes a owner/member com relatório self completo e conta/environment exatos; revalida sessão e relatório antes de abrir dados privados/escrever. Falha/revogação no polling desabilita entrada e desmonta editor; erros sanitizados. Backend CATALOG_WRITE_GUARD_ENABLED permanece proteção independente.

22 checks browser de Member/Read Only via OIDC e oito cenários axe/layout, CRUD no RBAC-DEV sem alterar grants, fontes anteriores preservadas, readonly POST403/controles ausentes com delegação ativa. Oito testes de papéis/IDs/revogação/identidade/erro/admin/flags. Regressão do editor administrativo, smoke e Sobre repetidos. Doc45 e delegated-catalogs-*-results.json. Nenhum clone remoto/refresh global/stack; URL loopback fechada. Owner possui contrato nativo e unitários, sem nova sessão visual Owner.

Paridade total continua pendente, estimativa de planejamento cerca de70% Cattle. Próximos gates: segurança/Compose avançados, execução física infra/afinidades/health/sidecars, identidade/streams, migração/restore/rollback e consolidação. Sem Ember/produção/push/release. Baseline compartilhado permanece parado.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, upgrade de afinidades

Build547 testes/62 arquivos + TypeScript/Vite. workloadSchedulingUpgrades=true após15 checks browser/quatro cenários de tema e tamanho, upgrade nativo/rollback/finish/remover afinidade com estado persistido conferido. Snapshot completo, schema fresco e revisão no drawer existente; imagem/bindings/env/comando/rede/escala0 e demais labels preservados. Flag independente da criação e de saúde/sidecars. Fixture1st115/1s147 removida com configurações e volumes anteriores preservados; nenhuma instância criada. Doc44 e scheduling-upgrade-*-results.json. Sidecars tinham lista vazia na fixture: teste de preservação com worker é unitário.

Estimativa de planejamento permanece aproximadamente70% Cattle, sem paridade plena. Próximos gates: security/Compose avançados, delegação de catálogos, execução física de afinidades/health/sidecars/infra, sessão e consolidação. Sem produção/dump/publicação. Baseline original deve permanecer parado sobre o banco compartilhado.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, afinidades na criação

Build543 testes/62 arquivos + TypeScript/Vite, workloadScheduling=true após11 checks browser/oito cenários de tema-tamanho, persistência nativa de duas afinidades + label customizada e negação403 sem environment. Editor na seção existente de criação de serviço/container, reutilizado em sidecars; envio valida payload recursivo com schemas atuais do backend. Configurações legadas não interpretáveis não são convertidas silenciosamente. Global existente permite somente host obrigatório/negação. Host solicitado mantém seletor existente.

Fixture escala0/inativa/sem instâncias removida; hashes de serviços, containers e volumes anteriores preservados. Revisão visual corrigiu inputs fora do wrapper comum e repetiu toda a aceitação. Doc43 e scheduling-*-results.json. Criação em sidecars tem gate de domínio, não persistência específica. Upgrade contextual de afinidades apenas planejado no doc44; físico multi-host/global também pendente. Contas locais e proteção de sessão do checkpoint42 continuam ativas.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, administração de contas locais

Build536 testes/61 arquivos + TypeScript/Vite, módulo localAccountAdministration habilitado após25 checks E2E/12 cenários de tema-tamanho e dez checks nativos (doc42). Contas locais na própria tela Usuários: criação sem acesso, perfil global com revisão explícita, senha e lifecycle. Credenciais fora de cache/storage/evidências. Revalidação de schema/sessão/snapshot e proteção da própria conta; lista acompanha transições.

Corrigido GET token nativo que mantinha identidade de conta desativada/perfil antigo. SESSION_ACCOUNT_GUARD_ENABLED=true valida conta e retorna perfil atual;118 asserts Java/64 combinações. Native GET token retorna rancher_id numérico, não accountId: conversão explícita corrigida para validação e proteção do próprio administrador. Reset de senha não revoga JWT; aviso na UI. Login nativo bem sucedido retorna201. Autopromoção de usuário comum negada.

Todas as fixtures de contas removidas e hashes de perfis/metadados de credenciais anteriores preservados. Password DELETE nativo405: helper exclusivo de teste fez soft-remove SQL apenas da própria credencial inativa e vinculada à conta já removida; UI não executa SQL. Manifesto ausente. Smoke, Sobre/capacidades e26 checks de recuperação de atualização repetidos após a mudança. Regressão de sessão OIDC/local:12 checks, papéis/envs mantidos, usuário sem acesso com zero envs e host1h1/agente ativos; sem escritas de negócio.

Continua aproximadamente70% Docker/Cattle pela estimativa ponderada doc35; contas locais fecham um recorte F8. Infra física, auth/provedores, expiração/logout federado, streams, scheduling/security avançados, migração/recovery e consolidação seguem pendentes. Sem declarar100%, alteração no Ember, produção ou publicação.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, saúde e sidecars completos no recorte de configuração

Build **529 testes/60 arquivos + TypeScript/Vite**, console18090 atualizada. Saúde na criação/upgrade (38–39) e sidecars na criação/upgrade (40–41), com flags independentes. Editor comum, revisão, snapshots/schema frescos e operação contextual. Não é conclusão de todas as fases nem aceite de execução física.

Criação: saúde13 checks/oito cenários de tema; sidecars10 checks/quatro cenários, dois auxiliares e HTTP aninhado persistidos inativos/escala0. Sem instâncias; fixtures removidas, configurações/containers/volumes anteriores preservados. Upgrade saúde14 checks/quatro cenários: HTTP, rollback, finish, remoção null; readonly422 InvalidAction com ação ausente/sem alteração, grant temporário removido. Upgrade sidecars13 checks/quatro cenários: editar/incluir, rollback exato, finish/remover todos, primário/env/escala/contexto preservados e negação fora do environment. Fixture final1st112/1s144 removida; manifests próprios ausentes.

Remoção de sidecars teve tentativa rejeitada: [] é mesclado pelo Rancher1.6 e preserva itens antigos. Corrigido por marcadores nativos imageUuid=rancher/none apenas para nomes anteriores removidos/renomeados, após normalização de imagens. Imagem reservada bloqueada na entrada; selectorContainer excluído desse editor. Aceite repetido conferiu estado persistido, não somente upgraded. Screenshots móveis da criação levaram à remoção de camadas redundantes de fieldsets.

Estimativa segue cerca de70% Docker/Cattle (doc35). Restam formulários/opções avançadas, físicos de infra/health/sidecars, identidade/sessão, administração e consolidação. Dump real adiado; nenhuma alteração de Ember/produção ou publicação externa. Recuperação de atualizações do doc37 permanece ativa com assets anteriores em volume próprio.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, saúde e sidecars

Build **524 testes/60 arquivos + TypeScript/Vite** aprovado. Saúde na criação de serviço/container (38), upgrade contextual de saúde com revisão/rollback/finish/remover (39), e criação de sidecars por formulário reutilizável (40). Flags workloadHealthChecks, workloadHealthCheckUpgrades e workloadSidecars=true, independentes dos recortes de bindings/layout. Off mantém alternativas nativas e não remove configurações existentes.

Saúde criação:13 checks browser/oito cenários axe-tema, TCP/HTTP/quórum/desativado persistidos em serviços inativos escala0, nenhum container agendado. Upgrade:14 checks/quatro cenários axe-tema, imagem/bindings/variáveis/comando/rede/escala preservados, rollback restaura e finish/remover null confirmados. Readonly422 InvalidAction com ação ausente em schema/recurso e configuração idêntica; grant temporário removido. Fixtures saúde e config-upgrade removidas com hashes anteriores preservados. Aceite de execução física de saúde/quórum continua separado; sidecars preservados no upgrade têm teste de payload, fixture real do upgrade não possuía sidecars.

Sidecars: editor por container, nomes/imagens, seções e saúde comuns, adicionar/remover com chaves estáveis, validação de referências e ciclos. UI móvel simplificada após screenshot revelar recuos excessivos; não foi aceita só por axe. Sete testes novos; primeiro E2E passou persistência mas o seletor do harness era ambíguo com flag off. Repetição final de dez checks/quatro cenários passou; dois sidecars e healthcheck aninhado persistidos inativos/escala0, configuração e contexto corretos. Verificação nativa aprovada e cleanup final concluído: configuração prévia/containers/volumes preservados, identidade sem environment negada403 e manifest próprio ausente. Relatórios sidecars-*-results.json.

Estimativa segue aproximadamente70% Docker/Cattle (doc35), sem declarar paridade ou prontidão produtiva por contagem de testes. Dump real adiado. Scheduling/security avançados, upgrade/compartilhamento físico de sidecars, infra/identidade e consolidação continuam pendentes.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, criação com verificações de saúde

Recorte38 concluído: seção Saúde na criação de serviços/containers, TCP/HTTP/desativado, tempos/limites e política/quórum. Flag workloadHealthChecks.13 checks browser, oito combinações de tema/tamanho/tipo com zero violações axe/overflow, persistência real de três serviços escala0/inativos/sem instâncias e403 para identidade sem environment. Fixtures removidas, hashes de configurações anteriores e IDs de containers/volumes preservados. Sem alegação de saúde/recriação física.

Build vigente517 testes/59 arquivos + TypeScript/Vite. Upgrade contextual de saúde (doc39) implementado e em validação real com fixture config-upgrade exclusiva; não encerrar gate até relatório final/cleanup. Preserva imagem/bindings/variáveis/sidecars, usa serviceUpgrade nativo, relê schema/recurso, exige revisão e rejeita snapshot alterado; flag workloadHealthCheckUpgrades. RequestLine legado desconhecido não é convertido.

Estimativa de planejamento segue aproximadamente70% Docker/Cattle; incremento de recortes não fecha aceites físicos, sessões e consolidação. Dump real adiado. Frontend Ember preservado, sem publicação externa.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, recuperação de atualização

Frontend **505 testes/58 arquivos + TypeScript/Vite**, console18090 atualizada. Erro de módulos antigos em Administração/Integrações corrigido com retenção de assets em volume próprio, CONSOLE_ASSET_RETENTION=true. HTML/configuração continuam atuais; sem retenção de imagens Docker. Primeiro seed preservou o build anterior; arquivos descartados antes desta retenção não são recuperados retroativamente.

Boundary comum no conteúdo mantém sidebar/navbar e oferece recarga explícita sanitizada; fallback raiz substitui a tela técnica do router. Nada de auto-reload ou repetição de mutação. Flag off serve apenas assets atuais, sem apagar volume. Doc37.

26 checks browser passaram: módulos indisponíveis forçados em Groups/ApiKeys com shell e navegação independente preservados, axe nas recuperações, recarga com URL/environment mantidos, dez páginas de Administração/Integrações e execução real do entrypoint anterior carregando Grupos/Chaves depois do deploy. Zero pageerrors não tratados. HTTP200 de três assets anteriores e atual,404 para asset inexistente; flag off validada em container temporário sem rede, já removido. Relatórios update-recovery-e2e-results.json e update-assets-results.json. Nenhuma mutação de negócio nesses testes.

Estimativa permanece cerca de70% Docker/Cattle (doc35); esta entrega de confiabilidade não fecha fases funcionais. Dump real adiado. Próximo bloco: formulários avançados Cattle; demais pendências no doc35.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, fontes por environment e estimativa

**Estimativa: cerca de 70% do escopo Docker/Cattle, 30% restante**, faixa65–75%. Critérios e pesos no documento35; opcionais F9 condicionais ficam separados. Percentual considera implementação e aceite, sem representar prontidão produtiva. Dump real explicitamente adiado.

Frontend501 testes/57 arquivos + TypeScript/Vite. Novo fluxo Fontes do environment dentro do Catálogo, com drawer compartilhado, fontes globais somente para consulta, CRUD nativo Cattle, URL privada mascarada, revisão/descarte e preflight de snapshot/escopo. Flag environmentCatalogs; editor exclusivo de admin nesta entrega. Fontes também são sanitizadas antes do cache da listagem principal. Oito cenários axe/layout reais (claro/escuro ×1440/390, inventário/editor), CRUD/contexto/flag/cleanup validados. Doc36.

Teste nativo revelou readonly PUT200 no proxy de catálogo. Corrigido no backend para verificar verbo real e Policy antes do forwarding de /v1-catalog; flag RANCHER_CATALOG_WRITE_GUARD_ENABLED=true independente da UI. Java compilado, 115 asserts de configuração passaram. Matriz real após restart aprovada: sem acesso POST403; readonly POST/PUT/DELETE403, incluindo proxy direto e header de papel falsificado; member/owner PUT200. Grupo/fonte temporários removidos e baseline de fontes preservada. Smoke5 checks e repetição final E2E20 checks/oito cenários axe/layout aprovados. Nenhuma alteração do frontend Ember. Estado original de fontes e grupo de teste restaurados após a primeira falha.

Próximo recorte após fechar este gate: formulários avançados Cattle. Permanecem clone/sincronização física, delegação da UI de catálogo, infra/storage/LB/TLS, sessão/streams, administração avançada e consolidação/migração/restore. Detalhamento no documento35. Laboratório local, sem produção/dump/publicação/prune ou baseline iniciado.

### Checkpoints anteriores

## Checkpoint vigente — 23/10/2026, drivers, repositórios e Compose existente

Build **493 testes/56 arquivos + TypeScript/Vite** aprovado; console18090 atualizada. Flags machineDrivers, driverActivation e catalogRepositories=true. Drivers com inventário, cadastro solicitando inativo, edição protegida de personalizados e menu comum para ações. Generic embutido ativado/reativado/desativado em API e UI, restaurado ao estado/configuração original; zero máquinas. Registro inativo pode processar o binário e entrar em erro, explicitado na revisão. 22 checks E2E e oito cenários axe/layout; 14 drivers anteriores preservados, fixtures removidas. Doc32.

Repositórios globais usam settings/catalog.url, sem inventar escrita em v1-catalog/catalogs (somente GET). Editor estruturado preserva campos desconhecidos e protege URLs/cache; revisão, descarte e confirmação de remoção total. 18 checks E2E e oito cenários axe/layout. Entrada local temporária removida, override DB removido no finally e valor/fonte originais restaurados exatamente; manifest próprio ausente, catalog-fixture.json histórico preservado. Doc33. Usuário comum lê inventário de drivers e catalog.url nativos, mas escrita é negada; UI administrativa restrita a admin.

Compose existente habilitado por stackComposeUpgrades em stacks Cattle com Compose de origem, sem catálogo/system. 15 registros E2E/quatro cenários axe/layout: arquivo atual exportado, imagem efetivamente alterada, rollback/finish, parâmetros/escala0/contexto preservados e POST negado sem environment. Fontes privadas fora do query/mutation cache. Doc34 distingue tentativas rejeitadas (stack manual no-op e escala0 normalizada para1 na criação) do seed aceito (criar inativo, scale0 por API e só então upgrade). Fixtures finais1st103/1s133 removidas, configurações/volumes anteriores preservados; manifest ausente.

Matriz visual de drivers/repos repetida: selecionar tema com modal aberto não alterava o shell, e o harness agora abre cada editor no tema previamente escolhido e confere data-theme; relatórios atuais possuem appliedTheme correto. Entradas de repositórios usam o agrupamento visual compartilhado nested-fields. Regressão de11 rotas/44 cenários + environment por teclado aprovada.

Docker estava parado na retomada; somente os quatro serviços locais foram reiniciados. IP interno do Rancher mudou e o agente ainda apontava para o anterior. prepare_legacy_host.py repôs arquivo privado, repair_legacy_connection.py reaproveitou registro existente e verificou o mesmo host1h1 active/active. Bootstrap dedicado encerrado foi substituído; workloads e host não foram recriados pelo helper. Guest channel corrigido para stdin terminado com newline. Relatório legacy-connection-results.json. Baseline/policy VM/outros projetos preservados.

**As fases completas permanecem abertas.** Próximos recortes: atualização/clone físico e fontes por environment de catálogo, drivers do catálogo/provisionamento, formulários avançados e opções Compose ainda sem aceite, configuração/migração HA além do monitor, provas físicas storage/LB/TLS/webhooks, expiração/logout federado e consolidação F10. F9 depende de laboratório/orquestradores. Frontend Ember intacto; sem push/merge/release, produção ou permissões do Codex.

### Checkpoints anteriores

## Checkpoint vigente — 22/10/2026, HA e pools do engine

Build **432 testes/50 arquivos + TypeScript/Vite** aprovado. Novas flags habilitadas: `clusterMonitoring` e `processPools`. HA mostra membros/heartbeats reportados, extraindo apenas endereço/porta/clustering do JSON config antes do cache. Pools ficam como aba da tela de Processos, preservando filtros de execuções, com atualização pausável/manual e contadores instantâneos/acumulados diferenciados. Nenhuma alteração de HA, script/dump ou tuning foi executada.

23 checks E2E reais, oito cenários axe/layout; consulta nativa, pausa/manual/retomada, flag e negação admin/leitor. DataTable tem região nomeada/tabIndex0 para rolagem por teclado. Após a mudança comum, 44 cenários das 11 rotas anteriores + environment por teclado passaram; replay de processos repetido (13 checks), fixture1c417/1pi18717 revogada e manifest ausente. Documento31 e relatórios engine-monitoring*. As demais entregas habilitadas e seus limites continuam nos documentos24–30.

**Todas as fases ainda não estão concluídas.** Próximos recortes: drivers e catálogo administrativo; formulários avançados/Compose existente; configuração/migração de HA (além do monitor somente leitura), provas físicas storage/LB/TLS/webhooks, matriz de sessão/contas técnicas e consolidação F10. F9 depende de orquestradores usados e laboratório. UI Ember/produção/baseline/projetos externos preservados; nenhuma publicação, merge ou alteração de permissões do Codex.

### Checkpoints anteriores

## Checkpoint vigente — 22/10/2026, webhooks e marca compartilhada

Build **418 testes/48 arquivos + TypeScript/Vite** aprovado, servido na console 18090. `modules.webhooks=true`: criar escala de serviço, upgrade por tag/labels e escala de hosts; clonar configuração, URL protegida e excluir no mesmo shell. Sem PUT inventado e sem forwardPost novo. URL não entra no query/mutation cache, storage, links clicáveis, logs do cliente ou screenshots; mostrar/copiar são explícitos.

24 checks E2E, incluindo **12 cenários axe/layout** (três drivers × claro/escuro ×1440/390), CRUD/clone com chave independente, consulta mascarada, storage, flag e negação fora do environment. Native readonly: GET200 sem URL, POST/DELETE405; Member: URL/criação200/exclusão204, outro environment403. Schemas são estáticos e anunciam escrita para readonly; a UI usa relatório de acesso efetivo completo owner/member e revalida no envio. Relatórios e limites no doc30. Nenhum webhook foi invocado, portanto entrega de eventos/provisionamento/escala por evento ainda não estão validados.

Fixture final 1st98/1s128 e receivers públicos1go17–1go20 removidos, hashes de receivers anteriores preservados; manifests de probe/roles/member/UI ausentes. Grupos temporários removidos. Passadas anteriores de fixtures destas etapas também limpas. Demais gates de apiKeys/audit/about/processes/settings/upgrade de portas/volumes continuam nos docs24–29.

Marca agora centralizada em `components/Brand.tsx`, reutilizada em AppShell, AuthLayout e Sobre, mantendo os símbolo e wordmark originais Rancher nos dois temas. Regressão de Sobre (oito cenários), smoke (cinco) e formulário de bindings (quatro, foco/axe) passou após extração; legenda de fieldset tem espaçamento/tipografia comuns. Arquivo de flags público e docs atualizados.

**Todas as fases ainda não estão completas.** Próximos recortes: HA/pools/drivers e catálogo administrativo; formulários avançados/Compose; provas físicas de storage/LB/TLS e webhooks, sessão/expiração real e consolidação F10. Opcionais F9 dependem de orquestradores usados/lab. Frontend Ember/produção/baseline/projetos externos preservados; nenhum push/merge/release ou alteração de permissões do Codex.

### Checkpoints anteriores

## Checkpoint vigente — 22/10/2026, upgrade contextual de configuração

Build **395 testes/46 arquivos + TypeScript/Vite** aprovado. `modules.workloadConfigUpgrades=true`: no drawer existente de upgrade, portas e volumes estruturados com revisão e imagem opcionalmente mantida. Contratos/recurso frescos e snapshot; variáveis/comando/rede/sidecars preservados. Flag off mantém a experiência anterior somente de imagem. Nenhuma edição de launchConfig imutável por PUT.

**11 checks E2E**, quatro cenários axe/layout claros/escuros 1440/390, upgrade/readback/rollback/finish e negação de acesso com CSRF/payload válidos. Stacks/serviços 1st88/1s118 e 1st89/1s119 removidos; hashes de configurações anteriores e volumes preservados; manifest ausente. Teste de configuração em escala zero, sem tráfego/montagem física. Doc 29 e relatórios config-upgrade*. Parser comum passou a reconhecer volumes anônimos `/data:ro`/`rw`, mantendo original e validação de destinos.

Permanecem habilitados apiKeys/audit/about/processes/processReplay/settings dos docs 24–28, com seus gates e flags próprios. Última regressão do shell/auditoria/Sobre passou após a administração; host original 1h1/agent active confirmado. Nenhum segredo real em artefatos e nenhum manifest de fixture destas etapas permanece.

Próximos recortes de paridade: webhooks e demais integrações, HA/drivers/catálogo administrativo; configurações avançadas de workload/Compose; provas operacionais de storage/LB/TLS e consolidação F10. F9 depende de orquestradores usados/laboratório. **Todas as fases ainda não estão concluídas.** UI Ember, produção, baseline e projetos externos preservados; nenhum push/merge/release ou alteração de permissões do Codex.

### Checkpoints anteriores

## Checkpoint vigente — 22/10/2026, administração validada

**383 testes/46 arquivos + TypeScript/Vite** aprovados. Novos módulos habilitados: `apiKeys`, `audit`, `about`, `processes`, `processReplay`, `settings`. Cada um tem flag independente, AppShell e componentes comuns. `admin/api/optional` genéricos continuam false, sem liberar HA/drivers/webhooks/orquestradores pendentes.

Evidências atuais:
- API keys: 20 checks E2E, 9 RBAC nativos, 4 cenários axe/layout; segredo privado/sanitização e lifecycle real, fixtures revogadas.
- Auditoria: 15 checks E2E, quatro cenários axe/layout; cursor de 100, filtros anunciados, DTO sem corpos, leitura nativa do leitor limitada à própria conta e UI administrativa protegida.
- Sobre/capacidades: quatro testes de componente, oito cenários produto/capacidades × tema/tamanho, flag e entrada compartilhada. Apenas capacidades booleanas por allowlist; versão da console pelo package.json.
- Processos: 13 checks E2E, quatro cenários axe/layout, replay nativo somente de credential.deactivate da fixture 1c416/1pi18625. Contagem resetada a zero e chave preservada inactive. Não se alega que todos os handlers são idempotentes ou foram reexecutados com sucesso. Fixture revogada; HA separado.
- Settings: 10 checks E2E, quatro cenários axe/layout, PUT multiline e reset do override descartável; hashes das 697 configurações anteriores preservados. Valores fora do cache/storage, revelação explícita, erros sanitizados e fresh snapshot (sem CAS atômico).
- Regressão compartilhada após Modal/DataTable: smoke 5, previews de bindings 4 e matriz de 44 cenários das 11 rotas anteriores + teclado do environment aprovados. Modal de leitura longo agora rolável por teclado; DataTable permite paginação externa sem paginação duplicada.

Todos os manifests de API keys/RBAC/processos/settings ausentes após cleanup. Docs 24–28 e relatórios individuais registram os recortes. UI Ember original intacta; nenhuma produção/push/merge/release; baseline permanece parado. Host original reconectado por cloud-config privado após reinício do Docker.

**As fases completas e a paridade total ainda não foram concluídas.** Próximos recortes: edição estruturada de portas/volumes via upgrade contextual; webhooks, HA/drivers, catálogo administrativo, validações operacionais avançadas, consolidação F10. F9 continua condicionado a orquestradores realmente utilizados e laboratório correspondente, sem prometer suporte não validado.

### Checkpoints anteriores

## Checkpoint vigente — 22/10/2026, chaves de API e auditoria

Build **348 testes/41 arquivos + TypeScript/Vite** aprovado. `modules.apiKeys=true` após 20 checks E2E de conta/environment e 9 checks RBAC nativos, com 4 cenários axe/layout de formulário. Documento 24 e relatórios api-keys*. Segredos apenas na memória privada/DOM mascarado da criação; DTO elimina segredo antes do cache; chaves compartilhadas são explicitamente independentes de membership. Remoção é desativar → revogar; registros removidos/purgados seguem retenção nativa. Fixtures e grupo temporário removidos; manifests ausentes, preservação de chaves anteriores verificada com transições nativas de purge registradas.

Auditoria administrativa implementada sob `modules.audit=false`, em validação: paginação nativa limitada a 100, filtros de evento/recurso/conta autenticada, detalhe de metadados e DTO que exclui requestObject/responseObject/description/IP antes do cache. O backend ignora responseCode como filtro, por isso a interface usa somente os filtros anunciados. Documento 25. Não liberar a flag antes do E2E admin/leitor/temas.

O runtime Docker foi encontrado parado durante retomada. Foram iniciados somente os quatro containers Rancher/Keycloak/console/host original. Baseline MySQL permaneceu parado; outros projetos não foram operados. Cloud-config privado do host original reposto em /run após reinício, usando token de registro já existente. Nenhuma configuração do Codex foi alterada.

Próximos gates: concluir E2E/a11y/autorização de auditoria; administração/settings/processos e demais lacunas F5–F10. **Todas as fases ainda não estão completas.** Frontend Ember não alterado, nenhuma produção/push/merge/release.

### Checkpoints anteriores

## Checkpoint vigente — 22/10/2026, editores liberados no laboratório

**319 testes/36 arquivos + TypeScript/Vite** aprovados, incluindo 22 casos novos de portas/volumes e correção compartilhada de foco nos modais. `balancerRulesEditor=true`, `workloadBindingEditors=true`, `unsavedChangesGuard=true`; flags de administração/API opcionais seguem desligadas. UI clássica não alterada.

A limitação da automação interativa foi superada para os testes do projeto por uma suíte **JavaScript Playwright isolada**, usando contexto headless próprio do runtime e sem controlar Chrome, perfil, cookies ou abas do usuário. Nenhuma configuração/permissão do Codex foi alterada. Relatórios registram Playwright 1.62.1 e Chromium headless 156.0.8078.4 (executável de cache explícito; não o binário default esperado pelo pacote).

Evidências desta etapa:
- 5 checks do smoke de navegador: login local, shell, stacks, temas, 390 px e ausência de pageerror.
- 12 checks E2E dos editores: HTTP/TCP, confirmação de publicação, revisão, salvar/readback, preservar busca/environment, beforeunload real, conflito externo, descarte, flags off/on e criação de serviço com porta/volume estruturado inativo/escala zero.
- 7 auditorias axe dos drawers/diálogos sem violações detectadas; 4 previews de tema/tamanho para bindings com axe, overflow, descarte e foco totalmente dentro do corpo rolável. Zero escritas de negócio nesses previews.
- 44 cenários axe/layout/saúde nas 11 rotas implementadas, em claro/escuro × 1440/390 px, sem violações automatizadas ou overflow/erro de carregamento. Seletor de environment passou busca/Enter/Escape e restauração de foco. Isso não equivale a conformidade WCAG completa/leitor de tela.
- 10 checks nativos de bindings: serviço inativo escala zero, container stopped, portas TCP/UDP/IPv4 e volumes preservados; negativa sem environment e cleanup; inventário de volumes preservado.

Cleanup confirmado: bindings 1st85/1s112/1i914 removidos; E2E 1st87/1s115/1s116/1s117 removidos, manifests ausentes, configurações dos balanceadores anteriores preservadas. Relatório `context-editors-cleanup-results.json` vincula IDs e fixture. O teste anterior 1st86 também foi removido. Tráfego físico, montagens, TLS/multi-host e demais fases continuam como gates próprios; nenhum aceite parcial foi chamado de frontend completo.

Documentos 19–23 descrevem os recortes e limites. Próxima implementação: API keys no novo frontend, com escopo explícito, segredo somente no estado privado, exibição única, revisão/revalidação e lifecycle nativo (documento 24). Fases restantes ainda não estão todas concluídas.

### Histórico anterior


## Checkpoint atual — 22/10/2026

**297 testes em 35 arquivos + TypeScript/Vite aprovados** na imagem da console independente. Regras contextuais HTTP/TCP implementadas: menu/detalhe → drawer, destinos por stack/serviço, portas internas/publicadas, hostname/path, revisão, guard de escopo/schema, snapshot concorrente e preservação de configuração. `modules.balancerRulesEditor=false` até concluir aceite visual. Protocolos/bindings avançados deixam todo o editor especializado protegido com resumo das regras preservadas; edição genérica continua disponível.

**9 checks nativos passed**, usando o mesmo módulo de domínio do frontend, sem automação do navegador. HTTP/TCP e bindings persistidos; configuração/imagem/environment/labels preservados; usuário sem environment recusado; concorrência detectada. Fixture `console-lb-45df51f2`, stack 1st84/backend 1s110/LB 1s111, inativa/escala zero, removida; manifest ausente e hashes dos balanceadores anteriores preservados. Nenhum tráfego físico, container de LB, TLS ou multi-host foi validado. Documento 19 e `console/balancer-rules-test-results.json`.

Correção transversal adicional: `modules.unsavedChangesGuard=true`. Hook compartilhado cobre reload/fechamento de página com rascunho ou envio pendente em ResourceCreator, ResourcePanel, ServiceLinksPanel, BalancerRulesPanel e controladores de Catalog/Resources. Cinco testes de eventos/componente verificam rascunho, pending, limpeza, flag e unmount; guards já existentes continuam. O navegador controla o aviso nativo; não é autosave nem garantia contra encerramento do processo. Documento 20.

Aceite visual do editor de LB permanece pendente: automação de navegador anterior indisponível e alternativa Computer Use recusou interação com Chrome (`Computer Use was not approved to use Google Chrome`). Não solicitar novas confirmações de sandbox; autorização ampla do usuário permanece. Não alterar configurações do Codex: esse pedido foi cancelado. Próximos passos: aceite visual sob fixture nova se a ferramenta estiver disponível; editores especializados de portas/volumes e demais lacunas F5/F6/F8/F10. Nenhuma fase completa ou paridade integral foi declarada.

Tudo restrito a `console/` e documentação/fixtures do laboratório. UI Ember original, produção e repositórios externos não foram alterados. Nenhum push/merge/release. Baseline e VMs adicionais preservados.

### Checkpoints anteriores


Cleanup do aceite de criação por seções confirmado: 1st83/1s109/1i912 removidos; manifest ausente e sete checks nativos passed. A pendência de cleanup nos checkpoints anteriores foi resolvida.

## Checkpoint mais recente — criação por seções, 22/10/2026

**271 testes/32 arquivos + TypeScript/Vite**. modules.workloadCreationSections implementada e true no laboratório. Criação service/container no drawer reutiliza schemas com grupos recolhíveis, defaults tipados, valores de environment mascarados e revalidação de campos aninhados antes de POST. CUA/API validaram service inativo com escala zero e container stopped, preservando imagem/comando/rede/variável UTF-8/memória em bytes. Documento 18 e relatórios workload-creation descrevem limites; isso não fecha F5 integralmente.

O laboratório parou externamente entre o aceite e a tentativa de cleanup (containers exit 255), e foi retomado com os mesmos volumes/containers; baseline/VM extra mantidos parados. Confirmar o cleanup de 1st83/1s109/1i912 no relatório/manifest antes de tratar a entrega como encerrada. Nenhuma produção, push ou merge.


Confirmação final do aceite de vínculos: 8 checks nativos passed; fixture 1st82/1s107/1s108 removida e manifest ausente, mapas originais preservados.

## Checkpoint posterior — vínculos de serviços, 22/10/2026

Base aprovada com **266 testes em 31 arquivos + TypeScript/Vite**. Editor contextual de vínculos implementado sob modules.serviceLinksEditor; flag habilitada no laboratório após CUA/API: adicionar destino/alias, revisão antes/depois, conflito externo recusado, remover todos com aceite explícito, flag genérica e temas/móvel de 390 px. Configuração-only com serviços de escala zero; não comprova DNS/tráfego. Detalhes no documento 17 e relatórios console/service-links-*-test-results.json. Próximos itens F5 continuam sendo formulários especializados e LB; paridade completa permanece pendente.

A pedido do usuário, login pelo Keycloak validado via fluxo OIDC completo para **operador**, que acessa RBAC-DEV como Member. Senha foi informada diretamente na conversa, sem gravar em docs. labadmin local e labadmin/master Keycloak são contas diferentes; nenhum admin OIDC foi criado.


## Checkpoint que prevalece — 22/10/2026

Retomada autorizada após retorno da cota. **255 testes/30 arquivos + TypeScript/Vite** no build de Compose + checkboxes compartilhadas. modules.stackComposeEditor e customCheckboxes implementadas e true no laboratório; admin/api/optional continuam false. O texto de 21/10 abaixo é histórico onde disser Compose somente planejado, flag ausente ou gate 243.

Compose: criar stack vazia/importar dois arquivos/variáveis privadas, start false por padrão e schema fresco antes de POST. CUA+API comprovaram importação inativa, UTF-8 e início pelo menu produzindo container físico. Oito checks nativos e sete browser; fixtures 1st80/81, serviço e instâncias removidos; manifest ausente. Documento 15 registra falha recuperada do manifest no primeiro cleanup e limitações.

Checkboxes: customização global com tokens, 18px sem padding de campo de texto, legenda/descrição alinhadas; componente reutilizado em booleanos tipados e Compose. Sete checks browser de temas, Space/click/foco/mobile e flag nativa/custom. Documento 16.

O laboratório estava parado ao retomar em 22/10: console não resolvia upstream. Foram iniciados somente containers existentes de Rancher/Keycloak/host original/console; reposta a configuração privada já autorizada na VM original. Baseline/VM de políticas/dind preservados parados. Nenhum volume removido.

Verificação solicitada pelo usuário: **não existe admin OIDC no realm rancher-lab**; contém leitor, operador e sem-acesso. labadmin do realm master administra Keycloak; Rancher 1a1 é administrador local. Não confundir credenciais nem afirmar que admin OIDC está provisionado. Nenhum novo privilégio foi criado. Provisão controlada de administrador OIDC permanece gate necessário antes de uso exclusivo administrativo.

Próxima entrega F5: formulários especializados de workload, links de serviços e LB; completar gates e backlog abaixo. Paridade completa continua pendente.

Atualização de handoff em 21/10/2026. Este documento e o [handoff vigente](../HANDOFF-2026-10-21.md) prevalecem sobre checkpoints históricos. **Frontend completo ainda não concluído.** O usuário solicitou entregar a documentação; nenhuma funcionalidade nova deve ser considerada implementada nesta atualização.

## Estado conferido nesta entrega

- Containers console, Rancher customizado, Keycloak e VM do host legado estão em execução. VM de políticas, antigo host dind e baseline original estão parados, com dados preservados. Não iniciar baseline e customizado sobre o mesmo MySQL.
- API nativa conferida: UI-OPS-LAB (1a12) active, host 1h1 e agente active.
- Console em `http://localhost:18090/console/`; clássico em `http://localhost:18080`; Keycloak em `http://localhost:18081`.
- Imagem da console em execução coincide com `rancher16-community-console:dev`: `sha256:88f5d1f511b7f18c83d5847ce19f5e13699b5437d883567a17d1ab17dc07e729`. Artefato `console/index.html` presente. Não houve rebuild nem repetição de testes funcionais nesta entrega documental.
- Último gate de build registrado: **243 testes em 29 arquivos, TypeScript e Vite aprovados**, após escala contextual. É resultado da implementação anterior, não uma nova execução nesta atualização.
- `unified-fixture.json`, `catalog-upgrade-fixture.json` e `upgrade-fixture.json` estão ausentes. Relatórios anteriores registram cleanup das fixtures; ausência de manifest isoladamente não substitui auditoria backend.
- Configuração pública verificada: módulos operacionais existentes true; `admin`, `api` e `optional` false. `stackComposeEditor` **não existe no contrato nem no JSON atual**; é proposta do documento 15.

## Entregas e evidências

| Área | Implementado / aceite registrado | Limite |
|---|---|---|
| Shell e visual | AppShell/AuthLayout, marca Rancher e assinatura comunitária, tokens próprios próximos ao Rancher, temas, scrollbar e seletor pesquisável de environment | Matriz manual completa de acessibilidade/performance ainda aberta |
| Login / acesso | Local + OIDC, modo exclusivo/autologin, callback sem F5, acesso pendente e ausência de environment automático; 28 checks históricos de flags | Expiração criptográfica real de JWT, logout federado e contas técnicas ainda pendentes |
| Grupos / auditoria | Grupos locais, membros/grants, revisão 409, auditoria transacional, acesso efetivo e Meu acesso; 35 checks de acesso/auditoria, 7 browser e 3 self-service | Identidades externas dinâmicas e migração/rollback versionados incompletos |
| Environments / templates | Gestão, templates Compose/catálogo, privacidade e proteção de rascunhos; 19 testes específicos e 7 checks de retomada | Os 13 checks completos de browser recebidos da outra IA não foram integralmente repetidos após a última alteração |
| Políticas de rede | Painel nativo ipsec, diff, preservação de regras avançadas, estado saudável exigido; 16 checks físicos/RBAC | Um laboratório isolado; sem vxlan/multi-host/todas as regras; VM de políticas desligada |
| Operação unificada | Stacks → serviços → containers em lista vertical; menus …, drawers de criação/edição/lifecycle, tabs locais, logs/terminal no contexto do pai | Formulários especializados e ações nativas ainda não têm paridade completa |
| Reinício / imagem | Contrato rollingRestartStrategy corrigido; logs segregados, terminal, restart, upgrade/rollback com containers reais | Tag local v2 usa a mesma Alpine cacheada; não prova mudança de binário, registry remoto ou zero downtime |
| Upgrade de catálogo | Drawer com versão/perguntas/arquivos e aceite de impacto; 11 checks API/setup/cleanup; ZooKeeper 3.4.6 → 3.4.8 em serviço previamente zerado | Rancher pode iniciar serviços parados e preservar escala atual; não prova rolling upgrade de ZooKeeper |
| Escala efetiva | Drawer pelo menu/detalhe; inteiros/limites/zero/confirmação/snapshot; 15 regressões e 8 checks browser/integrados, físico 2 → 1 → 0 → 2 | Um host; serviços globais/transitórios excluídos; comparação de cliente não é CAS atômico |
| Hosts / dados | Registro/lifecycle, volumes/registry/secrets/certificados; 5 checks de volume físico | Provisionamento cloud, snapshots/backups/drivers e TLS/LB completos pendentes |
| Observabilidade | Logs, terminal, métricas limitadas em memória, revalidação de permissão e encerramento de streams; soak histórico de uma hora | Soak foi no build de 133 testes; perda de cookie não comprova expiração real de JWT; revogação por polling não é instantânea |
| Administração / opcionais | Acesso/auditoria necessários a grupos disponíveis; módulos gerais admin/api/optional desligados | Administração completa, chaves/API/webhooks e orquestradores opcionais não entregues |
| Compose especializado | Somente plano e leitura do schema nativo documentados | **Sem implementação, flag, build ou aceite.** Criação genérica existente permanece |

As contagens pertencem a recortes diferentes e se sobrepõem. Não somar como cobertura total. Relatórios e caminhos precisos estão no handoff e nos documentos 11 a 15.

## Prioridades para retomada

1. Ler [15 — Criação contextual por Compose](15-stack-compose-creation.md) e implementar a entrega F5 planejada no drawer existente, começando pela flag desativada. Não confundir este plano com o editor de templates de environment já existente.
2. Completar os fluxos F5 de formulários de workload, links de serviços e balanceadores, com testes nativos e fixtures exclusivas.
3. Repetir o gate completo de templates; completar catálogo/hosts/storage/LB e matriz de streams conforme [roadmap](04-roadmap.md).
4. Resolver administração, integrações e gates transversais sem liberar módulos incompletos. Opcionais só entram com evidência de necessidade e ambiente de teste.
5. Segurança, acessibilidade, performance, migração/rollback, recuperação completa Rancher/Keycloak e empacotamento ainda precisam de aceite antes de produção.

## Regras que persistem

Desenvolver somente `console/` e componentes de laboratório necessários. `ui/` pode ser consultada para contratos, sem novas alterações. Preservar identidade Rancher + comunidade e padrões compartilhados. Usuário autorizou autonomia no sandbox; não repetir pedidos para fixtures/testes/cleanup locais. Isso não autoriza produção, push, merge, release ou operações em Rancher Console/Orveta. Flags visuais não concedem permissão. Revalidar backend, identidade, environment e recurso antes de mutações; nunca expor secrets, tokens, arquivos privados ou URLs de registro.

## Histórico

O [status anterior completo](history/status-before-documentation-consolidation-2026-10-21.md) foi preservado para rastreabilidade. Contagens menores e descrições antigas de laboratório parado pertencem àquelas execuções e não prevalecem sobre este checkpoint.

Atualização73: corrigida revogação de token no subscribe UI sob flag independente. Matriz real on/off aprovada no mesmo backend, com HTTP/nova conexão401 e fechamento1000/zero eventos posteriores quando on; contratos Java128+10 e frontend595/70. Compose moderno habilita; default backend/basefalse. Remoção de grant, desativação, expiração, credenciais técnicas e logs/exec ainda não aceitos.

Matriz73 ampliada: retirada de grant próprio, desativação e expiração real local/OIDC passaram no subscribe UI, incluindo limpeza completa e validade restaurada antes da espera. Transporte de logs/exec/métricas, API keys e carga permanecem abertos. Bootstrap75 preserva arquivos existentes e tem4 contratos PlanOnly/template aprovados; importação/instalação fresca ainda não aceita. Próximo: logout federado opcional62.
