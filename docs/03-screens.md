# 03 — Catálogo de telas e interações

## Atualização —22/10/2026

CriarStack agora oferece stack vazia/Compose no drawer da operação; arquivos multilinha, variáveis, interpolação e início explícito. CheckboxField põe controle e texto em uma linha, descrição abaixo do texto. Gates e limites nos documentos 15 e 16.

## Checkpoint documental — 21/10/2026

As entradas Stacks/Serviços/Containers compartilham a operação vertical com drawers no mesmo contexto. Logs/terminal permitem escolher container da stack/serviço; menu … oferece lifecycle, imagem, catálogo e escala quando autorizados. Criar stack por editor Compose especializado é planejamento do documento 15, sem implementação. O catálogo de telas abaixo continua escopo alvo, não comprovação de entrega de todas as telas.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


Todas as rotas abaixo são **propostas para a UI nova**, salvo quando a coluna clássica indicar a origem. Nenhuma linha significa que a tela já foi migrada. Os caminhos de recursos clássicos são relativos ao prefixo do environment, quando indicado. O inventário de declarações reais está no documento 09.

Todas as telas autenticadas usam AppShell. Login e retorno de autenticação usam AuthLayout. Os estados loading/empty/error/forbidden e o suporte a tema são obrigatórios em todas.

## Autenticação e acesso inicial

| ID / tela | Conteúdo e funções | Interações e estados | Controle |
|---|---|---|---|
| AUTH-01 — Login | Logo comunidade, referência Rancher, botão corporativo, ajuda curta; formulário local somente no modo híbrido | Login, senha oculta, erro acionável, envio em andamento; nenhum link de recuperação inexistente | OIDC enabled / only / auto; módulo de login moderno |
| AUTH-02 — Retorno OIDC | Estado “Concluindo login”; troca única do ticket pela sessão Rancher | Ticket inválido/expirado permite reiniciar; não precisa de F5; não expõe código/token na UI | OIDC e login moderno |
| AUTH-03 — Sessão expirada / logout | Mensagem e retorno ao login; preservação apenas de destino interno permitido | Logout explícito não inicia ciclo infinito de autologin; callback de erro não se repete automaticamente | Política de sessão |
| ACCESS-01 — Sem acesso | Usuário autenticado, estado pendente e orientação para inclusão em grupo | Verificar novamente; sair/trocar conta; sem criação de environment, sem menus operacionais acessíveis | Tela de acesso pendente; regra de autorização independente |
| ACCESS-02 — Proibido / recurso ausente | Distingue ausência de permissão de falha técnica sem revelar recurso de outro environment | Voltar para rota válida; contexto do shell preservado | Módulo da rota e regra comum |

### UX de login

Modo híbrido: botão OIDC em destaque, separador e formulário local. Modo OIDC exclusivo: somente botão OIDC e textos de contexto; backend também rejeita senha local. Modo automático: inicia navegação completa para o backend OIDC; mantém uma saída controlada para logout explícito e falha. Marca e componentes são os mesmos nos três modos.

## Environments

| ID / tela | Conteúdo e funções | Modais / modernização | Origem e fase |
|---|---|---|---|
| ENV-01 — Lista | Nome, estado, orquestrador e acesso do usuário quando comprovado; busca, filtros, seleção de environment | Ação “Abrir”; criar somente se autorizado; estado vazio administrativo diferente de usuário sem acesso | `settings.projects`; fase 4 |
| ENV-02 — Visão do environment | Resumo de hosts, serviços, containers e problemas reais; navegação para recursos | Seleção global persistente; cards e indicadores sem contagens fictícias | `authenticated.project`; fase 4 |
| ENV-03 — Criar / editar | Nome, descrição, template, configurações existentes e acesso conforme permissões | Fluxo por seções; revisão do payload; confirmação para mudanças com impacto | `settings.projects.new/detail`; fase 4 |
| ENV-04 — Templates | Lista, detalhe, configuração de stacks de infraestrutura, visibilidade e versões | Formulário reutilizável; revisar diferença antes de alterar um template usado | `new-template/edit-template`; fase 4 |

## Grupos, usuários e acesso

