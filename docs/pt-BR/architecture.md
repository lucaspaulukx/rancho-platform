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

Os domínios registrados cobrem autenticação/sem-acesso, shell/navegação/seleção de environment/aparência, controles/tabelas/diálogos comuns, recuperação contextual de erros e o editor opcional de dispositivos na criação em pt-BR/en-US. Chaves/parâmetros são tipados e catálogos têm validação estrutural em runtime. Chaves desconhecidas, plurais malformados e parâmetros alterados falham sem reproduzir os dados enviados. Mensagens ausentes resolvem explicitamente para en-US e usam gramática/formatação inglesa; `resolvedLocale` informa esse fallback. `translatedKeys` conta somente domínios registrados, nunca a cobertura da aplicação. Mensagens são strings simples para texto/atributos React: não enviar para `dangerouslySetInnerHTML` nem executar seu conteúdo. Erros nativos, nomes de recursos, comandos e logs não são chaves de tradução. Rótulos/toasts explícitos fornecidos por consumidores continuam sob controle de quem os fornece.

`I18nProvider` fica dentro do contexto estável da aplicação e envolve os dois layouts sem chave dependente de locale. Atualiza idioma/direção e descendentes no lugar, preservando escopo, diálogos e rascunhos. Sua política opcional validada e o seletor estão descritos em [configuração](configuration.md). Política ausente/desligada preserva pt-BR; idiomas não portugueses parcialmente extraídos exigem preview explícito e aviso visível. Navegação localizada cria cópias dos metadados estáticos sem alterar identificadores de rotas/ações. Erros OIDC guardam chaves de tradução, não frases traduzidas, para que trocar idioma não reinicie a autenticação.

`npm run check:locales` valida conjuntos exatos de chaves registradas pt-BR/en-US e estrutura de parâmetros/plurais no CI de fontes e build da imagem. Seu relatório sanitizado informa explicitamente que a cobertura da interface não foi medida e os outros oito catálogos seguem pendentes. Extração completa e revisão linguística continuam no roadmap. Metadados de direção e layout do seletor não implementam RTL completo. Erros contextuais mantêm o locale; erro catastrófico na rota raiz substitui o provider e retorna com segurança ao pt-BR. Testes dos domínios registrados não comprovam paridade de idiomas em todas as rotas.

O painel compartilhado de detalhes segue o idioma ativo nas abas, nos rótulos, nos números, nas datas e na validade de certificados. A troca de idioma preserva a aba selecionada e mantém o JSON sanitizado idêntico, incluindo chaves, valores nativos e marcadores de ocultação.

A tela de operações e o seletor compartilhado de streams usam o idioma ativo na navegação, nos filtros e nos rótulos de ações. A troca de idioma preserva a visão atual dos workloads e os identificadores das ações nativas.

O painel de criação de workloads e a confirmação de operações em lote usam o idioma compartilhado nos rótulos e nas orientações dos diálogos. O formulário de schema nativo e os editores especializados definem os próprios rótulos de campos.

Os controles especializados de CPU, memória, capabilities, limites de processo e saúde usam mensagens registradas em pt-BR/en-US. Erros do parser de CPU expõem códigos estáveis para tradução. Algumas mensagens de validação dos outros helpers de workloads ainda usam o texto original em português.

Os editores de agendamento, portas e montagens usam os catálogos compartilhados. Validadores de memória e limites de processo expõem chaves tipadas, e os erros exibidos nos editores acompanham a troca de idioma preservando o rascunho. Valores nativos de agendamento, protocolos de portas e modos de montagem mantêm a representação da API.

## Dados e mutações

Use schemas/action links atuais, sem inventar rotas ou supor igualdade entre schemas globais e do environment. Releia recurso, escopo e contrato relevante antes da mutação. Preserve configuração desconhecida e campos não selecionados; não transforme valores incompatíveis em defaults vazios silenciosamente.

IDs de recurso, identidade e environment precisam corresponder durante a operação. Troca de escopo aborta requisições e fecha streams. Dados de query e rascunhos React têm ciclos distintos: configuração privada, credenciais geradas e capacidades de stream não devem virar estado persistente do navegador. Preserve o rascunho se a mutação falhar.

Upgrade de configuração usa ações nativas de serviço e contratos create; campos imutáveis do container não se tornam editáveis por PUT. Compare snapshots completos relevantes antes do envio, descrevendo isso como detecção de conflito, não CAS atômico no servidor. Revisão de grupos locais e atualização nativa de listas de membros têm garantias de concorrência diferentes.

## Identidade e streams

OIDC valida a identidade externa e cria a sessão normal do Rancher. Grupos locais, membros e grants de environments permanecem no Rancher, independentes de grupos Keycloak. Grants diretos coexistem; novos usuários começam sem acesso nem environment automático sob a política correspondente do backend.

Autorização HTTP, sessões de subscription e autorização de streams de host são caminhos distintos. Guardas opcionais revalidam sessão/conta/credencial pertinente e encerram streams não autorizados. Credenciais técnicas de agentes são distintas de API keys pessoais e compartilhadas do environment. Veja [segurança](security-model.md) e [configuração](configuration.md).

## Regra de extensão

Uma mudança inclui descoberta de contrato, flag/default/off explícitos, UI comum, testes relevantes, limites de evidência documentados e os dois idiomas. Veja [contribuição](contributing.md), [testes](testing.md) e [roadmap](roadmap.md).
