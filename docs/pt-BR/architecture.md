# Arquitetura

<!-- rancho-language-navigation:start -->
[Português (Brasil)](architecture.md) | [English](../en/architecture.md)
<!-- rancho-language-navigation:end -->


## Fronteiras

Rancho oferece uma console independente React/TypeScript para Rancher 1.6 Docker/Cattle e extensões opcionais do Cattle e proxy WebSocket. Rancher continua sendo o engine e a autoridade de autorização. A UI clássica é preservada; desenvolvimento novo pertence a `console/`. Kubernetes, Swarm, Mesos e administração Windows/VM estão fora do aceite atual.

[upstream.json](../../upstream.json) fixa os fontes oficiais e [patches](../../patches/) contém as alterações do projeto. `cattle/` e `websocket-proxy/` são checkouts gerados e ignorados, não material de consulta incorporado. `legacy-ui/` é a extensão isolada de compatibilidade necessária à imagem. Preserve licenças upstream e identidade Rancher.

## Estrutura do frontend

| Responsabilidade | Fonte |
|---|---|
| Layouts compartilhados autenticado/público | `console/src/layouts.tsx` |
| Navegação e contexto de environment | `console/src/navigation.ts`, `console/src/state.tsx` |
| Controles e diálogos compartilhados | `console/src/components/ui.tsx` |
| API, schemas e mutações no escopo | `console/src/api.ts`, `console/src/hooks/useActionScope.ts` |
| Workspace vertical de workloads | `console/src/pages/Operations.tsx` |
| Criação, detalhes e upgrade de recursos | `console/src/components/ResourceCreator.tsx`, `ResourcePanel.tsx`, `ServiceUpgradeForm.tsx` |
| Contratos de configuração e temas | `console/src/config.ts`, `console/src/themes/` |
| Testes unitários/componentes e harnesses nativos | `console/src/test/`, `console/tests/` |

Páginas são renderizadas no shell comum. Ações contextuais abrem drawers compartilhados, evitando trocar de página para operar a mesma stack. Parâmetros da URL preservam environment, visão e filtros. Flag de UI controla apresentação, nunca acesso ao backend.

## Limite da localização

A base comum em `console/src/i18n/` inventaria os dez locales originais de produção e os metadados RTL do persa, normaliza identificadores legados/do navegador e negocia somente uma lista explícita de idiomas disponíveis. Chinês tradicional e variantes com script incompatível não são convertidos silenciosamente para chinês simplificado. Helpers nativos de `Intl` fornecem números, datas, tempo relativo, categorias de plural e ordenação numérica por locale. `formatResourceDate` aceita locale opcional; consumidores existentes mantêm pt-BR.

Os catálogos pt-BR/en-US organizam as mensagens registradas por domínio da interface, incluindo autenticação, navegação, controles comuns, operação de workloads e administração. Cada catálogo de prévia adicional carrega sob demanda e cobre todas as mensagens registradas. Os testes do console exigem o mesmo conjunto de chaves registradas em todos os catálogos de prévia. Chaves/parâmetros são tipados e catálogos têm validação estrutural em runtime. Chaves desconhecidas, plurais malformados e parâmetros alterados falham sem reproduzir os dados enviados. Mensagens ausentes resolvem explicitamente para en-US e usam gramática/formatação inglesa; `resolvedLocale` informa esse fallback. `translatedKeys` conta somente domínios registrados, nunca a cobertura da aplicação. Mensagens são strings simples para texto/atributos React: não enviar para `dangerouslySetInnerHTML` nem executar seu conteúdo. Erros nativos, nomes de recursos, comandos e logs não são chaves de tradução. Rótulos/toasts explícitos fornecidos por consumidores continuam sob controle de quem os fornece.

`I18nProvider` fica dentro do contexto estável da aplicação e envolve os dois layouts sem chave dependente de locale. Atualiza idioma/direção e descendentes no lugar, preservando escopo, diálogos e rascunhos. Sua política opcional validada e o seletor estão descritos em [configuração](configuration.md). Política ausente/desligada preserva pt-BR; idiomas não portugueses parcialmente extraídos exigem preview explícito e aviso visível. Navegação localizada cria cópias dos metadados estáticos sem alterar identificadores de rotas/ações. Erros OIDC guardam chaves de tradução, não frases traduzidas, para que trocar idioma não reinicie a autenticação.

`npm run check:locales` valida conjuntos exatos de chaves registradas pt-BR/en-US e estrutura de parâmetros/plurais no CI de fontes e build da imagem. O relatório conta as chaves registradas presentes e ausentes por idioma em prévia. A ausência de um catálogo reprova a verificação. Completar o catálogo registrado ainda exige verificar a cobertura da interface. Extração completa e revisão linguística continuam no roadmap. Metadados de direção e layout do seletor não implementam RTL completo. Erros contextuais mantêm o locale; erro catastrófico na rota raiz substitui o provider e retorna com segurança ao pt-BR. Testes dos domínios registrados não comprovam paridade de idiomas em todas as rotas.

O painel compartilhado de detalhes segue o idioma ativo nas abas, nos rótulos, nos números, nas datas e na validade de certificados. A troca de idioma preserva a aba selecionada e mantém o JSON sanitizado idêntico, incluindo chaves, valores nativos e marcadores de ocultação.

A tela de operações e o seletor compartilhado de streams usam o idioma ativo na navegação, nos filtros e nos rótulos de ações. A troca de idioma preserva a visão atual dos workloads e os identificadores das ações nativas.

