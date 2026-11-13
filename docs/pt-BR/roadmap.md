# Roadmap do produto

<!-- rancho-language-navigation:start -->
[Português (Brasil)](roadmap.md) | [English](../en/roadmap.md)
<!-- rancho-language-navigation:end -->


## Escopo e aceite

O alvo é Rancher1.6 Docker/Cattle operado por console contextual comum, grupos locais/OIDC opcionais e migração recuperável. O projeto está em desenvolvimento, sem certificação produtiva. Função implementada em recortes testados não encerra fase inteira. Contagem de testes não mede paridade.

Estados descrevem capacidades mantidas e aceites restantes, não diário de execução. Preserve IDs ao abrir issues/PRs. Mudanças exigem flag/default/off explícitos, contratos atuais, testes pertinentes, docs nos dois idiomas e cleanup. Aceite dependente de provedor pode ser condicional; não substitua prova física por mock para marcar conclusão.

## Fundação e experiência

| ID | Capacidade | Estado e gate restante |
|---|---|---|
| UX01 | Shell, marca, navegação, seletor, login/sem-acesso | Implementado; as ações do cabeçalho compartilhado quebram linha em telas estreitas. O teste no navegador cobre as 21 rotas principais do menu em inglês e persa, a 320 e 390 px. Falta regressão final de rotas e temas |
| UX02 | Tabelas, filtros, seleção, menus, drawers, revisão/rascunhos | Recortes implementados. O teste mobile do menu de Operações e do painel de detalhes verifica ações desabilitadas e retorno de foco pelo teclado. Falta a matriz restante de teclado, erro parcial e contexto |
| UX03 | Tokens de tema e overrides | Implementado; conferir contraste efetivo nas rotas finais |
| UX04 | Recuperação de chunks/abas antigas e retenção de assets | Abas antigas carregaram os chunks originais durante upgrade e rollback isolados do frontend. Um novo documento carregou a imagem restaurada. Falta o aceite final no artefato e na topologia de release |
| UX05 | Acessibilidade manual/leitor de tela | O candidato fixado passou em 24 verificações axe, cobrindo seis rotas administrativas em duas larguras e nos dois temas. Falta o aceite manual de teclado e leitor de tela nos fluxos críticos |
| UX06 | Alto volume/performance | Limites gzip no build e benchmark sintético de inventário no navegador disponíveis. Latência, heap e renderização medidos em 20 ambientes com 2.000 containers cada. A paginação opcional limita a lista plana de Containers a 50 linhas renderizadas e preserva a busca e a seleção no inventário completo. A árvore de workloads reutiliza um índice de containers por serviço durante a montagem. A paginação opcional limita Stacks e Serviços expandidos a 100 linhas de recursos e até dois cabeçalhos de contexto, preservando a árvore. Um teste sintético de dois minutos verificou atualizações periódicas e recuperação automática. Faltam medir a latência do backend real sob carga e definir os critérios finais de release |
| CFG01 | Flags frontend/backend e fallback clássico | O CI de código-fonte verifica 64 combinações. O par Docker fixado passou pela ativação, desativação e reativação da customização nos mesmos volumes de banco, com fallback clássico, registro de migração intacto e recuperação do proxy. Cópias restauradas separadas validaram as políticas híbrida e de OIDC exclusivo. Falta cobrir as demais interações entre flags em execução |
| CFG02 | Configuração versionada | Contrato/CLI implementados; rollback de artefato/dados pertence ao aceite de release |

## Idiomas da interface e paridade com o Rancher original

