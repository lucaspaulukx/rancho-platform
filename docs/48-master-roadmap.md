# Roadmap mestre — Rancher Community Console

Referência:05/11/2026. Este documento centraliza a execução restante e prevalece sobre prioridades históricas nos documentos antigos. O catálogo de telas03 define a experiência alvo; status08 e relatórios dos recortes12–47 comprovam o que passou. Último build608 testes/71 arquivos + TypeScript/Vite. Não converter contagem de testes em paridade. Estimativa anterior de70% é aproximada e não substitui os gates abaixo.

## Resultado esperado

Console independente para Docker/Cattle Rancher1.6.30: ambiente→stack→serviço→container operáveis na mesma tela, menus contextuais, drawers e logs/terminal/métricas mantendo contexto. Rancher e assinatura comunitária visíveis; tokens próprios próximos ao Rancher escuros, tema claro/sistema/customizável. Shell, navbar, sidebar, seletores, tabelas, formulários e estados comuns. Grupos administrados localmente, OIDC/Keycloak opcional/exclusivo/autologin e novos usuários sem acesso nem environment automático.

Desenvolvimento não altera Ember. Toda função nova tem flag e comportamento off documentados; flag não concede permissão. Valores privados fora de caches/evidências. Recursos e schemas atuais revalidados antes de mutações; conflitos preservam rascunhos. Sandbox autorizado, sem pedir confirmação entre tarefas. Produção/dump real/publicação/remoção do clássico continuam fora desta execução.

## Estados de trabalho

**Aceito em recorte** significa fluxo e limites comprovados, não fase inteira concluída. **Parcial** tem código/alguns testes e gate aberto. **A executar** não está entregue. **Condicional** depende de infraestrutura/provedor/aplicação real compatível: pode ser desenvolvido com fixtures sintéticas, mas nunca marcado aceito sem prova equivalente.

## F0/F1 — Fundação e experiência comum

| ID | Entrega/telas | Estado atual | Critério final |
|---|---|---|---|
| UX01 | Shell/Brand/navbar/sidebar/environment selector; login e no-access | Aceito em recortes | Revalidar todas as rotas e temas no pacote final |
| UX02 | Tabelas, filtros, seleção, menus, drawers, revisão/descartar | Aceito em recortes | Teclado completo, foco/retorno, erro parcial e contextos de todas as telas |
| UX03 | Tokens Rancher Console/Inter, claro/escuro/sistema/custom | Aceito em recortes | Contraste e resolução efetiva de overrides em todas as rotas |
| UX04 | Recuperação de chunks e abas de build anterior | Aceito37 | Teste de atualização e rollback com aba antiga e assets retidos |
| UX05 | Acessibilidade manual/leitor de tela | A executar | Fluxos críticos sem mouse; nomes/ordem/foco e leitor de tela; registrar limites da ferramenta |
| UX06 | Alto volume e performance | A executar | Fixtures20 environments e milhares de registros; latência/heap/render/buffers medidos, budgets definidos antes do teste |
| CFG01 | Flags frontend/backend, fallback clássico | Parcial | Matriz de dependências/on/off e reversão sem alteração de dados |
| CFG02 | Configuração versionada | Aceito53 no contrato/runtime/CLI | Legado→v1→retorno com defaults off, sem sobrescrita; rollback de artefato e banco em REL01/03 |

## F2/F3 — Identidade e autorização

| ID | Entrega/telas | Estado atual | Critério final |
|---|---|---|---|
| AUTH01 | Local/OIDC, callback, exclusivo/autologin, sem acesso | Aceito em recortes | Matriz final modos×sessão×retorno/deep link |
| AUTH02 | Conta desativada/perfil global atual na sessão | Aceito42 | Regressão local/OIDC e credenciais técnicas; reset senha não revoga JWT |
| AUTH03 | Expiração criptográfica real | API/rota local e OIDC aceitos54 | Sem perda simulada de cookie; encerramento de streams e sessão ociosa ainda OBS02/03 |
| AUTH04 | Logout federado/IdP indisponível | Indisponibilidade61 e logout federado62 aceitos em recortes | Logout Keycloak e Rancher coerentes, sem loops ou fallback local no exclusivo |
| AUTH05 | Administrador OIDC e recuperação | Aceito60 | Promoção explícita, botão Keycloak, exclusivo e recuperação híbrida testados; fixture removida |
| RBAC01 | Grupos locais/membros/grants e revisão409 | Aceito em recortes | Regressão concorrência/remoção/acesso direto+grupos, sem concessão implícita |
| RBAC02 | Acesso efetivo/auditoria/Meu acesso | Aceito em recortes | Fonte direta/grupo e limites conhecidos sem inferência visual |
| RBAC03 | Migração de acessos individuais para grupos | Plano78 e fluxo API original20 em cópia aceitos; automação real/concorrência pendentes | Plano/dry-run/diff/backup e rollback com20 envs sintéticos, sem perda de grants |
| RBAC04 | Identidades externas dinâmicas | Parcial | Tratamento explícito do contrato necessário; não mover gestão de grupos para Keycloak |
| RBAC05 | Contas técnicas e API keys | Parcial24 | Matriz escopo/expiração/revogação/owner e nenhum segredo reexposto |

