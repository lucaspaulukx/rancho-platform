# Criação contextual de stacks por Compose

## Resultado posterior — 22/10/2026

**Implementado e habilitado no laboratório.** stack-compose.ts valida arquivos UTF-8 até 512 KiB, nomes/variáveis/permissões; ComposeEditor e StackComposeForm reutilizam drawer/guards existentes. startOnCreate começa false; stack vazia não envia arquivos/variáveis. Schema é relido antes do POST e campos revogados são recusados. Fonte não usa parser YAML no navegador nem armazena arquivos/variáveis em preferências/query cache. Mutations permanecem gcTime 0.

Onze testes específicos passaram. Gate posterior com checkboxes: 255 testes/30 arquivos + TypeScript/Vite. O primeiro build da entrega apontou pluralName ausente na fixture de schema TypeScript; corrigido antes do aceite.

CUA criou stack vazia 1st80 e stack Compose 1st81 em UI-OPS-LAB. Readback preservou dois arquivos, descrição/nome, interpolação MESSAGE UTF-8, imagem Alpine 3.20, rede host e escala 1. Início desmarcado manteve serviço inativo sem instâncias; menu Iniciar serviços depois produziu um container físico no host 1h1. Não generalizar para todos os formatos Compose, outras redes ou criação com startOnCreate=true (essa variante tem contrato/teste de componente, sem aceite físico separado).

Oito checks nativos em console/compose-creation-test-results.json, incluindo POST negado ao leitor sem environment e remoção das duas stacks/serviços/instâncias; sete checks browser em console/compose-creation-browser-test-results.json. Não somar como cobertura independente. A primeira tentativa de cleanup parou por falta do ID da stack vazia no manifest; releitura recuperou o ID e cleanup idempotente foi concluído, sem remoção por prefixo. Manifest compose-creation-fixture.json ausente.

Flag stackComposeEditor=true: off/on conferidos com recarga, fallback genérico preservado. Claro/escuro e 390px conferidos. Capturas console-compose-create-{dark,light,mobile}.png em evidence/. O plano e checkpoint de 21/10 abaixo são históricos e foram superados neste recorte.

## Checkpoint documental — 21/10/2026

A execução foi interrompida pelo pedido de handoff após redigir este plano. Não existe implementação de StackComposeForm/ComposeEditor nem flag stackComposeEditor no código/JSON; não houve build/teste/fixture deste fluxo. Próxima IA deve começar pela implementação, preservando a criação genérica atual.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


## Plano da entrega F5

1. Adicionar `modules.stackComposeEditor`, inicialmente desligada, mantendo o formulário nativo genérico como reversão.
2. No drawer compartilhado de criação de stack, oferecer stack vazia ou importação Compose. Nome e descrição permanecem comuns; os dois arquivos usam editor multilinha reutilizável, fonte monoespaçada, contagem de linhas e controle de visibilidade. Não persistir arquivos ou variáveis em storage/cache.
3. Permitir variáveis de interpolação como pares nome/valor, valores ocultos por padrão. Preservar os arquivos literalmente; não converter YAML nem prometer compatibilidade com Docker Compose moderno. O Rancher 1.6 valida a sintaxe e compatibilidade no servidor.
4. Importação nasce com iniciar serviços desmarcado, decisão explícita do usuário. Stack vazia não envia arquivos/variáveis. Limitar cada arquivo a 512 KiB UTF-8 e respeitar campos criáveis do schema atualizado antes do POST. Desabilitar submissão enquanto pendente, manter rascunho em erro e bloquear saída com alterações.
5. Validar contratos, descarte, campos privados, limites e permissões em testes; build Linux; criação real pelo navegador no UI-OPS-LAB, readback de serviços/configuração, testes de flag e viewport/temas. Remover exclusivamente a fixture identificada.

## Aceite e limites

O fluxo fica na operação vertical existente, com navbar/sidebar e drawer compartilhados. A criação é assíncrona; resposta HTTP não garante sucesso da importação. Erros de parser/processamento podem aparecer no estado da stack e devem ser inspecionados na operação. Importar arquivo do disco, busca em Git, validação YAML no navegador, edição/upgrade de Compose de stack existente e todas as opções do formulário avançado permanecem fora desta entrega; o formulário genérico segue disponível com a flag desligada.

## Situação

Planejado; implementação e aceite ainda pendentes.

## Contrato nativo conferido antes do handoff

Leitura autenticada do schema `projects/1a12/schemas/stack` em 21/10/2026:

- name: obrigatório, 1–63 caracteres, validChars a-zA-Z0-9-, create/update true.
- description: até 1.024 caracteres, create/update true.
- dockerCompose e rancherCompose: string, create true, update false.
- environment: map[string], create true, update false.
- startOnCreate: boolean, create true, update false.

A rota clássica `ui/app/stacks/new/route.js` inicializa startOnCreate=true. O plano novo propõe início desmarcado para importação, com escolha explícita; ainda não foi aplicado. Não tratar YAML moderno como automaticamente compatível. O schema deve ser relido no submit; a conferência documental não substitui validação no fluxo implementado.