O painel de criação de workloads e a confirmação de operações em lote usam o idioma compartilhado nos rótulos e nas orientações dos diálogos. O formulário de schema nativo e os editores especializados definem os próprios rótulos de campos.

Os controles especializados de CPU, memória, capabilities, limites de processo e saúde usam mensagens registradas em pt-BR/en-US. Erros do parser de CPU expõem códigos estáveis para tradução. Algumas mensagens de validação dos outros helpers de workloads ainda usam o texto original em português.

Os editores de agendamento, portas e montagens usam os catálogos compartilhados. Validadores de memória e limites de processo expõem chaves tipadas, e os erros exibidos nos editores acompanham a troca de idioma preservando o rascunho. Valores nativos de agendamento, protocolos de portas e modos de montagem mantêm a representação da API.

Grupos, contas, diálogos de contas locais, diagnóstico de acesso efetivo, chaves de API, auditoria, configurações do servidor, processos, monitoramento do engine, drivers de máquinas e repositórios de catálogos usam rótulos registrados em pt-BR/en-US. Erros gerados localmente mantêm chaves tipadas e são traduzidos na renderização, incluindo erros já visíveis durante a troca de idioma. Erros nativos/de helpers mantêm a representação existente onde a extração está pendente. Trocar o idioma preserva rascunhos abertos de grupos e não altera escopo de consultas, privilégios ou identificadores de ações nativas.

## Dados e mutações

O editor de JSON bruto usa direção LTR para o código e preserva rascunhos inválidos. As mensagens de validação do navegador acompanham a troca de idioma no lugar e são limpas quando o JSON se torna válido.

Tabelas compartilhadas, títulos de recursos e controles de criação se alinham ao início da direção de texto ativa. O menu de ações se reposiciona quando a direção muda, preservando o foco do teclado e o estado aberto.

Listas de recursos e workloads, ações de recursos, edição de environments, repositórios de catálogo por environment e políticas de rede usam mensagens compartilhadas. O painel de logs e terminal traduz controles e estados da conexão no lugar. A troca de idioma preserva a conexão ativa, o filtro, os comandos nativos e o conteúdo dos logs.

Rótulos e mensagens de revisão da atualização de serviços seguem o idioma ativo. Rótulos, números exibidos e horários dos gráficos de métricas usam esse idioma, preservando a série selecionada e o formato do CSV.

O editor de templates de environment traduz controles e mensagens de revisão e preserva o conteúdo Compose, os identificadores de catálogo e as respostas na forma original. O formulário de schema exibe erros tipados de validação do payload no idioma ativo. Chamadores que leem diretamente a mensagem do erro continuam recebendo o texto original em português.

A criação de stacks, a escala de serviços, os vínculos de serviços e o diálogo Sobre usam o idioma compartilhado. Documentos Compose, identificadores de serviços, valores enviados e flags de capacidade mantêm a representação nativa.

Validadores de Compose, templates de environment, vínculos de serviços e upgrades de serviços expõem erros tipados. Seus painéis exibem o erro no idioma ativo e preservam o rascunho. Chamadores existentes dos validadores continuam recebendo as mensagens originais em português.

Mensagens de validação de saúde, sidecars, agendamento e segurança seguem o idioma ativo tanto na criação de workloads quanto na atualização de serviços.

Hosts, templates de catálogo e webhooks também usam o idioma compartilhado. Comandos de registro de hosts e valores de secrets permanecem nativos e mascarados até serem revelados explicitamente; trocar o idioma altera rótulos sem solicitar registro nem copiar um secret. Nomes de templates, conteúdo de parâmetros e identificadores de drivers de webhooks mantêm os valores nativos. Erros de helpers ainda não extraídos permanecem inalterados.

Use schemas/action links atuais, sem inventar rotas ou supor igualdade entre schemas globais e do environment. Releia recurso, escopo e contrato relevante antes da mutação. Preserve configuração desconhecida e campos não selecionados; não transforme valores incompatíveis em defaults vazios silenciosamente.

IDs de recurso, identidade e environment precisam corresponder durante a operação. Troca de escopo aborta requisições e fecha streams. Dados de query e rascunhos React têm ciclos distintos: configuração privada, credenciais geradas e capacidades de stream não devem virar estado persistente do navegador. Preserve o rascunho se a mutação falhar.

Upgrade de configuração usa ações nativas de serviço e contratos create; campos imutáveis do container não se tornam editáveis por PUT. Compare snapshots completos relevantes antes do envio, descrevendo isso como detecção de conflito, não CAS atômico no servidor. Revisão de grupos locais e atualização nativa de listas de membros têm garantias de concorrência diferentes.

## Identidade e streams

OIDC valida a identidade externa e cria a sessão normal do Rancher. Grupos locais, membros e grants de environments permanecem no Rancher, independentes de grupos Keycloak. Grants diretos coexistem; novos usuários começam sem acesso nem environment automático sob a política correspondente do backend.

Autorização HTTP, sessões de subscription e autorização de streams de host são caminhos distintos. Guardas opcionais revalidam sessão/conta/credencial pertinente e encerram streams não autorizados. Credenciais técnicas de agentes são distintas de API keys pessoais e compartilhadas do environment. Veja [segurança](security-model.md) e [configuração](configuration.md).

## Regra de extensão

Uma mudança inclui descoberta de contrato, flag/default/off explícitos, UI comum, testes relevantes, limites de evidência documentados e os dois idiomas. Veja [contribuição](contributing.md), [testes](testing.md) e [roadmap](roadmap.md).