## F4/F5 — Environments e operação Docker/Cattle

| ID | Entrega/telas | Estado atual | Critério final |
|---|---|---|---|
| ENV01 | Lista/seleção/resumo/criar/editar environments | Aceito em recortes | Matriz templates/bindings/privacidade e zero acesso inicial |
| ENV02 | Templates de environment/infra | Parcial | Repetir bateria completa com origem catálogo/Compose, diferenças e efeitos reais |
| OPS01 | Operação vertical e detalhes stack/serviço/container | Aceito12 | Tudo acessível no contexto, URL/filtros/expansões mantidos |
| OPS02 | Lifecycle/lote/escala/imagem | Aceito em recortes | Matriz estados transitórios/erros parciais; efeito físico por recurso |
| OPS03 | Compose criar/exportar/atualizar stack | Aceito15/34 | Completar opções avançadas, origem/segredos, validação nativa e efeito físico restante |
| OPS04 | Links/aliases/serviços externos/LB | Parcial17/19 | DNS/HTTP de vínculo físico51 aprovado; targets/certificados, health e conflitos de portas restantes |
| OPS05 | Portas/volumes criação e upgrade | Aceito21/29 | Matriz física mount/readOnly/tráfego, não apenas payload |
| OPS06 | Healthcheck TCP/HTTP/quórum criação/upgrade | Configuração aceita38/39; HTTP/recreate físico52 aprovado | TCP/quórum multi-host e upgrade físico restantes |
| OPS07 | Sidecars criação/upgrade/remoção | Configuração40/41, validação55 e físicos56/63 aceitos | Recorte de um host; estabilidade51, migração de dados e variantes finais ainda separados |
| OPS08 | Afinidades criação/upgrade | Configuração43/44; host-label físico67 aceito | Upgrade físico de regras, container-affinity e global/multi-host |
| OPS09 | Memória legível/reserva | Criação46/47 e upgrade/rollback físico58 aceitos | Matriz de demais recursos/OOM restante |
| OPS10 | Capabilities/readOnly/privileged | Criação47 e reset/finish físico58 aceitos | Matriz de privilégios/dispositivos/securityOpt/ulimits conforme schema |
| OPS11 | Recursos CPU/IO/limites avançados | Criação64, upgrade66 e reset físico70 aceitos | Demais limites avançados e matriz de compatibilidade/carga restantes |
| OPS12 | Edição container avulso/recriação | Parcial | Separar campos mutáveis/imutáveis e rever efeito nativo sem prometer PUT impossível |
| OPS13 | Detalhes/grafo/código/estatísticas por tipo | Parcial | Inventário09 confrontado rota/ação/campo por campo, sem lacunas ocultas |

## F6 — Infraestrutura, dados, rede e catálogo

| ID | Entrega/telas | Estado atual | Critério final |
|---|---|---|---|
| INF01 | Hosts/registro/labels/lifecycle | Parcial | Evacuação/desativação e dependências; comandos privados; sem tocar host corporativo |
| INF02 | Registro cloud/driver | Condicional | Driver/lab sintético, credencial privada e cleanup sem custo/recurso residual |
| INF03 | Rede/ipsec e políticas | Recorte11 aceito | Repetição física, conflitos, múltiplos hosts/regras adicionais |
| INF04 | Balanceadores TCP/HTTP/TLS | Parcial | Tráfego real/backend saudável, certificado válido/erro, target/routing/portas |
| DATA01 | Registry/secrets/certificados | Parcial | CRUD por contrato, permissões, uso real e segredo ausente de caches |
| DATA02 | Volumes/mounts/pools | Parcial físico | Dependências/volume em uso/drivers, leitura/escrita e remoção segura |
| DATA03 | Snapshots/backup targets/restore | A executar/condicional | Restore de fixture em destino isolado e checksum, sem tocar dados anteriores |
| CAT01 | Templates/versão/lançamento/upgrade | Recortes aceitos | Clone/sincronização real, falha externa/credencial/ref inexistente, sem configuração fictícia |
| CAT02 | Fontes globais e por environment | Aceito33/36/45 | Delegação/readonly backend; falta clone físico e refresh scoped |
| CAT03 | Drivers de catálogo | A executar/condicional | Contrato/versionamento e execução isolada de driver compatível |