| ID / tela | Conteúdo e funções | Modais / modernização | Fase |
|---|---|---|---|
| GROUP-01 — Lista de grupos | Nome, quantidade de membros, quantidade de environments, resumo de papéis; busca; ação principal única “Criar grupo” | Tabela consistente; editar pelo nome/menu; vazio com instrução. Não carregar um formulário enorme ao lado da lista | 3 |
| GROUP-02 — Editor de grupo | Nome; abas Membros e Environments; resumo de alterações; permissões persistidas no backend | Drawer compartilhado com largura responsiva, footer fixo Salvar/Cancelar e proteção de alterações não salvas | 3 |
| GROUP-03 — Seleção de membros | Buscar pessoas; selecionados visíveis; contador; adicionar/remover em lote dentro do formulário | MultiSelect compartilhado; não depender de uma linha de checkboxes que cresce sem limite. Usuários OIDC aparecem após primeiro login nesta fase | 3 |
| GROUP-04 — Permissões por environment | Busca por environment; selecionar quais recebem acesso; papel explícito por environment | Selecionar environment começa em Read Only; nada selecionado significa sem grant. Trocar papel mostra descrição. Não aplicar automaticamente a todos | 3 |
| GROUP-05 — Acesso efetivo | Usuário, environment, grants por grupo e diretos, papel resultante e origem | Drawer de diagnóstico; depende de endpoint confiável de acesso efetivo. Não inferir “RBAC completo” apenas pela UI | 3, após contrato backend |
| USER-01 — Lista de usuários | Nome, tipo, estado, origem comprovada e acesso a detalhe; busca e filtros | Usuários locais/OIDC diferenciados somente com informação validada. Ações administrativas não ficam disponíveis ao próprio usuário comum | 3/8 |
| USER-02 — Detalhe / gerenciamento | Dados da conta, grupos, acesso efetivo e ações de ativação/desativação | Incluir/remover grupo com impacto visível; alteração de privilégio global é separada de acesso ao environment | 3/8 |
| USER-03 — Conta local / administração | Criação/edição local apenas quando permitida e necessária à operação | Senha e tipo com validação própria; não anunciar convite ou recuperação por e-mail sem backend | 8 |

### Fluxo de grupos

1. Abrir lista e criar/editar grupo.
2. Informar nome e selecionar membros com busca.
3. Selecionar environments e o papel de cada um.
4. Revisar resumo: membros adicionados/removidos e ambientes/papéis alterados.
5. Salvar uma vez. Em erro, preservar tudo. Em conflito de revisão, oferecer recarregar sem sobrescrever silenciosamente.
6. Atualizar tabela e contagens após confirmação do servidor. Retirada de membro/grupo altera novas requisições na sessão existente.

## Recursos Docker / Cattle

| ID / tela | Conteúdo e funções | Modais e UX | Origem / fase |
|---|---|---|---|
| STACK-01 — Stacks | Lista por nome, estado, tipo e tags; busca/filtros; ações autorizadas | Criação/edição, exportação e confirmação de remoção; ações em lote somente com feedback por item | `/apps/stacks`; 5 |
| STACK-02 — Stack | Serviços, estado, containers, código, grafo e métricas existentes | Abas com URLs próprias; código e diff; grafo acessível com alternativa em tabela | `stack.index/code/graph/chart`; 5 |
| SERVICE-01 — Serviço | Containers, labels, portas, links, logs, regras de balanceamento e certificados conforme tipo | Abas compartilhadas; criar/editar; escala; upgrade/rollback com revisão e estados assíncronos | `service.*`; 5 |
| SERVICE-02 — Criar serviço | Container, alias, serviço externo e balanceador como tipos distintos | Wizard com campos comuns e seções específicas; validação de portas, links e certificados. Não enviar campos de um tipo para outro | `service.new*`; 5 |
| CONTAINER-01 — Containers | Nome, estado, imagem, host, stack/serviço, consumo quando disponível; busca e filtros | Start/stop/restart por capacidade; ação em lote com resultados individuais; remoção contextualizada | `/infra/containers`; 5 |
| CONTAINER-02 — Detalhe | Portas, volumes, labels, comando, rede, healthcheck, scheduling e segurança | Resumo útil primeiro; abas com dados reais; ações consistentes com a listagem | `container.*`; 5 |
| CONTAINER-03 — Criar / editar | Imagem, recursos, portas, env vars, volumes, rede, scheduling e permissões existentes | Formulários por seções; defaults documentados; campos secretos mascarados; revisão antes de criar | `containers.new/edit-container`; 5 |
| HOST-01 — Hosts | Estado, recursos, labels e capacidade; busca, filtros e detalhe | Adicionar host e ações existentes, sem execução automática a partir de recomendações da UI | `/infra/hosts`; 6 |
| HOST-02 — Host | Containers, portas, armazenamento e labels | Editar labels/configuração; evacuar/desativar/remover com impacto explícito | `host.*`; 6 |
| HOST-03 — Adicionar host / driver | Fluxos existentes de registro e cloud drivers | Credenciais separadas do estado de formulário comum; comandos de registro tratados como segredo | `hosts.new`, admin machine; 6/8 |

