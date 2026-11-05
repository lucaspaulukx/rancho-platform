# Processos administrativos — plano e aceite

## Recorte

- Flag `modules.processes`, desligada até aceite. Tela própria no AppShell, administração global. Listagem limitada a 100 registros por request, cursor anterior/próximo, busca somente na página. Filtros nativos por situação (todos/em execução/aguardando/concluídos), processo, tipo/ID do recurso. Não carregar todo histórico.
- DTO estrito antes do cache: identificadores, timestamps, phase, exitReason identificador, execução/priority; nenhum data/result/objeto livre do engine. Detalhe contextual reutiliza modal/teclado/tema.
- Replay com flag independente `modules.processReplay`, schema e link atuais anunciados, snapshot concorrente e guard de identidade/unmount. Revisão do processo/recurso e confirmação de risco de repetir efeitos no recurso; nenhum retry automático.
- A ação nativa redefine runAfter/executionCount e publica PROCESS_EXECUTE. Não é recriação de workload nem garantia de sucesso; acompanhar refresh do servidor. Não prometer idempotência de handlers.
- Testes: domínio/DTO/filtros/paginação/guard de concorrência, componente e build; navegador leitura admin/leitor/temas/flag; replay real apenas sobre processo de fixture descartável identificada com cleanup. Nenhum replay em workloads existentes, HA ou processos de outros projetos.

Contrato: processInstance somente GET no recurso, com action replay declarada. Não exigir PUT para essa action POST — o servidor distingue leitura de mutação por action. Filtros runningProcessServerId/endTime/runAfter conferidos no schema e fonte original. Result/data são omitidos por poderem conter payloads e credenciais. HA/pools são tarefas separadas e ainda não incluídas.

## Implementado e validado

`modules.processes=true`, `modules.processReplay=true` no laboratório, controlados separadamente. 10 testes de domínio e 7 de componente: DTO, cursores, filtros, action sem exigir PUT, negação de links fora de escopo, revalidação/concorrência/permissão revogada, cache de mutação sem resposta bruta, flag replay somente leitura. Build e E2E com 13 checks reais aprovados: cursor/filtro, quatro temas/viewports sem axe/overflow, replay exato, recurso preservado, flags e negação nativa/UI para leitor.

Fixture `console-process-f707a22b`, credencial 1c416, processo 1pi18625 credential.deactivate. O replay nativo foi aceito e executionCount foi redefinido para zero; chave permaneceu inactive e seu hash de metadados foi preservado. Isso prova envio/semântica do handler nativo e não garante repetição bem-sucedida ou idempotência de todos os handlers. Atualizar metadados de credential não produz credential.update neste backend; o teste usa o processo real de desativação concluído. Não houve replay em recursos existentes. Fixture revogada, manifest ausente.

Relatórios `console/processes-e2e-results.json`, `processes-a11y-results.json`, `process-cleanup-results.json`. Comparação fresh não é CAS atômico; não elimina janela entre GET/POST. HA/pools continuam pendentes.
