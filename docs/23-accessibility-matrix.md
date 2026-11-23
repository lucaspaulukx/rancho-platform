# Matriz automatizada de acessibilidade

## Plano — 22/10/2026

Cobrir as rotas implementadas de operação, ambientes, grupos, usuários, hosts, dados e catálogo em temas escuro/claro e viewports desktop/390 px. Usar axe-core já instalado no projeto para WCAG 2 A/AA e 2.1 AA, com relatórios sem HTML, credenciais, cookies ou payloads. Nenhuma mutação de negócio é permitida nesta suíte, além do login local do contexto descartável.

Antes da auditoria, aguardar shell/cabeçalho e conclusão do loading inicial. Distinguir falha funcional de carregamento, overflow horizontal, violação automatizada e verificação manual ainda pendente. O teste de axe não representa conformidade completa WCAG nem substitui leitor de tela ou todos os fluxos de teclado.

Verificar também o seletor de environment por teclado (busca, Enter, Escape e restauração do foco). Telas e campos sob feature flags terão matrizes próprias depois da implementação. Os relatórios descrevem escopo real, sem marcar fases futuras como concluídas.

## Correção compartilhada de foco

Capturas e uma asserção geométrica no navegador reproduziram campo parcialmente recortado no limite do corpo rolável do drawer. O Modal compartilhado ajusta somente o scroll do seu próprio corpo ao receber foco, mantendo margem de 12 px em relação ao header/footer. CSS define scroll-padding correspondente. Não rolar o documento de fundo nem alterar rascunhos/ações. A suíte form-themes deve provar a correção em claro/escuro e desktop/390 px antes do aceite.

## Resultado

44 cenários de rotas (11 × 2 temas × 2 tamanhos) passaram em axe WCAG 2 A/AA e 2.1 AA sem violações automatizadas, sem overflow horizontal e sem erro inicial de carregamento. Busca/Enter/Escape/foco do environment passaram. Relatório `console/accessibility-browser-results.json`; imagens em `evidence/e2e-isolated/`.

A regressão de foco foi reproduzida com asserção geométrica falhando antes da correção e passou depois nas quatro combinações do formulário real. O Modal agora mantém o elemento focado dentro do corpo rolável com margem, sem scroll do documento de fundo. 319 testes globais e TypeScript/Vite aprovados. Os sete audits de drawers e quatro previews também passaram. Continuam pendentes leitor de tela, matriz manual completa, dispositivos físicos/teclado virtual e demais fluxos futuros; não afirmar conformidade WCAG total.