## Dados, rede e catálogo

| ID / tela | Conteúdo e funções | Modais e UX | Origem / fase |
|---|---|---|---|
| DATA-01 — Volumes / pools | Lista, capacidade/estado quando disponíveis, vínculos e detalhe | Criar volume/pool; proteger volume em uso; remoção com dependências explícitas | `storagepools.*`; 6 |
| DATA-02 — Backup targets | Targets e configuração existentes | Adicionar/editar/remover e validar campos; não executar restore implicitamente | `backuptargets.*`; 6 |
| DATA-03 — Registries | Registry, estado e credenciais autorizadas | Credenciais mascaradas e atualização separada; erro de autenticação acionável | `registries.*`; 6 |
| DATA-04 — Secrets | Nome/metadados e uso autorizado | Criar/editar se suportado; não listar valor secreto em tabela, log, URL ou toast | `secrets.*`; 6 |
| DATA-05 — Certificados | Metadados, validade e referências | Upload/edição com validação; chave privada não reaparece em detalhe comum | `certificates.*`; 6 |
| CATALOG-01 — Catálogo | Busca, filtros, detalhes e versões de templates disponíveis | Página de detalhe e configuração de lançamento; indicar quando catálogo externo está indisponível | `catalog-tab.*`; 6 |
| NETWORK-01 — Balanceamento / links | Port rules, targets, aliases, certificados e vínculos conforme serviço | Editor de regras reutilizável; conflito de portas/targets apresentado por campo | `service.port-rules/links/certificates`; 5/6 |

## Observabilidade, integrações e administração

| ID / tela | Conteúdo e funções | Modais e UX | Origem / fase |
|---|---|---|---|
| OBS-01 — Logs | Fonte, timestamps, busca local, pausa/retomada e download quando autorizado | Viewer com buffer limitado; desconexão e fim de stream explícitos; escopo preservado | `container-log`, `service.log`; 7 |
| OBS-02 — Console / exec | Sessão, recurso, environment e estado de conexão | Terminal com foco, resize, saída e encerramento; revogação e autenticação testadas | `console`, `container-shell`; 7 |
| OBS-03 — Métricas | Séries existentes, período e unidade, estado de indisponibilidade | Gráficos com rótulos e alternativas legíveis; sem eixo ou agregação que distorça o dado | `stack.chart`, host/container stats; 7 |
| ADMIN-01 — Auditoria | Ator, ação, recurso, environment, resultado e data; filtros | Detalhe em drawer; campos sensíveis sanitizados; auditoria de grupos evolui para antes/depois | `/admin/audit-logs`; 8 |
| ADMIN-02 — Configuração | Settings existentes, busca e indicação de impacto | Editar setting com valor anterior/novo; diferenciar alteração de configuração e ação operacional | `/admin/settings`; 8 |
| ADMIN-03 — Autenticação / capacidades | Modo ativo, estado de configuração e indicação do que vem do Compose | Valores de segredo não retornam ao frontend. Configuração por variável aparece como somente leitura | `/admin/access`; 2/8 |
| ADMIN-04 — Processos / HA | Processos, pools, detalhe de falha e configuração HA existente | Retry/replay somente quando permitido; alteração HA com validação própria | `/admin/processes`, `/admin/ha`; 8 |
| API-01 — Chaves de API | Escopo, titular e estado; criação/revogação autorizadas | Segredo mostrado uma vez; copiar com feedback; revisar efeito da revogação | `/api/keys`; 8 |
| API-02 — Webhooks | Receivers, estado e configuração | Criar/editar com validação; não enviar evento externo ao apenas abrir preview | `/api/hooks`; 8 |
| PREF-01 — Aparência | Tema claro/escuro/sistema, densidade e preferência de navegação quando habilitadas | Preview e restauração do padrão; restrições definidas pelo administrador | Novo; 1 |
| HELP-01 — Sobre / ajuda | Rancher, versão base, versão da customização e links úteis | Dialog “Sobre” compartilhado, sem sugerir endosso oficial da customização | `help`, modal-about; 1/8 |

