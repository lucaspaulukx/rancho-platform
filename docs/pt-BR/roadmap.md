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
| UX01 | Shell, marca, navegação, seletor, login/sem-acesso | Implementado; falta regressão final de rotas/temas |
| UX02 | Tabelas, filtros, seleção, menus, drawers, revisão/rascunhos | Recortes implementados; falta matriz completa de teclado/foco/erro parcial/contexto |
| UX03 | Tokens de tema e overrides | Implementado; conferir contraste efetivo nas rotas finais |
| UX04 | Recuperação de chunks/abas antigas e retenção de assets | Implementado; falta upgrade/rollback final com aba antiga aberta |
| UX05 | Acessibilidade manual/leitor de tela | Pendente aceite manual dos fluxos críticos |
| UX06 | Alto volume/performance | Pendentes budgets e medição de latência, heap/render com20 environments/milhares de registros |
| CFG01 | Flags frontend/backend e fallback clássico | Parcial; falta matriz final de dependência/on/off/reversão |
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
| I18N03 | Extração completa pt-BR/en-US | Parcial; shell/navegação/aparência/seleção de environment, login/sem-acesso/recuperação e defaults comuns de tabela/diálogo/controles extraídos; faltam demais páginas, menus/drawers/toasts/validadores de domínio e rótulos acessíveis; preservar comandos técnicos e conteúdo nativo/dos usuários |
| I18N04 | Outros oito idiomas de produção | Pendente; catálogos completos de-DE/fr-FR/hu-HU/ja-JP/fa-IR/ru-RU/uk-UA/zh-Hans, consistência de parâmetros/plurais e revisão linguística; nunca anunciar catálogo com fallback inglês como tradução concluída |
| I18N05 | RTL e apresentação multilingue | Pendente; direção fa-IR, espaçamento/alinhamento CSS lógico e ícones direcionais, código/IDs/terminal LTR misturados, rótulos longos e layout CJK; regressão de teclado/foco, mobile e temas |
| I18N06 | Contribuição de traduções e gates de release | Gate de chaves/parâmetros/plurais pt-BR/en-US do domínio registrado implementado no CI/build; faltam cobertura da extração inteira, detecção de tradução desatualizada, falha lazy-load/offline/budgets de bundle e regressão dos dez locales/streams; nunca expor payloads privados de erro |

Implementar primeiro o contrato compartilhado, depois configuração/seleção e cobertura completa pt-BR/en-US, os demais catálogos, RTL e regressão final. Idiomas parcialmente traduzidos ficam fora do seletor normal de produção até o aceite de cobertura e revisão. Inventário, seletor ou fallback isolados não concluem suporte multilingue. Estas tasks fazem parte do aceite de release, não são domínio opcional; não exigem alterar Ember clássico nem traduzir nomes de workloads, logs, campos Compose/API ou páginas externas do IdP. A documentação continua mantida em pt-BR e inglês; paridade de interface não promete dez traduções da documentação.

## Identidade e autorização

| ID | Capacidade | Estado e gate restante |
|---|---|---|
| AUTH01 | Local/OIDC, callback, exclusivo/autologin/sem-acesso | Implementado; falta matriz final de modos/sessões/deep links |
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
| OPS10 | Capabilities/readOnly/privileged/opções de segurança | Reset/finish de capabilities/readOnly e criação com dispositivos validados, incluindo mapeamentos independentes no principal e no sidecar em um host. Upgrade, reversão, conclusão e remoção de dispositivos da configuração principal verificados pelo console com escala zero e por substituição nativa em um host Docker. Criação nativa com no-new-privileges verificada no processo com controle equivalente. Faltam upgrades de dispositivos em sidecars, múltiplos hosts, outras opções de segurança e variantes de privilégios |
| OPS11 | CPU/IO/limites de processo | CPU/IO e nofile criar/upgrade/rollback/reset em um host validados, incluindo sidecar independente; faltam outros limites/carga/compatibilidade |
| OPS12 | Editar/recriar container avulso | Parcial; falta contrato mutável/imutável e recriação nativa |
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
| OBS03 | Soak do build final | Pendentes heap/buffers/CPU/reconnect medidos; soak antigo não prova build novo |
| ADM01 | Contas locais/perfil/senha/lifecycle | Implementado; falta matriz final concorrência/admin OIDC/técnicos |
| ADM02 | Auditoria/settings/processos/replay | Recortes implementados; falta regressão final permissão/privacidade/erro/efeito nativo |
| ADM03 | HA/pools | Monitor implementado; falta configuração/failover físico |
| ADM04 | Drivers de máquinas/catálogos | CRUD implementado; falta provisionamento/reativação isolados |
| INT01 | API keys | Gestão implementada; falta aceite técnico completo de escopo/expiração |
| INT02 | Webhooks/receivers | Configuração implementada; faltam entrega local real/retries/negação |
| HELP01 | Sobre/capacidades/versão/atribuição | Implementado; falta consistência final de artefato/licenças/capacidades |

## Entrega e recuperação

| ID | Capacidade | Estado e gate restante |
|---|---|---|
| REL01 | Migrações versionadas de banco/config | Schema aditivo/runtime e engine original sintético validados; falta aceite completo de pacote fresco |
| REL02 | Backup/recuperação Rancher/IdP completos | DB/estado/imagens/login isolado criptografados validados em recortes; faltam workloads/storage/topologias completos |
| REL03 | Rollback frontend/backend | Parcial; faltam imagem/config/dados anteriores e compatibilidade aba antiga/cliente clássico |
| REL04 | Distribuição reproduzível | Pins/lockfiles/CI/inventário disponíveis; faltam bootstrap/install/upgrade/licenças/proveniência/segurança finais |
| REL05 | Segurança final | Pendente aceite unificado rotas/ações/escopos/CSRF/secrets/cache/dependências/risco legado |
| REL06 | Aceite local de release | Pendentes gates obrigatórios no mesmo artefato, cleanup exato e evidência reproduzível |

## Ordem e domínios opcionais

Conclua contratos/efeitos nativos de workloads, depois infraestrutura/dados/catálogo/integrações. Feche identidade técnica/streams e migração segura de grants, seguido de acessibilidade/performance e regressão final de configuração/recuperação/release. Gate falho retorna à implementação; não aumente timeouts ou esconda limites para obter aprovação.

VM/Windows, Kubernetes/kubectl, Swarm e Mesos ficam condicionais e desligados até necessidade concreta e laboratório compatível. Não entram na conclusão Docker/Cattle atual. Documentação ativa integral bilingue, orientação de contribuição/IA e revisão de conteúdo público são requisitos da distribuição. O repositório permanece privado até autorização separada de publicação.
