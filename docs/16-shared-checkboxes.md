# Checkboxes compartilhadas

## Resultado — 22/10/2026

CheckboxField compartilhado integra criação Compose e booleanos tipados de schemas/catálogo/templates. CSS global corrige padding/min-height herdados, fixa 18px e alinha legenda/descrição; listas de seleção existentes recebem a mesma aparência. Controles mantêm type=checkbox nativo, nome e descrição acessíveis separados, Space/click/disabled e foco. Flag customCheckboxes=true no laboratório; false recupera appearance auto após recarga mantendo layout. Forced-colors possui fallback nativo em CSS, sem ensaio manual desse modo.

Build de referência 255 testes/30 arquivos + TypeScript/Vite. Regressão de componente cobre clique na legenda, Space, descrição e disabled; testes detectaram e ajudaram a corrigir descrição incorporada ao nome acessível. CUA confirmou 18×18 px e padding zero, seleção por texto/Space, foco, temas, largura móvel de 390 px sem overflow, controle alinhado a 1 px da primeira linha e reversão/restauração da flag. Sete checks e limites em console/checkbox-browser-test-results.json. Capturas console-checkboxes-{operation-dark,operation-light,compose-dark,mobile}.png. Não equivale a auditoria completa de leitor de tela.

A solicitação foi tratada como ajuste transversal de design system, sem alterar grants/workloads. O estado de implementação em andamento abaixo pertence ao plano inicial.

Pedido de 22/10/2026: aparência e alinhamento de checkbox/legenda coerentes em toda a console.

## Entrega planejada

- Corrigir a interferência das regras genéricas `.field input` (padding/min-height/largura) sobre checkboxes.
- Manter inputs checkbox nativos para teclado, formulários e leitores de tela; customizar superfície, borda, marca, estados checked/indeterminate/disabled/hover/focus com tokens existentes.
- Linha clicável com controle de tamanho fixo e texto que quebra alinhado ao começo da primeira linha. Descrição abaixo do texto, sem deslocar o controle ou duplicar “Ativado” nos formulários tipados.
- Componente CheckboxField compartilhado para novos formulários/booleans; classes existentes recebem o mesmo alinhamento. Seleção em tabelas/linhas mantém semântica e posição.
- Flag `modules.customCheckboxes` permite voltar à aparência nativa com recarga, preservando correções de layout e estado. Em forced-colors, usar aparência nativa automaticamente.
- Conferir build e comportamento proporcional; navegador nos temas claro/escuro, checkbox longa em drawer de 390px, clique no texto, Space/foco e desativação da flag. Não alterar grants nem workloads para validar aparência.

## Situação

Implementado e conferido no recorte de aceites descrito acima. Flags restauradas e tema escuro/viewport restituídos após os testes.
