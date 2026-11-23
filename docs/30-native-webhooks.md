# Webhooks nativos — análise e plano antes da implementação

## Contrato observado no laboratório

`/v1-webhooks/schemas` anuncia receiver, scaleService, serviceUpgrade, scaleHost e forwardPost. Requisições de receivers exigem projectId; sem ele retornam HTTP 400. O frontend original adiciona projectId a todos os requests do webhook-store. Receiver anuncia GET/POST na coleção e GET/DELETE no recurso, sem PUT: não inventar edição; criação, clone e exclusão seguem capacidades reais. UI original usa scaleService/scaleHost/serviceUpgrade; forwardPost não faz parte do recorte inicial.

## Gates de descoberta antes da UI

1. Criar receiver descartável em fixture de serviço inativo/escala zero, sem invocar endpoint. Inspecionar apenas nomes de campos/forma de URL e relação ID/segredo, sem registrar credenciais. Remover receiver e recursos exatos. Não enviar webhook, evento externo ou escalar qualquer workload existente.
2. Verificar admin, readonly, usuário sem environment e projectId alternativo. Confirmar se schemas refletem permissão ou se é necessário gate de acesso efetivo específico. Se houver falha de autorização nativa, não habilitar a UI até corrigir o gate no servidor/proxy apropriado; ocultar botão não constitui RBAC.
3. Identificar token/URL/ID secreto, tratar somente em estado privado de escopo, sem query cache/storage/logs/screenshot/relatório. URLs de invocação nunca são pré-buscadas por links, previews ou validações. Navegação interna e DELETE não podem usar URL de invocação.

## Plano da tela

Flag independente webhooks inicialmente false; escopo do environment no AppShell. Lista de nome/driver/alvo/estado, ações contextuais e criar por formulário específico de driver; schema nativo fresco, destino autorizado/mesmo environment, limites min/max e seletores tipados. Revisar impacto antes da criação; URL secreta protegida e copiar explícito; exclusão confirmada sem envio de evento. Clone repopula apenas configuração, sem duplicar tokens ou habilitar automaticamente outro destino. Mensagens honestas para serviço indisponível/driver sem laboratório.

Domínio, componente/segredo/flags, integração com fixture, RBAC, temas/axe/mobile e cleanup precedem habilitação. Rodar webhook de escala/upgrade/host é um gate operacional separado; aceitar CRUD não prova entrega do evento nem execução bem-sucedida do driver.

## Implementado e habilitado — 22/10/2026

`modules.webhooks=true`, independente de api/admin. Nova tela no AppShell, seleção de environment, busca, metadados sem URL/configuração bruta em cache; criar os três drivers, clonar apenas configuração, consultar URL protegida e excluir com confirmação. O backend não anuncia PUT; não há edição simulada. forwardPost fica somente em metadados/exclusão para quem já tem acesso, sem formulário novo. Labels usam componente reutilizável SelectorRows, com IDs estáveis e validação de duplicatas antes de converter para map. Formulários usam segundos para intervalMillis do driver webhook, conforme contrato e template legado; não confundir com o upgrade direto do serviço, em ms. Máximo de escala deve ser estritamente maior que mínimo (validação nativa observada).

### Autorização verificada

Os schemas do webhook anunciam POST/DELETE inclusive para readonly. A UI exige relatório `localAccessReports?targetAccount=self` completo, conta/ambiente verificados e papel owner/member, inclusive para admin (relatório backend retorna owner global). Revalidar relatório e contratos antes de cada escrita/consulta de URL/clonagem. Não confiar no schema estático nem em papel digitado no cliente. Identidades cujo relatório não é completo ficam sem gerenciamento nesta tela; restricted não foi liberado. O backend continua aplicando autorização independente da UI.

Provas nativas em CONSOLE-POLICY-LAB com grupos temporários: readonly lê metadados (200) e recurso individual (200), mas não recebe url; POST/DELETE são 405. Member consulta URL, cria (200) e exclui (204); acesso ao environment externo ao grant é 403. Todos os receivers/grupos/alvos exatos removidos; relatórios webhook-authorization-results.json e webhook-member-authorization-results.json. Nenhum endpoint de invocação foi chamado.

### Privacidade e gates

ID público do receiver é diferente da chave de invocação, conferido no contrato real; URL possui query key/projectId. DTO não contém url/configuração opaca/links. URL só fica no estado privado do modal e é mascarada, com mostrar/copiar explícitos; não vira anchor/prefetch. O modal limpa URL em troca de escopo/desmontagem e quando relatório atualizado retira gerenciamento. Cópia no teste de componente usa credencial sintética; nenhum clipboard real de usuário foi alterado pelo E2E. Não se afirma que remover membership revoga uma URL já compartilhada ou que a UI consegue apagar cópias anteriores.

16 testes de domínio e sete de página, total **418 testes/48 arquivos + TypeScript/Vite**. 24 checks E2E reais: 12 cenários driver × claro/escuro ×1440/390 sem violações axe/overflow, revisão/descarte, criação dos três drivers, clone com URL independente, consulta mascarada, storage sem credenciais, exclusão, zero invocações, flag off, readonly sem ações e negação de POST com payload/CSRF válidos fora do environment.

Última repetição: fixture console-webhooks-cd2cccfc, stack1st98/serviço1s128, receivers públicos 1go17–1go20. Todos excluídos pela UI; alvo preservado inactive/scale0 e removido no cleanup; nenhum receiver da fixture permanece; hashes de receivers anteriores preservados, manifest ausente. Passadas anteriores 1st95/1s125 e 1st97/1s127 também removidas. Relatórios webhooks-e2e-results.json/webhooks-a11y-results.json/webhooks-cleanup-results.json, além do contrato/roles. Sem URLs/chaves reais nos artefatos.

**Limite do aceite:** CRUD e autorização de receivers; nenhum webhook foi invocado. Não há prova de entrega de evento, scale-up/down executado, provisionamento de máquina ou atualização de serviços por registry push. Esses gates operacionais seguem separados. Nenhum replay/processo/VM existente foi alterado por webhooks.