## F7/F8 — Observabilidade, administração e integrações

| ID | Entrega/telas | Estado atual | Critério final |
|---|---|---|---|
| OBS01 | Logs/terminal/métricas no contexto | Aceito em recortes | Regressão buffers/foco/resize/troca environment; dados reais |
| OBS02 | Revogar streams abertos | Parcial | Remover grant/desativar conta/expirar JWT realmente; sockets fechados e backend nega novas sessões |
| OBS03 | Soak no build final | A executar | Heap/buffers/CPU e reconnect medidos; soak histórico não vale automaticamente para build novo |
| ADM01 | Contas locais/perfil/senha/lifecycle | Aceito42 | Fluxo parcial/concorrência, admin OIDC e contas técnicas em matriz final |
| ADM02 | Auditoria/settings/processos/replay | Aceito25/27/28 | Regressão permissões, erros/privacidade e efeitos nativos |
| ADM03 | HA/pools | Monitor aceito31 | Configuração/failover físico é gate distinto da visualização |
| ADM04 | Drivers de máquinas/catálogos | CRUD recorte32 | Provisionamento/reativação e catálogo de drivers compatível |
| INT01 | API keys | Aceito24 | Matriz técnica final e expiração |
| INT02 | Webhooks/receivers | Configuração aceita30 | Entrega real para receptor local sintético, retries/negação, zero envio corporativo |
| HELP01 | Sobre/capacidades/versões/identidade Rancher | Aceito26 | Attribution/licenças/versão do artefato e flags finais coerentes |

## F10 — Entrega e recuperação

| ID | Entrega | Estado | Critério final |
|---|---|---|---|
| REL01 | Migrations banco/config versionadas | Schema offline72/runtime77 e upgrade original20 aceitos; pacote fresco completo pendente | Instalação limpa + atualização de base sintética + idempotência/checksums/rollback |
| REL02 | Backup Rancher DB/estado e Keycloak | DB72, arquivos e engines/login isolados76 aceitos; upgrade/rollback original20 de engine77 aceitos; workloads/compatibilidade completos pendentes | Backup consistente completo e protegido; restaurar em volumes/containers próprios, login/grupos/workloads conferidos |
| REL03 | Rollback de frontend/backend | Parcial | Imagem anterior e configuração/dados compatíveis; aba aberta continua ou recupera com clareza |
| REL04 | Pacote reproduzível | Parcial | Bootstrap/restart de rede57 aceito; lockfiles/imagens/digests/licenças, instalação/upgrade/restore completos e matriz de compatibilidade restantes |
| REL05 | Segurança final | A executar | Rotas/ações/scopes, CSRF/secret/cache/sessão/dependências/exposição revisados, riscos legados explícitos |
| REL06 | Regressão/aceite de release local | A executar | Todos os gates obrigatórios aprovados no mesmo artefato, fixtures limpas e evidência rastreável |

## Atualização comunitária — 04/11/2026

Identidade e distribuição71/74: base Git sanitizada, assinatura comunitária opcional, marca/paleta Rancher e patches reproduzíveis. Migração72: diagnóstico, backup criptografado do banco, ensaio offline com integridade/checksums, migração aditiva/idempotência e rollback aceitos também com20 environments sintéticos. Isso não fecha REL01/02/06: estado Rancher/IdP, integração da migração ao startup/upgrade, login/grants/workloads e aceite unificado continuam pendentes. OBS02: teste73 confirmou entrega em socket aberto após revogação; correção de servidor é prioridade imediata.

## Ordem de execução restante

