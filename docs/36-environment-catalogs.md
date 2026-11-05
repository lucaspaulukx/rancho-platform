# 36 — Catálogos por environment

## Plano antes da implementação

A UI legada env-catalog usa v1-catalog/catalogs com X-Api-Project-Id e POST/PUT/DELETE, mas o schema estático observado anuncia somente leitura. Antes do formulário, sondar o contrato real em CONSOLE-POLICY-LAB com URL localhost porta fechada e cleanup por nome aleatório. Não inferir escrita permitida pelo schema ou pela presença do componente no checkout de UI, cuja versão pode exceder o backend1.6.30.

Se suportado: drawer no próprio catálogo, ambiente atual explícito, distinção entre fontes globais e próprias, campos nome/URL/branch/tipo nativo. URLs privadas fora do cache e mascaradas, revisão e escopo/identidade revalidados; não executar JavaScript externo ou templates. Flag environmentCatalogs independente; permissões backend e matriz readonly/member/owner antes de habilitar. Alterações globais continuam no recorte33.

Se não suportado: documentar limite, não fabricar CRUD nem habilitar flag; avaliar o endpoint nativo/env model e necessidade de extensão compatível no backend antes de implementar. Aceite de configuração e de clone/sincronização física são separados. Dump real e produção fora desta etapa.

## Resultado

Contrato real confirmado: POST200, PUT200 e DELETE204 em CONSOLE-POLICY-LAB, com URL loopback fechada. Schema estático não representa os verbos efetivamente disponíveis. Baseline de fontes preservada no finally. A fonte global continua sendo configurada por settings/catalog.url.

Implementado no novo frontend: botão Fontes do environment no próprio Catálogo, drawer com fontes globais versus próprias, criação/edição/exclusão de catálogo nativo Cattle. Nome fixo após criação; URL mascarada por padrão e fora dos caches de queries/mutações; listagem principal do Catálogo também passa a sanitizar fontes antes do cache. Validação de URL/branch compartilhada com repositórios globais. Revisão, descarte, bloqueio de navegação e preflight com snapshot/escopo antes do envio; não há CAS transacional no serviço nativo.

Flag environmentCatalogs independente de catalogRepositories. Nesta entrega o editor permanece exclusivo de administrador; delegação a owner/member exige aceite de UI e acesso efetivo específico antes de habilitar. Outros tipos aparecem somente para consulta. Preservação de fontes globais, filtros/URL e stacks existentes; nenhum template lançado, nenhum refresh remoto solicitado. Aceite de clone/sincronização continua pendente.

## Falha nativa de autorização encontrada e correção

O probe com grant temporário readonly confirmou PUT200 na API de catálogo. O proxy apresenta GET ao pipeline por ProxyPreFilter, mas encaminha o verbo real sem exigir papel de escrita para catálogos. Ocultar botão não corrige o endpoint.

A correção valida o verbo real antes do forwarding em GenericWhitelistedProxy, para caminhos /v1-catalog e seus descendentes, inclusive acesso pelo proxy genérico. GET/HEAD continuam permitidos pela autorização de acesso ao environment; mutações exigem admin/superadmin/owner/member e variantes v1, provenientes somente da Policy autenticada. Headers de papel enviados pelo cliente não concedem acesso.

RANCHER_CATALOG_WRITE_GUARD_ENABLED=true por padrão, configurável no Compose e divulgado em /oidc/config. É independente da flag visual: desligar o editor não remove a proteção. false restaura o comportamento legado permissivo e serve apenas para reversão controlada. Build overlay inclui a classe e suas classes internas no JAR api-logic; nenhuma alteração do frontend Ember.

## Validação

Build frontend501 testes/57 arquivos + TypeScript/Vite. Oito testes novos cobrem sanitização, escopo global/outro environment, identidade/snapshot, duplicatas, herança de URL e validação de paths/branch. E2E real com criação, edição e exclusão, nome imutável, preservação de filtros e fontes anteriores, URLs mascaradas, flag off. Oito cenários axe/layout com data-theme efetivo (claro/escuro ×1440/390, inventário/editor), sem violações ou overflow de página. Tabela mantém scroll interno compartilhado. Fixtures próprias removidas.

Gate backend aprovado: sem acesso POST403; readonly PUT403, POST/DELETE403 mesmo com X-Api-Roles falsificado e PUT pelo proxy genérico403. Member/owner PUT200; admin POST/PUT200 e DELETE204. Grupo temporário removido, baseline de fontes preservada. 115 asserts Java de configuração em64 combinações passaram. Repetição final20 checks E2E e smoke5 aprovados. Evidência anterior rejeitada: readonly PUT200; cleanup=true e grupo temporário removido. Relatórios environment-catalog-contract-results.json, environment-catalogs-e2e-results.json e environment-catalogs-a11y-results.json.

O primeiro harness visual apresentou contraste transitório ao alternar tema antes da auditoria. A repetição aguarda effects do modal e término de transições CSS finitas antes de axe; não filtra regras ou violações. Relatório final possui oito cenários com appliedTheme correto e zero violações/overflow. URL de input password mascarada nas screenshots.

Pendências explícitas: UI delegada owner/member, CRUD completo por esses papéis e revogação concorrente; matriz de chaves técnicas e tipos/orquestradores adicionais; clone/commit/sincronização física e refresh. A matriz atual valida edição por member/owner, sem inferir todos os demais verbos para esses papéis.
