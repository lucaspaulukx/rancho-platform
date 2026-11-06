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

A base comum em `console/src/i18n/` inventaria os dez locales originais de produção e os metadados RTL do persa, normaliza identificadores legados/do navegador e negocia somente uma lista explícita de idiomas disponíveis. Ela não lê preferências do navegador nem habilita seletor sozinha. Chinês tradicional e variantes com script incompatível não são convertidos silenciosamente para chinês simplificado. Helpers nativos de `Intl` fornecem números, datas, tempo relativo, categorias de plural e ordenação numérica por locale. `formatResourceDate` aceita locale opcional; consumidores existentes mantêm pt-BR.

O domínio inicial de mensagens tem sete chaves comuns com catálogos pt-BR/en-US, parâmetros tipados e validação estrutural em runtime. Chaves desconhecidas, plurais malformados e parâmetros alterados falham sem reproduzir os dados enviados. Mensagens ausentes resolvem explicitamente para en-US e usam gramática/formatação inglesa; `resolvedLocale` informa esse fallback. `translatedKeys` conta somente este domínio pequeno, nunca a cobertura da aplicação. Mensagens são strings simples para texto/atributos React: não enviar para `dangerouslySetInnerHTML` nem executar seu conteúdo. Erros nativos, nomes de recursos, comandos e logs não são chaves de tradução.

Provider de locale, política/flags administrativas, persistência de preferência, seletor, extração completa de strings e catálogos revisados seguem no roadmap. Importar a base não habilita locale de produção; a interface atual continua fixa em pt-BR. Inventário não é lista de traduções concluídas e metadado de direção não implementa estilos RTL. Testes de domínio validam a base, sem comprovar tradução de todas as rotas ou aceite de troca pelo navegador.

## Dados e mutações

Use schemas/action links atuais, sem inventar rotas ou supor igualdade entre schemas globais e do environment. Releia recurso, escopo e contrato relevante antes da mutação. Preserve configuração desconhecida e campos não selecionados; não transforme valores incompatíveis em defaults vazios silenciosamente.

IDs de recurso, identidade e environment precisam corresponder durante a operação. Troca de escopo aborta requisições e fecha streams. Dados de query e rascunhos React têm ciclos distintos: configuração privada, credenciais geradas e capacidades de stream não devem virar estado persistente do navegador. Preserve o rascunho se a mutação falhar.

Upgrade de configuração usa ações nativas de serviço e contratos create; campos imutáveis do container não se tornam editáveis por PUT. Compare snapshots completos relevantes antes do envio, descrevendo isso como detecção de conflito, não CAS atômico no servidor. Revisão de grupos locais e atualização nativa de listas de membros têm garantias de concorrência diferentes.

## Identidade e streams

OIDC valida a identidade externa e cria a sessão normal do Rancher. Grupos locais, membros e grants de environments permanecem no Rancher, independentes de grupos Keycloak. Grants diretos coexistem; novos usuários começam sem acesso nem environment automático sob a política correspondente do backend.

Autorização HTTP, sessões de subscription e autorização de streams de host são caminhos distintos. Guardas opcionais revalidam sessão/conta/credencial pertinente e encerram streams não autorizados. Credenciais técnicas de agentes são distintas de API keys pessoais e compartilhadas do environment. Veja [segurança](security-model.md) e [configuração](configuration.md).

## Regra de extensão

Uma mudança inclui descoberta de contrato, flag/default/off explícitos, UI comum, testes relevantes, limites de evidência documentados e os dois idiomas. Veja [contribuição](contributing.md), [testes](testing.md) e [roadmap](roadmap.md).
