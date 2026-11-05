# 02 — Arquitetura e regras comuns de frontend

## Atualização —22/10/2026

CheckboxField compartilhado e ComposeEditor reutilizável acrescidos; ResourceCreator escolhe o novo formulário por flag e revalida campos criáveis antes de POST. UI usa estado privado e gcTime 0, sem novo shell. CSScheckbox não herda padding e min-height dos campos de texto. Documentos 15 e 16.

## Checkpoint documental — 21/10/2026

AppShell/AuthLayout, componentes de drawer/menu/formulário e tokens comuns estão implementados. Workloads usam workspace vertical compartilhado e useActionScope; snapshots recusam conflitos detectáveis no cliente, sem CAS. Respostas/Compose de stacks são retirados do query cache e relidos no editor; não generalizar esse saneamento a todos os campos privados de serviços. O próximo editor Compose deverá reutilizar esta arquitetura.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


## Estrutura planejada

```text
console/
  src/app/             # bootstrap, providers, router e limites de erro
  src/layouts/         # AppShell e AuthLayout
  src/components/ui/   # componentes visuais sem regra de negócio
  src/components/data/ # DataTable, filtros, estados e ações de recursos
  src/features/        # auth, environments, groups, containers etc.
  src/lib/api/         # transporte, contratos, erros, paginação e actions
  src/lib/auth/        # sessão e ponte controlada para a UI clássica
  src/lib/config/      # flags efetivas e capacidades do servidor
  src/themes/          # tokens, presets e validação
  src/test/            # fixtures e utilitários compartilhados
```

## Layout obrigatório

### AppShell — todas as telas autenticadas

Sidebar, navbar, breadcrumbs, título da página, seletor de environment, identidade do usuário, seletor de tema, área de conteúdo, notificações e referência de versão são instâncias dos mesmos componentes. Acesso pendente, erros 403/404 e telas administrativas também usam esse shell.

Um módulo pode controlar conteúdo e ações da sua página; não pode criar outra sidebar ou navbar. Títulos, espaçamentos, largura de conteúdo e comportamento responsivo são definidos pelo shell. Navegação recolhida ou modo compacto são preferências do mesmo layout.

O router monta AppShell uma vez como pai das rotas autenticadas e renderiza cada página no outlet. Providers de configuração, sessão, tema, queries e notificações são montados na raiz. Um host comum gerencia dialogs/drawers; cada módulo fornece conteúdo e ações, sem reconstruir controle de foco.

Um manifesto tipado de rotas alimenta menu, breadcrumbs e guards. A mesma definição informa flag/capacidade/escopo; não manter listas de navegação divergentes por tela. Componentes básicos não importam features; features consomem componentes e contratos comuns. A fundação deve incluir regras de imports e testes de estrutura que detectem shell duplicado e rota autenticada fora do layout.

### AuthLayout — login, callback, sessão expirada e falha de autenticação

Esses fluxos não possuem contexto autenticado para renderizar menus de recursos. Compartilham o mesmo layout de autenticação, identidade comunidade/Rancher, tema e componentes. Não recebem sidebars diferentes por provedor.

### Compatibilidade clássica

Enquanto uma tela continuar no Ember, uma navegação explícita abre sua URL clássica. Não envolver a UI clássica em iframe nem simular que ela já usa o novo AppShell. O usuário deve identificar a transição. Não duplicar ações no novo frontend sem paridade funcional.

## Componentes reutilizáveis

| Componente | Responsabilidade / regra |
|---|---|
| Brand / ProductSignature | Marca Rancher e assinatura comunitária opcional sob branding. |
| Sidebar / Navbar | Um único mapa de navegação, filtrado por capacidade e permissão; foco e estado ativo consistentes. |
| EnvironmentSwitcher | Lista somente environments autorizados; troca limpa cache e subscriptions do escopo anterior. |
| PageHeader | Título, descrição, breadcrumbs e ação principal em posições uniformes. |
| DataTable | Busca, ordenação, paginação, seleção e ações; estado preservado na URL quando aplicável. |
| ResourceActionMenu | Ações derivadas dos links/capacidades do servidor, com tratamento comum de indisponibilidade. |
| FormField / FormSection | Label, ajuda, validação, erro associado e indicação de campo obrigatório. |
| Dialog / Drawer | Foco inicial, trap de foco, Escape, retorno do foco, título acessível e footer padronizado. |
| ConfirmAction | Recurso, environment e efeito explícitos; confirmação reforçada apenas em operações destrutivas. |
| Toast / InlineAlert | Toast para sucesso não crítico; erro acionável persiste na página ou formulário. |
| Loading / Empty / Error / Forbidden | Estados obrigatórios, com textos e ações comuns; sem tela vazia. |
| SecretField | Mascaramento; revelação temporária quando autorizada; não registrar conteúdo. |
| CodeEditor / DiffViewer | Edição e comparação de configuração; validação antes de enviar. |
| LogViewer / Terminal | Componentes próprios para streaming, backpressure e encerramento; não usar DataTable. |

