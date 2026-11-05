# Proteção de rascunhos e envios pendentes

## Plano — 22/10/2026

1. Corrigir a diferença entre navegação interna (já protegida por useBlocker) e recarregar/fechar a página: criação Compose, drawers contextuais de vínculos/balanceadores, ações do detalhe, criação/edição genérica e abertura de catálogo precisam proteger rascunho e envio pendente.
2. Hook compartilhado `usePageLeaveGuard(active, enabled)`, sem persistência de campos ou segredos e sem autosave. Usar o evento nativo beforeunload; o navegador controla a apresentação e pode exigir interação prévia para exibir aviso. Não prometer bloqueio absoluto de fechamento, encerramento de processo ou falha da máquina.
3. `modules.unsavedChangesGuard=true` liga a cobertura adicional nos controladores que já possuem dirty/pending e useBlocker. False recupera a cobertura anterior; guards já presentes em SchemaForm/Groups/NetworkPolicies/EnvironmentTemplates/BulkOperation/CatalogForm continuam funcionando. Não desativar proteções anteriores silenciosamente.
4. Evitar listeners quando não há dados/envio a proteger. Mudança de estado/flag e unmount removem o listener. Não modificar operações de backend, permissões ou shell.
5. Testes de eventos e componente com rascunho, envio pendente, sucesso, flag off/on, unmount e contexto. Build Linux/TypeScript/Vite; aceite visual/manual nativo permanece separado quando a ferramenta não permite controlar o navegador.

## Situação

Implementado nos seis controladores previstos: ResourceCreator, ResourcePanel, ServiceLinksPanel, BalancerRulesPanel, Catalog e Resources. `modules.unsavedChangesGuard=true` no laboratório; false com recarga recupera cobertura anterior. A mudança não exige alterações em regras de autorização, dados ou endpoints.

Cinco testes de eventos/componente passaram: rascunho, envio pendente mesmo sem campos sujos, sucesso/fim do envio, flag off/on sem perder texto, unmount sem listener residual e retorno ao estado limpo. Verificam cancelamento de beforeunload em DOM de teste, não a aparência do diálogo de cada navegador. Gate global: **297 testes/35 arquivos + TypeScript/Vite**.

SchemaForm e os guards prévios de Groups/NetworkPolicies/EnvironmentTemplates/BulkOperation/CatalogForm permanecem. Não foi prometida proteção contra queda da máquina ou armazenamento de rascunhos após logout. Aceite manual nativo de cada navegador ainda pendente; não confundir o evento cancelado no teste com um diálogo visual observado.
