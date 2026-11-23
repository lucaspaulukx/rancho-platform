# 34 — Compose de stack existente

## Plano anterior à implementação

Fluxo contextual F5: menu Atualizar stack abre editor de Docker/Rancher Compose para stacks Cattle próprias, com Compose de origem persistido, sem externalId ou system. Stacks de catálogo mantêm o fluxo de versões/perguntas do doc13. Flag stackComposeUpgrades, independente da criação stackComposeEditor. Desativar mantém o formulário nativo anterior.

Abertura relê stack/schema e exporta configuração atual via action exportconfig, sem usar texto antigo de criação como estado corrente. Compose e parâmetros ficam apenas em estado privado do drawer, ocultos por padrão, com os mesmos editores compartilhados. Comparar exportação e metadados/estado antes do envio; revalidar schema e action com destino local exato, escopo, conta e ciclo de vida. Não prometer CAS atômico.

Revisão com aceite do impacto: upgrade pode iniciar serviços e substituir containers. A escala dos serviços existentes é preservada pelo executor; novos serviços exigem cuidado com o padrão nativo de escala. Exportação nativa não é cópia completa do estado do ambiente. Parâmetros existentes environment/answers/templates serão preservados quando suportados pelo contrato atual, sem editor adicional. Erros sanitizados, rascunho protegido em fechamento/rota/recarga e mutação sem segredo em cache.

Após envio, voltar ao mesmo drawer/lista, preservar busca/environment/expansões. Acompanhar estado upgrading/upgraded; finishupgrade/rollback/cancelupgrade continuam ações nativas no drawer. Aceites devem usar fixture exclusiva de escala zero antes de qualquer validação física.

## Validação planejada

Sondagem da exportação e native stackUpgrade, persistência e rollback/finish com fixture escala zero. Testes de contrato, escopo, alteração concorrente, privacidade/guards, flags, menu contextual e formulário no navegador; temas/acessibilidade/móvel, negação com payload/CSRF válidos e cleanup identificado por marker. Não chamar a fase inteira de completa por testar configuração sem containers.

## Implementado e validado — 23/10/2026

Flag stackComposeUpgrades=true. Build 493 testes/56 arquivos + TypeScript/Vite, com nove casos de domínio, sete de painel e metadados de inventário. Editor no drawer de Atualizar stack, mantendo catálogo de versões/perguntas para stacks de catálogo. Exportação nativa para estado privado, ocultação inicial e na revisão, proteção de navegação/fechamento/recarga, schemas/exportação/snapshot frescos e destino local exato. environment/answers/templates existentes preservados conforme contrato; sem CAS atômico. Resposta da mutação e inventário não guardam Compose/parâmetros; somente hasComposeSource é derivado para escolha de fluxo, sem aparecer na configuração nativa exibida.

15 registros de checks E2E (incluindo revisão repetida nos dois upgrades), quatro cenários claro/escuro ×1440/390 sem violações axe/overflow. O harness confere data-theme aplicado e mascara textarea em screenshots. Menu contextual, exportar/editar/revisar, imagem efetivamente alterada no serviço, parâmetro preservado, busca/rota/environment mantidos, rollback restaurado, segundo upgrade finalizado, escala0 mantida e nenhuma instância criada na fixture aceita. Flag off volta ao formulário nativo anterior. POST de usuário sem acesso ao environment negado com CSRF e payload válidos.

Sondagem nativa aceita: 1st101/1s131; repetições UI 1st102/1s132 e final 1st103/1s133, todas removidas e hashes de serviços/IDs de volumes anteriores preservados. Manifest próprio ausente. Relatórios stack-compose-upgrade-contract-results.json, stack-compose-upgrade-e2e-results.json, stack-compose-upgrade-a11y-results.json e stack-compose-upgrade-cleanup-results.json.

### Particularidades nativas comprovadas

- Stack manual sem dockerCompose de origem pode atingir upgraded sem aplicar o arquivo. O executor retorna vazio nesse caso. Essa tentativa (1st99/1s129) não foi aceita; a nova seleção exige proveniência e a preflight relê o campo. Stacks manuais usam os editores de serviços; o comportamento genérico anterior continua sob fallback.
- getConfiguredScale considera apenas valores positivos e usa1 como padrão na criação por Compose. O primeiro seed Compose solicitou0 e criou serviço com escala1 (1st100/1s130), um registro de container de teste em erro1i919 e volume anônimo1v951. A stack, o container e o volume destacados foram removidos nativamente, após verificar markers/labels/instanceId; configurações e volumes anteriores preservados. Evidência em stack-compose-upgrade-probe-notes.json. Não contar essa tentativa como gate de execução zero.
- O seed corrigido cria sem startOnCreate, espera o serviço inativo, aplica scale0 pela API nativa e então testa upgrade. NormalFactory.Upgrade copia a escala existente; o upgrade/rollback/finish aceito preservou0, confirmado na API e sem instâncias. O aviso na UI distingue escala existente de novos serviços. Alterar escala deve usar o comando Escalar serviço já implementado.
- Remover uma definição do YAML não constitui aceite de exclusão de serviço. Use as ações nativas contextualizadas para exclusão. Este recorte não comprova todas as opções de Compose, TLS, armazenamento, sidecars ou execução física.

Fontes locais conferidas: references/rancher-compose-executor/executor/handlers/upgrade_handler.go, rancher/service.go:getConfiguredScale e rancher/normal.go:Upgrade. A imagem realmente mudou no serviço nos testes aceitos; resposta HTTP/estado da stack isolados não foram usados como prova funcional.

