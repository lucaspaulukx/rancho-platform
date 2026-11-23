# 01 — Análise e decisão de arquitetura

## Checkpoint documental — 21/10/2026

A decisão em execução é o frontend independente React/TypeScript em console/, reaproveitando APIs/sessão/autorização Cattle. O Ember original permanece referência em leitura. A base operacional já inclui ações contextuais, upgrade de imagem/catálogo e escala; a análise abaixo registra a decisão inicial, não a conclusão da migração.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


## Evidência atual

| Item | Verificado nos fontes / laboratório | Implicação |
|---|---|---|
| Servidor | Rancher 1.6.30; imagem oficial fixada por digest | Manter compatibilidade exata inicialmente. |
| Orquestrador | Cattle 0.183.83, Java 8 | Regras de autorização continuam no Cattle. |
| UI | Ember 2.9.1; Ember CLI 2.9.1; Bower; node-sass 4 | Modernização ampla sobre essa base exige manter um toolchain antigo e seus padrões de estado. |
| API | `v2-beta`, schemas, links e actions dinâmicos | Um cliente moderno pode consumir o backend existente, mas precisa respeitar o contrato de cada recurso. |
| Sessão | Cookie `token`, CSRF, JWT referenciado no banco e metadados de sessão no navegador | É necessária uma ponte explícita entre a UI nova e a clássica; não reutilizar stores antigos como estado do React. |
| Tempo real | Assinaturas WebSocket, console, logs e estatísticas | Não são substituídos por uma tabela REST. Exigem testes de conexão, escopo e revogação. |
| Outros componentes | Catálogo, machine service, auth service e proxies | Fluxos precisam ser testados através da mesma origem, não apenas por chamada direta ao Cattle. |
| Rancher Console | React, TypeScript, componentes acessíveis e tokens de tema | Aproveitar identidade e padrões; não copiar as regras de negócio do Rancher Console. |
| Marca | Logos comunidade positivos/negativos disponíveis no Rancher Console | Reutilizar os arquivos existentes, sem redesenhar a marca. |

Referências locais principais: `ui/app/router.js`, `ui/app/utils/navigation-tree.js`, `ui/app/services/access.js`, `ui/app/utils/browser-storage.js`, `ui/app/mixins/subscribe.js`; no Rancher Console, `tailwind.config.js`, `app/globals.css`, `styles/brand.css`, `components/layout/` e `public/imgs/`.

## Até onde o frontend atual pode ir

É possível alterar cores, tipografia, layouts, componentes Ember, formulários e navegação; novas rotas podem usar `additional-routes`. Os protótipos de grupos e acesso pendente provaram que é possível adicionar módulos sem reconstruir toda a interface.

O limite é custo e consistência: layouts e estado existentes dependem de stores, serviços, templates e schemas legados. Extensões por DOM/CSS isoladas ficam frágeis, dificultam testes e já produziram comportamento de navegação insatisfatório no laboratório. Não serão a arquitetura da migração.

## Alternativas

| Alternativa | Benefício | Custo / risco | Decisão |
|---|---|---|---|
| Apenas novo tema no Ember | Mudança pequena e rápida | Melhora aparência, mas mantém UX e limitações atuais | Manter como compatibilidade, não como solução principal. |
| Reescrever todos os componentes em Ember atual | Preserva uma linha tecnológica | Salto grande entre versões, dependências e APIs de componentes; risco de reconstrução ampla | Não iniciar sem estudo separado. |
| Frontend React separado, migrado por módulos | Componentes modernos, testes isolados, identidade uniforme, rollback por módulo | Precisa inventariar os contratos e cuidar da ponte de sessão | Recomendado para a migração planejada. |
| Reescrever frontend e backend juntos | Liberdade de produto | Amplia muito o escopo e mistura riscos de UI e orquestração | Fora deste plano. |

## Decisão proposta para execução por fases

1. Criar uma console React/TypeScript independente do Ember, publicada na mesma origem.
2. Empacotar assets estáticos com build reproduzível; Vite é uma opção compatível com esse modelo. A escolha final de dependências será registrada no lockfile da fase de fundação.
3. Manter o Cattle como autoridade de autenticação local, autorização, recursos e actions. O módulo OIDC valida o Keycloak e cria a sessão Rancher.
4. Migrar por domínio funcional, com flags. URLs clássicas continuam disponíveis enquanto houver telas não migradas.
5. Não inserir templates ou lógica React dentro de componentes Ember. O compartilhamento ocorre pela API, sessão e tokens de identidade visual.
6. Não adotar SSR ou um backend adicional apenas para renderizar essas telas. Qualquer necessidade futura de BFF precisa de ADR próprio e evidência.

## O que “reaproveitar as regras” significa

- **Reutilizar:** autorização do backend, papéis, estado dos recursos, schemas, actions e processos já existentes.
- **Adaptar e testar:** serialização, paginação, erros, IDs Rancher (`1a...`, `1lg!...`), operações assíncronas, cookies e proxies.
- **Reimplementar com paridade:** comportamento que existe apenas no frontend, como montagem de formulários, defaults, dependências entre campos, confirmações e composição de payloads.
- **Não assumir:** que esconder um botão protege a API; que uma action funciona porque aparece no schema; que mudar o frontend corrige vulnerabilidades do backend legado.

## Condições para avançar

O layout compartilhado, o registro de flags, o contrato de sessão, a matriz de autorização e os testes de desativação precisam existir antes de liberar a primeira tela moderna. Não migrar uma família operacional sem comprovar seus fluxos essenciais e a volta para a UI clássica.