## Módulos opcionais, sem ativação presumida

VMs, console/log de VM, Windows, Kubernetes/kubectl/dashboard, Swarm e Mesos existem nos fontes. Serão inventariados e mantidos na UI clássica. A migração de cada um depende de uso real e ambiente de teste compatível; flags ficam desativadas por padrão. Remover do menu moderno não remove recursos ou suporte do backend.

## Catálogo de modais / drawers reutilizáveis

| ID | Uso | Regras |
|---|---|---|
| DLG-01 — Editor de grupo | GROUP-02/03/04 | Abas, resumo, footer fixo, revisão e salvamento único. |
| DLG-02 — Acesso efetivo | GROUP-05/USER-02 | Somente dado confirmado pelo backend; mostra origem do grant. |
| DLG-03 — Confirmação de exclusão | Grupos e recursos removíveis | Nome, escopo, dependências e efeito; excluir grupo não exclui usuários. |
| DLG-04 — Alterações não salvas | Todos os formulários | Voltar a editar ou descartar; não perguntar após salvar com sucesso. |
| DLG-05 — Operação em lote | Stacks/containers/hosts quando permitido | Lista de alvos, validação e resultado por item; falha parcial não vira “sucesso”. |
| DLG-06 — Stop / evacuar / desativar | Containers/hosts | Impacto e opções reais do backend; operação sintética no laboratório. |
| DLG-07 — Upgrade / rollback | Serviços/stacks | Configuração, diff, estratégia e estado assíncrono. |
| DLG-08 — Configuração / segredo | Settings, registry, certificados e secrets | Campos sensíveis mascarados; erros por campo; sem log de payload secreto. |
| DLG-09 — Detalhe de auditoria / erro | Auditoria/processos/erros | Texto sanitizado, copiar dados seguros, correlação e contexto. |
| DLG-10 — Tema / perfil / sobre | Preferências e ajuda | Mesmo componente em todas as rotas; restauração de preferência sem apagar outras configurações. |

Modais não são uma alternativa para colocar formulários extensos sem organização. Wizards e páginas de detalhe serão usados quando houver várias decisões dependentes ou necessidade de URL compartilhável.

## Atualização de entrega — 22/10

ADMIN-01 (doc25), ADMIN-02 edit/reset (28), ADMIN-03 capacidades somente leitura (26), ADMIN-04 processos/replay sem HA (27), API-01 (24), API-02 CRUD receivers sem invocação (30) e HELP-01 Sobre/marca (26) implementados e validados no recorte descrito. Portas/volumes também podem ser alterados no drawer de upgrade (29), preservando contexto. Não equivale a concluir HA/drivers, todos os campos legados ou gates físicos.

## Telas/fluxos adicionados em 23/10

Drivers administrativos e repositórios globais de catálogo: docs32–33. Na operação de stacks Compose próprias, Atualizar stack abre exportação/edit/revisão no mesmo drawer, com rollback/finish nativos e contexto mantido (34). Configuração global de catálogo difere da lista de templates e não comprova clone remoto.

Criação de serviço/container tem seção Saúde reutilizável TCP/HTTP/tempos/estratégia/quórum (38). Upgrade existente passa a oferecer opt-in de saúde mantendo imagem/portas/volumes, com revisão de impacto e ações rollback/finish na mesma operação (39, gate nativo em andamento).

Sidecars na criação de serviço: grupos por container com nome/imagem e as mesmas seções de rede/volumes/saúde/segurança, adicionar/remover sem JSON manual; flag independente e payload nativo. Doc40.