O console usa pt-BR por padrão. Prévia opcional localiza shell, login/sem-acesso, controles comuns e recuperação contextual em pt-BR/en-US; a extração completa de páginas/validações segue pendente. Documentação bilingue do projeto não fornece localização da interface. A referência é o [Rancher server v1.6.30](https://github.com/rancher/rancher/blob/v1.6.30/server/Dockerfile), que seleciona a UI1.6.52. Seu [catálogo de traduções](https://github.com/rancher/ui/tree/v1.6.52/translations) e a [descoberta de locales](https://github.com/rancher/ui/blob/v1.6.52/config/environment.js) definem o inventário de idiomas de produção abaixo. O locale diagnóstico `none` fica fora da produção; arquivos de tradução existentes não comprovam que toda mensagem original estava traduzida.

| Locale original | Locale alvo do console | Idioma | Direção |
|---|---|---|---|
| en-us | en-US | Inglês | LTR |
| pt-br | pt-BR | Português (Brasil) | LTR |
| de-de | de-DE | Alemão | LTR |
| fr-fr | fr-FR | Francês | LTR |
| hu-hu | hu-HU | Húngaro | LTR |
| ja-jp | ja-JP | Japonês | LTR |
| fa-ir | fa-IR | Persa | RTL |
| ru-ru | ru-RU | Russo | LTR |
| uk-ua | uk-UA | Ucraniano | LTR |
| zh-hans | zh-Hans | Chinês simplificado | LTR |

| ID | Capacidade | Estado e gate restante |
|---|---|---|
| I18N01 | Infraestrutura comum de locale, mensagens e formatação | Contrato/provider compartilhados implementados com domínios tipados, fallback, plurais e Intl nativo; adoção/performance na interface inteira segue no aceite da extração; sem substituir texto no DOM nem traduzir identificadores da API |
| I18N02 | Configuração e seletor compartilhado de idioma | Política opt-in/default/off, seletor público/autenticado, persistência por conta/anônima, negociação com navegador e troca no lugar implementadas; falta regressão final com streams abertos/todos os locales; catálogos incompletos exigem preview explícito |
| I18N03 | Extração completa pt-BR/en-US | Parcial. Layouts compartilhados, autenticação, operações de workloads, páginas de recursos e infraestrutura, administração de acesso e servidor, páginas de catálogo e webhooks, controles de atualização e painéis de observabilidade usam mensagens registradas. Foram localizados os erros de portas e volumes, criação e escala de workloads e métricas de serviço, além dos rótulos comuns de ciclo de vida e saúde do Rancher. Filtros e ações mantêm os valores nativos dos estados. Grupos, usuários e diagnóstico de acesso traduzem os papéis conhecidos de environment e preservam os valores de permissão do Rancher. A validação de configurações, chaves de API e drivers também acompanha o idioma ativo. Falhas de requisições de chaves de API exibem o status HTTP sem o texto da resposta. Erros de validação de contas locais, repositórios e templates de catálogo, auditoria, processos, balanceadores, políticas de rede, recursos de dados e webhooks usam mensagens registradas. Mensagens compartilhadas de escopo, endereços de API rejeitados, paginação inválida e falhas HTTP sem mensagem do servidor acompanham o idioma ativo. Faltam extrair os demais editores e mensagens de validação dos helpers e verificar a cobertura de todas as rotas. Preserve valores nativos dos recursos e comandos técnicos |
| I18N04 | Outros oito idiomas de produção | Parcial. Os oito idiomas adicionais têm prévias para autenticação, controles compartilhados, navegação do shell, estados comuns de recursos, papéis de environment e painéis de detalhes, logs, terminal e métricas. Operações, ações em lote e topologia de serviços incluem confirmações, resultados, controles do grafo e instruções de teclado. Os painéis de recursos traduzem criação, avisos de somente leitura e rascunhos. As mensagens compartilhadas de API cobrem mudanças de contexto, recursos inacessíveis, endereços bloqueados e erros de paginação. Os editores de workloads traduzem CPU, I/O, capabilities, limites de processos e memória, afinidades de agendamento e verificações de saúde, incluindo a validação das verificações. Portas e volumes, mapeamento e atualização de dispositivos e seletores de labels também estão traduzidos. Atualizações de serviços e stacks via Compose incluem formulários, confirmações e validação de workloads localizados. Os inventários de stacks, serviços e containers incluem filtros traduzidos e pluralização independente de cada contagem do resumo. Os formulários de memória, processos e Compose traduzem as validações. Os formulários de schema traduzem rótulos e ações predefinidos, descrições de seções e validações do console. Páginas de recursos, orientações de provisionamento do environment e painéis de credenciais de registry também usam os catálogos em prévia. A edição de grupos, o histórico de auditoria e o diagnóstico de acesso efetivo traduzem origens de acesso, avisos e controles de revisão. A gestão de usuários e os diálogos de contas locais traduzem a validação de perfil e credenciais e os efeitos das ações de ciclo de vida. Chaves de API e webhooks traduzem escopo, revisão, tratamento de credenciais e validação. O inventário de hosts, o registro de hosts Docker e o monitoramento do engine traduzem estados, avisos e contadores. Configurações do servidor, execuções de processos e auditoria traduzem validações, avisos de operação e filtros. O catálogo de aplicações e os editores de repositórios traduzem validações de templates, configuração de fontes Git e escopo por ambiente. Todas as mensagens registradas estão disponíveis nos oito catálogos de prévia, incluindo infraestrutura e informações da instância. Faltam revisão linguística e verificação em todas as rotas |
| I18N05 | RTL e apresentação multilingue | Parcial. O login cabe a 320 e 390 px nos oito idiomas de prévia. O login em persa espelha os painéis no desktop e respeita a direção do texto no nome de usuário. A navegação lateral autenticada, o seletor de environment e os drawers seguem a direção ativa no desktop e no mobile. Foco por teclado e Escape foram verificados na navegação móvel. Os ramos da árvore de workloads e os indicadores recolhidos seguem RTL. Fontes e prévias Compose, logs, terminal e valores de portas e volumes, valores de chaves de API e URLs de invocação de webhooks e URLs e refs de repositórios Git usam direção LTR explícita. O título de Operações e o contexto da stack quebram identificadores longos no mobile. A barra da árvore e o total de métricas acompanham a direção da página. Falta a regressão completa de teclado, mobile e temas |
| I18N06 | Contribuição de traduções e gates de release | O CI verifica chaves registradas, parâmetros, plurais e mudanças no texto de origem. O build aplica limites gzip e mantém cada catálogo de prévia fora do grafo de imports iniciais. O Chromium verificou carregamento sob demanda, preservação do rascunho e continuidade no idioma ativo quando um catálogo falhou. Faltam extração completa, cobertura offline e regressão final de streams em todos os idiomas |

Implementar primeiro o contrato compartilhado, depois configuração/seleção e cobertura completa pt-BR/en-US, os demais catálogos, RTL e regressão final. Idiomas parcialmente traduzidos ficam fora do seletor normal de produção até o aceite de cobertura e revisão. Inventário, seletor ou fallback isolados não concluem suporte multilingue. Estas tasks fazem parte do aceite de release, não são domínio opcional; não exigem alterar Ember clássico nem traduzir nomes de workloads, logs, campos Compose/API ou páginas externas do IdP. A documentação continua mantida em pt-BR e inglês; paridade de interface não promete dez traduções da documentação.

## Identidade e autorização

| ID | Capacidade | Estado e gate restante |
|---|---|---|
| AUTH01 | Local/OIDC, callback, exclusivo/autologin/sem-acesso | Duas restaurações do mesmo backup validaram as políticas híbrida e exclusiva. O Chromium verificou login pelo Keycloak, navegação automática, retorno sem atualização manual, recarga da tela sem acesso, saída, ticket inválido e redirecionamento interrompido. A reversão restaurou o login local e as permissões de grupo. Um build local do console retornou o leitor ao caminho, ao environment e ao fragmento solicitados em Stacks após login real pelo Keycloak. Faltam as demais combinações de sessões e links diretos |
| AUTH02 | Conta/perfil global atuais | Implementado; falta regressão técnica final; reset de senha não revoga JWT sozinho |
| AUTH03 | Expiração criptográfica | HTTP local/OIDC e streams UI validados em recortes; faltam caminhos técnicos/ociosidade/carga completos |
| AUTH04 | Logout federado/falha do IdP | Recortes implementados; manter regressão sem loops/fallback local no exclusivo |
| AUTH05 | Administrador OIDC e recuperação | Promoção explícita/recuperação híbrida implementadas; repetir no candidato de release |
| RBAC01 | Grupos/membros/grants/conflitos de revisão | Implementado; falta regressão final concorrência/remoção/diretos+grupos |
| RBAC02 | Acesso efetivo/auditoria/Meu acesso | Implementado; preservar atribuição da fonte e limites de prioridade |
| RBAC03 | Migração de diretos para grupos | Planner readonly e API sintética isolada validados; faltam apply público, exclusão/CAS e automação segura contra drift |
| RBAC04 | Identidades externas dinâmicas | Parcial; falta contrato efetivo por provedor |
| RBAC05 | Contas técnicas/API keys | Guardas pessoais/compartilhadas de host validadas sob flags; faltam subscriptions/agentes técnicos e compatibilidade completa |

## Environments e operação de workloads

| ID | Capacidade | Estado e gate restante |
|---|---|---|
| ENV01 | Listar/selecionar/resumir/criar/editar environments | Recortes implementados; falta matriz final templates/bindings/privacidade/sem-acesso |
| ENV02 | Templates de environment/infra | Parcial; falta matriz completa de origem catálogo/Compose e efeitos nativos |
| OPS01 | Operação vertical stack/serviço/container | Implementado; preservar contexto, URL/filtros/expansões |
| OPS02 | Lifecycle/lote/escala/imagem | Recortes implementados; falta matriz final estados transitórios/erro parcial/efeito nativo |
| OPS03 | Compose criar/exportar/upgrade | Recortes implementados; faltam opções avançadas, origens/secrets e efeitos nativos restantes |
| OPS04 | Links/aliases/externos/LB | Parcial; faltam targets/certificados/saúde/conflitos de portas completos |
| OPS05 | Portas/volumes em criação/upgrade | Recortes implementados; falta matriz completa mount/readOnly/tráfego/multi-host |
| OPS06 | Healthcheck TCP/HTTP/quórum | HTTP/recreate/configuração validados; faltam TCP/quórum/multi-host e upgrades físicos restantes |
| OPS07 | Sidecar criar/upgrade/remover | Rede/volume compartilhados e upgrades em um host validados; faltam migração de dados, variantes e estabilidade nativa |
| OPS08 | Afinidades criação/upgrade | Host-label validado; faltam container/global/multi-host e upgrades físicos restantes |
| OPS09 | Memória/reserva | Criação/upgrade/rollback validados em recortes; falta matriz de recursos/OOM restante |
| OPS10 | Capabilities/readOnly/privileged/opções de segurança | Reset/finish de capabilities/readOnly e criação com dispositivos validados, incluindo mapeamentos independentes no principal e no sidecar em um host. Upgrade, reversão, conclusão e remoção de dispositivos da configuração principal verificados pelo console com escala zero e por substituição nativa em um host Docker. Criação nativa com no-new-privileges verificada no processo com controle equivalente. Upgrade, reversão, conclusão e remoção independente de dispositivos em sidecar verificados pelo console com escala zero e por substituição nativa em um host Docker. O mapeamento principal foi preservado na substituição dos dois containers. Faltam múltiplos hosts, outras opções de segurança e variantes de privilégios |
| OPS11 | CPU/IO/limites de processo | CPU/IO e nofile criar/upgrade/rollback/reset em um host validados, incluindo sidecar independente; faltam outros limites/carga/compatibilidade |
| OPS12 | Editar/recriar container avulso | O Chromium editou nome e descrição pelo menu de Operações. O schema nativo expôs apenas esses campos para edição, e o Docker confirmou que o mesmo container continuou rodando com a mesma imagem. Falta a recriação nativa para alterações de campos imutáveis |
| OPS13 | Detalhes/grafo/código/estatísticas por tipo | Parcial; métricas por réplica implementadas, falta inventário completo de tipos/campos/ações |

## Infraestrutura, dados e catálogos

| ID | Capacidade | Estado e gate restante |
|---|---|---|
| INF01 | Registro/labels/lifecycle de hosts | Parcial; faltam evacuação/desativação/dependências |
| INF02 | Registro cloud/driver | Condicional a provedor isolado compatível e cleanup exato de credenciais/recursos |
| INF03 | Rede/IPsec/políticas | Parcial; faltam conflitos físicos/multi-host/regras adicionais |
| INF04 | Balanceadores TCP/HTTP/TLS | Parcial; faltam tráfego real, certificado/erro, targets/rotas/portas |
| DATA01 | Registries/secrets/certificados | Parcial; falta matriz completa CRUD/permissão/uso real/privacidade |
| DATA02 | Volumes/mounts/pools | Cobertura nativa parcial; faltam dependências em uso/drivers/remoção segura |
| DATA03 | Snapshot/backup target/restore | Planejado/condicional; exige destino isolado e checksum |
| CAT01 | Template/versão/lançamento/upgrade | Recortes implementados; faltam clone/sync reais e falha remota/ref/credencial |
| CAT02 | Fontes globais/por environment | CRUD/delegação implementados; falta refresh/clone físico no escopo |
| CAT03 | Drivers de catálogo | Planejado/condicional; exige execução compatível/versionada |

## Observabilidade, administração e integrações

| ID | Capacidade | Estado e gate restante |
|---|---|---|
| OBS01 | Logs/terminal/métricas contextuais | Recortes reais implementados; falta regressão final foco/resize/buffer/environment |
| OBS02 | Revogar streams abertos | UI/API keys pessoais e compartilhadas de host validadas em recortes; faltam caminhos técnicos e regressão final |
| OBS03 | Soak do build final | Testes nativos de seis minutos verificaram a reconexão do host e cinco streams concorrentes no navegador com uma imagem do console e um host legado. Logs, terminal e métricas de host, container e serviço rodaram juntos com histórico CSV limitado e limpeza confirmada. As métricas de serviço foram ativadas no navegador de teste. Falta o aceite com flags servidas e topologia final |
| ADM01 | Contas locais/perfil/senha/lifecycle | Implementado; falta matriz final concorrência/admin OIDC/técnicos |
| ADM02 | Auditoria/settings/processos/replay | Recortes implementados; falta regressão final permissão/privacidade/erro/efeito nativo |
| ADM03 | HA/pools | Monitor implementado; falta configuração/failover físico |
| ADM04 | Drivers de máquinas/catálogos | CRUD implementado; falta provisionamento/reativação isolados |
| INT01 | API keys | Gestão implementada; falta aceite técnico completo de escopo/expiração |
| INT02 | Webhooks/receivers | Configuração implementada; faltam entrega local real/retries/negação |
| HELP01 | Sobre/capacidades/versão/atribuição | O console fixado exibiu no Chromium as versões do produto e da base Rancher, a marca Rancher, a licença Inter igual à do código-fonte e os rótulos de capacidades OIDC/RBAC. Falta conferir a configuração final e os valores das capacidades |

## Entrega e recuperação

| ID | Capacidade | Estado e gate restante |
|---|---|---|
| REL01 | Migrações versionadas de banco/config | Schema aditivo/runtime e engine original sintético validados; boot isolado com imagens locais verificou schema e reinício idempotente. Faltam o aceite do pacote final e o bootstrap federado |
| REL02 | Backup/recuperação Rancher/IdP completos | Captura a frio e restauração isolada de Rancher e Keycloak confirmaram login local e federado, preservação das contagens de inventário e permissões e acesso zero no primeiro login federado. Os recortes de recuperação de banco, estado e imagens criptografadas foram testados. Falta o aceite de workloads, armazenamento e topologia final |
| REL03 | Rollback frontend/backend | Rollback isolado do frontend verificou abas antigas, configuração compatível e retenção de assets imutáveis. Um ensaio sintético separado com 20 ambientes restaurou o backend e o banco originais e preservou o laboratório em execução. O Chromium validou login clássico, lista de ambientes e revogação da sessão no candidato e no original restaurado. Faltam aceite de workloads, armazenamento e topologia final |
| REL04 | Distribuição reproduzível | Pins, lockfiles, CI de código-fonte e instalação limpa verificados. Duas execuções do inventário offline no par fixado de backend e console e no lockfile produziram os mesmos hashes de documento e grafo. Faltam revisão de licenças das dependências, proveniência, topologia final e revisão de segurança |
| REL05 | Segurança final | Parcial. O gateway Nginx aplica no-store às respostas de API e OIDC que encaminha. O teste local cobre recusas anônimas, a resposta de token, leituras autenticadas, revogação da sessão e assets estáticos imutáveis. A matriz local verifica sessões de administrador, leitor e usuário OIDC sem acesso, isolamento de projetos, reutilização de tickets e requisições com cookie de outra origem. Faltam a cobertura final de segredos, as demais rotas e ações e a revisão das dependências da imagem |
| REL06 | Aceite local de release | Ensaio Docker validou instalação limpa e rollback do frontend com o mesmo ID de imagem candidata e confirmou a remoção dos recursos temporários. Um ensaio sintético separado validou upgrade e rollback de backend e banco com o ID do backend do mesmo par candidato. As demais verificações obrigatórias ainda precisam de evidência em um único artefato de release |

### Segurança das imagens para a beta

Beta bloqueada por achados na imagem legada. A varredura Trivy da imagem do backend do laboratório encontrou 30 ocorrências críticas e 88 altas por pacote e aviso e identificou o Ubuntu 14.04 como fora de suporte. Jackson Databind 2.5.3 concentrou 19 ocorrências críticas. A imagem existente da console teve 3 ocorrências críticas e 73 altas, e a imagem local do Keycloak teve 8 críticas e 101 altas. Esses resultados das imagens são separados da auditoria do lockfile de produção da console. Verifique os componentes afetados e as atualizações suportadas, reconstrua e escaneie a candidata e repita o aceite nativo e de migração nessa imagem. A validação unificada de rotas, ações, escopo, CSRF, segredos e cache também continua aberta.

O experimento local com Jackson 2.21.8 iniciou no Docker 29.9.2 com dados descartáveis e sem rede externa. Saúde, descoberta da API, schemas, descoberta de token e status OIDC responderam. A varredura da imagem caiu de 30 para 11 ocorrências críticas e de 88 para 57 altas. O experimento ainda precisa de um build reproduzível e de regressão de migração e workloads.

A compatibilidade com Docker tem um critério de aceite próprio. As [notas do Rancher 1.6.30](https://forums.suse.com/t/rancher-release-v1-6-30/17359) listam versões até o Docker 19.03 para hosts gerenciados. O servidor inicia no Docker 29.9.2. Um daemon descartável da mesma versão recusou o cliente Docker embutido no agente Rancher 1.2.11, que usa a API 1.22, pois o daemon exige a API 1.40 ou superior. A imagem experimental em `console/tests/legacy-host/Dockerfile.modern-client` substitui o CLI embutido pelo Docker 29.9.2. Ela negociou a API 1.56 e consultou informações do daemon no mesmo engine isolado com cgroups v2. O registro do agente e o comportamento dos workloads ainda precisam de validação. Use um host Linux descartável para testar registro, negociação da API Docker, rede gerenciada, volumes, ciclo de vida de stacks, logs, terminal e métricas antes de ampliar o suporte. Registre a versão exata do daemon, a versão mínima da API, o agente e as imagens de sistema em cada execução.

## Ordem e domínios opcionais

Conclua contratos/efeitos nativos de workloads, depois infraestrutura/dados/catálogo/integrações. Feche identidade técnica/streams e migração segura de grants, seguido de acessibilidade/performance e regressão final de configuração/recuperação/release. Gate falho retorna à implementação; não aumente timeouts ou esconda limites para obter aprovação.

VM/Windows, Kubernetes/kubectl, Swarm e Mesos ficam condicionais e desligados até necessidade concreta e laboratório compatível. Não entram na conclusão Docker/Cattle atual. Documentação ativa integral bilingue, orientação de contribuição/IA e revisão de conteúdo público são requisitos da distribuição. A versão alfa comunitária é destinada à avaliação isolada. O aceite de produção segue nas tarefas de entrega e recuperação.
