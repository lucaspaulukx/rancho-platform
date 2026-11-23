# 45 — Delegação das fontes por environment

## Plano antes do código

F6: oferecer o editor contextual já existente a owner/member do environment selecionado. Flag environmentCatalogDelegation independente; off mantém administração global existente. Não alterar grants nem liberar repositórios globais.

Reutilizar relatório self completo, conferindo conta e environment atuais; falhar fechado se inconclusivo. Ocultar controles de readonly/restricted/sem acesso. Revalidar identidade/permissão antes de abrir dados privados ou escrever, além do scope/snapshot existentes. Revogação desmonta editor e elimina URLs do estado. CATALOG_WRITE_GUARD_ENABLED continua proteção backend independente.

Aceite de papéis/IDs/incompleto, revogação simulada e OIDC real member/readonly; CRUD de fonte própria com URL loopback fechada, sem refresh global ou stack. Hashes das fontes anteriores preservados no finally. Claro/escuro/móvel reutilizam editor comum. Owner nativo já passou no contrato36; aceite visual de owner não deve ser inferido sem sessão própria.

## Estado

Implementado e habilitado após22 checks browser com OIDC real: Member operador em RBAC-DEV cria/edita/remove fonte própria, preserva URL/branch/contexto e fontes anteriores; readonly leitor sem controles e POST nativo403 com sessão/CSRF válidos e delegação ativa. Oito cenários axe/layout (inventário/editor × claro/escuro ×1440/390), sem violações/overflow e URL mascarada. Flag off remove a entrada do Member, sem alterar dados. Nenhum grant existente foi alterado, sem refresh global nem stack criada. URL de teste aponta para porta loopback fechada; não prova clone/sincronização Git.

Oito testes de domínio/hook: owner/member apenas com conta e environment exatos, relatório completo, negação readonly/restricted, revogação entre abertura e envio, erro de polling desabilita autorização antiga, troca de identidade bloqueia escrita, flag off, admin rebaixado/atual e erro sanitizado. O código revalida sessão atual e relatório antes de ler URL privada ou escrever; erro de API não expõe payload. O editor é desmontado quando a autorização da página deixa de permitir acesso; polling10s não constitui revogação instantânea. A proteção backend de escrita continua independente.

Relatórios delegated-catalogs-e2e-results.json/delegated-catalogs-a11y-results.json; finally compara todas as fontes com baseline após remover exclusivamente nome/URL/environment da fixture. Repetição: python -u console/tests/e2e/run.py delegated-catalogs. Usa contexto Chromium próprio e contas sintéticas existentes, sem persistir senha/storageState. Owner tem contrato nativo e testes de domínio, sem novo aceite visual OIDC de Owner. Módulo geral environmentCatalogs precisa estar ativo. Off na delegação preserva editor para admin; não modifica RBAC/backend.

Gate final555 testes/63 arquivos + TypeScript/Vite, formatação aprovada. Editor administrativo original repetido após a mudança; smoke e Sobre/capacidades passaram no build servido.