## Contrato de uma tela

Toda definição de rota declara: layout, flag, capacidade necessária, escopo de environment, query key, estratégia de carregamento, estados vazios/erro, breadcrumbs e testes de acesso direto/F5. Não executar request se o módulo estiver desativado ou o escopo ainda não estiver resolvido.

Toda mutação declara: permissão, payload validado, prevenção de duplo envio, erro por campo, comportamento de sucesso, invalidação do cache, feedback e confirmação quando aplicável. Falha nunca fecha o formulário nem descarta dados silenciosamente.

## Estado e dados

- Estado do servidor fica em uma camada de queries compartilhada; estado temporário de formulário fica no módulo.
- Cache inclui servidor, usuário e environment. Mudança de identidade limpa dados da identidade anterior.
- Respostas atrasadas de outro environment são descartadas; não podem substituir a tela atual.
- Busca usa debounce e cancelamento. Evitar request por linha quando existir resposta agregada apropriada.
- Paginação segue o contrato do Rancher. Não anunciar paginação do servidor quando a API apenas devolve uma lista inteira.
- O frontend não cria grants, inventa roles ou trata JWT do Keycloak como sessão Rancher.
- Cookies seguem a política do backend. Tokens não são persistidos em stores genéricos do React nem registrados em logs.

## Regras visuais

- Tokens semânticos para superfícies, texto, bordas, ações e status. Cor de marca não substitui a cor de um estado operacional.
- Hierarquia previsível: título da tela, descrição curta, ação principal e filtros; detalhes em seções, sem formulário longo indiferenciado.
- Tabelas para comparação; cards para resumo/seleção; gráficos somente com dados úteis. Sem métricas inventadas para preencher o layout.
- Cores, sombras, fontes, espaços, raios e densidade vêm de tokens compartilhados. Evitar cores hexadecimais espalhadas pelos módulos.
- Tema claro, escuro e sistema usam os mesmos componentes. Sem telas independentes “quase iguais”.
- Respeitar `prefers-reduced-motion`; animações curtas e funcionais.

## Responsividade e acessibilidade

Verificar 360, 768, 1024 e 1440 px. Sidebar vira navegação móvel com foco controlado; navbar mantém identidade e acesso ao perfil. Tabelas têm estratégia explícita para telas pequenas, sem converter dados críticos em texto cortado.

Meta de acessibilidade: WCAG 2.2 AA nas telas novas. Teclado, foco visível, contraste, nomes acessíveis, mensagens de status e erros associados aos campos fazem parte do aceite. Não depender apenas de cor, hover ou ícone sem label.

## Critério obrigatório de revisão

Uma tela não está concluída se duplicar shell/componentes, ignorar flags/tema, quebrar F5, permitir ações sem checagem no servidor, descartar formulário após erro, não tratar loading/empty/error ou não funcionar por teclado.

## Componentes adicionais implementados (22/10)

Brand.tsx centraliza símbolo e wordmark Rancher em AppShell, AuthLayout e Sobre; tema e branding usam as mesmas regras. Modal compartilhado possui corpo rolável por teclado e focus visibility. DataTable aceita paginação nativa externa sem paginação local duplicada. SelectorRows preserva linhas/IDs e valida duplicatas antes de serializar seletores de webhook. APIs de integração usam DTO antes do cache e estado privado para valores/URLs. Hooks de geração/abort encerram contexto por identidade/environment; módulos administrativos remontam por identidade.

## Componentes adicionais (23/10)

Drivers e repositórios reutilizam ActionMenu/Field/CheckboxField/Modal/Confirm/DataTable; repositórios agrupam linhas com nested-fields existente. Compose de stack existente reutiliza ComposeEditor e shell contextual, mantém exportação/parâmetros no estado privado e usa apenas hasComposeSource derivado no inventário. Fluxos por catálogo mantêm precedência e ficam separados das stacks Compose próprias.