1. OPS09/10: upgrades de memória49 e segurança50 aceitos em configuração; concluir demais recursos no drawer atual, schema/snapshot, revisão e rollback/finish; depois CPU/dispositivos conforme contrato.
2. OPS06/07/08: saúde/sidecars/afinidades físicos; rede51 e HTTP/recreate52 passaram; sidecar com compartilhamento56 passou e endereços estáveis57 foram validados. Sidecars63 e host-label67 aceitos; restam TCP/quorum, upgrade de afinidades, regras de container/global/multihost; manter gate de estabilidade do scheduler.
3. OPS03/04/11/12/13 e ENV02: fechar inventário funcional Cattle e opções Compose/tipos especiais restantes.
4. INF/DATA/CAT: rede/LB/TLS/armazenamento/clone/sincronização e drivers com fixtures isoladas.
5. AUTH/RBAC/OBS: matriz real de expiração, IdP/logout, administrador OIDC, grants/streams e migração sintética.
6. INT02/ADM03/04: eventos locais e gates administrativos operacionais ainda abertos.
7. UX05/06 + CFG: teclado/a11y/escala e matriz global de flags sobre as telas finais.
8. REL01–06: migração/backup completo/restore/rollback/pacote e bateria final. Voltar a qualquer task cujo teste falhar; não encerrar por contagem de testes.

Cada item começa com contrato/plano, implementa sob flag inicialmente off, passa testes apropriados e integração real, limpa fixtures e atualiza este roadmap/status antes de habilitar. Não repetir aprovação humana para essas operações sandbox já autorizadas. Ausência de infraestrutura compatível deve virar pendência concreta com evidência; não substituir por mock e marcar100%.

## Escopo opcional e conclusão

VMs/Windows, Kubernetes/kubectl, Swarm e Mesos constam do inventário legado, mas F9 permanece condicional e desativado até necessidade e laboratório próprios. Não entram no percentual Cattle; a solução documenta a fronteira e conserva acesso clássico. Se migração desses domínios for exigida, terão roadmap/gates e denominador próprios.

100% do escopo Docker/Cattle exige todos os gates obrigatórios acima, confronto completo do inventário09 e catálogo03, nenhum problema crítico/funcional aberto, evidência de efeitos reais, artefato final reproduzível e recuperação testada. Publicar em produção ou retirar o clássico é decisão posterior, não condição para terminar o desenvolvimento local. O dump real segue adiado; base de20 environments sintéticos será usada no ensaio.

Atualização73: corrigida revogação de token no subscribe UI sob flag independente. Matriz real on/off aprovada no mesmo backend, com HTTP/nova conexão401 e fechamento1000/zero eventos posteriores quando on; contratos Java128+10 e frontend595/70. Compose moderno habilita; default backend/basefalse. Remoção de grant, desativação, expiração, credenciais técnicas e logs/exec ainda não aceitos.

Matriz73 ampliada: retirada de grant próprio, desativação e expiração real local/OIDC passaram no subscribe UI, incluindo limpeza completa e validade restaurada antes da espera. Transporte de logs/exec/métricas, API keys e carga permanecem abertos. Bootstrap75 preserva arquivos existentes e tem4 contratos PlanOnly/template aprovados; importação/instalação fresca ainda não aceita. Próximo: logout federado opcional62.

Atualização62: logout federado opcional passou15 checks,4 cenários reais e8 axe/layout; nenhuma confirmação humana pendente. Retorno/Origin/CSRF/SSO local/IdP indisponível/exclusivo/autologin e replay validados. Flag defaultfalse, configuração restaurada. Cinco contratos de UI passaram a usar2 fixtures de schema sanitizadas versionadas: build do pacote limpo do Git aprovado595/70 no checkpoint4c9e645, sem capturas locais. Build funcional atual605/71 com TypeScript/Vite. Próxima prioridade: backup/restore completo de estado Rancher/Keycloak e limites do preflight72, mantendo OBS02 de logs/exec/métricas e todos os demais gates abertos.

Atualização76 (05/11): backup frio criptografado dos5 volumes/configuração e restauração de arquivos, ownership e modos em volumes novos aprovados;29 testes Python. Fonte retomada com IDs preservados, helpers sem logs/rede e cópias limpas. REL02 permanece parcial até engines/login/grants recuperados, imagens e capacidade/ACL completos.

Atualização76 ampliada:36 testes,4 imagens criptografadas,15 checks de engines recuperados/login local/Keycloak/OIDC-PKCE/zero acesso e checksums de grants passaram. Cópias sem egress/portas/volumes de origem, cleanup e HTTP original aprovados. Não confundir recuperação do mesmo artefato com migração original20envs + rollback de engine, ainda aberta.

Atualização77:001 agora versionada no Git e embarcada no backend; schema flagfalse, lock/checksum/estrutura/índices,9 contratos JDBC e138 configuração aprovados. Engine oficial original20→custom nos mesmos volumes copiados, restart idempotente, checksum corrompido impede startup e rollback por restore original aprovados, com origem preservada. Pacote limpo clona/aplica/checka/builda sem .env/SQL privado; corrigidos ignore indevido do SQL e paths longos do Git no Windows. REL01/02 continuam com limites do laboratório e REL04/06 globais abertos.

Atualização78: planner consistente só leitura,13 testes incluindo50×20 sem expansão, CLI criptografada com origem intacta e fixture DB original20/3users/5grants→2grupos repetida3 restores passaram. Não cria grupos nem retira diretos; regra nativa exige owner direto, preservar recuperação no futuro cutover. API/acesso efetivo/rollback ainda pendentes.

Atualização78 API:35 checks de coexistência/cutover/rollback nativos passaram com matrix60,5 fontes apenas grupo, negação readonly405/admin404 com controles positivos, revogação na sessão e stale revision409. Owner direto preservado e origem intacta; somente laboratório fixo. Não há apply público nem CAS de lista nativa/aceite concorrente. OBS02 logs/exec/métricas segue prioridade de segurança aberta.

Atualização79 baseline: host1h1 retomado sem novo registro; falha real em logs/exec/métricas após revogar sessão UI (HTTP401, novosWS101, sockets abertos e dados/entrada posteriores). Controles saudáveis e cleanup preservou configs/volumes. Guarda Go ainda não implementada. Fonte proxyv0.23.12 compila/testa com Go1.27.3 isolado; prioridade corrigir em flag independente antes do aceite.

## Checkpoint79 — implementação em validação (05/11/2026)

Guarda opcional de logs/exec/métricas implementada em patches Cattle+proxy Go pinados; defaultfalse, prova compacta RS256, revalidação de sessão/conta/role/escopo, renovação privada e encerramento1008. Java143 configuração+26 regras+12 readiness+31 logout+10 writer; testes Go upstream/novos e race, frontend608/71+TypeScript e build Linux aprovados. Pacote limpo do índice clona/aplica/checka os dois upstreams e compila sem artefatos privados; testes Go não usam egress. Console nova publicada somente no laboratório. Backend de laboratório recebeu artefato novo com proteção off, sem alteração de schema. Matriz física on/off e identidades ainda em validação: primeiro off sofreu churn autônomo do scheduler1i956; guardar evidência e não afirmar aceite. OBS02, carga e demais gates48 permanecem abertos. Ver79 para detalhes/limites.


## Checkpoint79 — primeiros controles físicos (05/11/2026)

Baseline off repetido com3 transportes saudáveis confirmou entrega indevida após logout (novosWS101, logs17/exec1/métricas23), fixture/sessões limpas e sem churn nessa repetição. Nova imagem com guarda on passou admin:9 tentativas de assinatura/prova compacta/caminho401, HTTP401 após revogação, novosWS401,3 sockets1008 e zero dados posteriores com3 controles válidos. Remoção de grant de usuário local via grupo member também passou com HTTP404 e os mesmos controles, conta/grupo próprios removidos. OIDC, desativação, expiração e renovação longa continuam em execução/pendentes; não é fechamento de OBS02 nem do roadmap.

A primeira tentativa on falhou fechada porque ApiRequestFilter usa a propriedade Archaius api.ignore.paths, não o parâmetro XML; servia indexHTML200 no callback. Corrigido o defaults.properties e prefixo sem slash final; matrix agora exige403JSON/no-store sem chave interna antes de criar fixtures. Remoções autônomas de scheduler e volumes-root associados são relatadas separadamente; preservação de serviços e containers/volumes de aplicação continua obrigatória. Baseline estrito anterior permanece falho, sem reescrever a evidência. Código/template de migração/DB não alterados por esta correção.


## Checkpoint80 — inventário offline de artefatos (05/11/2026)

CLI plan/scan implementada com Syft1.56.0 por digest, archive pelo ID local, sem rede/socket/restart de apps e com cleanup verificado. Dez contratos e scan real repetido passaram;486 pacotes backend/73 console/209 lockfile+dev, com145/1/0 licenças não identificadas. Projeção CycloneDX exclui arquivos/env/config/metadados desconhecidos e liga hashes dos manifests congelados. Console declara Apache-2.0 nos manifests, coerente com LICENSE. Raw/temp removidos e IDs preservados. REL04 segue parcial: falta revisão de licenças, detecção completa de binários, CVEs/procedência/schema independente e demais gates48. Não converter inventário em aprovação legal/segurança. Matriz79 de seis identidades local/OIDC passou; renovação longa está em execução, ainda sem aceite.

