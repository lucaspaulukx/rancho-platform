# 41 — Sidecars no upgrade de serviços

## Plano antes do código

Usar serviceUpgrade/inServiceStrategy.secondaryLaunchConfigs, sem PUT imutável. Flag workloadSidecarUpgrades independente da criação e do upgrade de saúde/bindings. Editar sidecars explicitamente no drawer existente; reutilizar o editor por container. Arrays existentes normalizados apenas pelo schema criável, preservando configuração primária; formatos legados de healthcheck não compreendidos bloqueiam opt-in em vez de converter silenciosamente.

Validar nomes/ref/ciclos com serviço principal e configuração primária real. Snapshot completo de launchConfig/secondaryLaunchConfigs antes do envio para recusar mudança concorrente; schemas frescos para todas as opções aninhadas. Revisão explica criação/substituição/remoção de containers auxiliares e impactos de volumes/rede. Array vazio remove sidecars explicitamente. Payload mantém imagem primária e demais campos não editados. Flags podem ser combinadas, mas cada editor tem opt-in e gate independente.

Aceite domínio/componentes: adicionar/editar/remover, no-op, contratos/referências revogados, preservação de campos e snapshot; UI real com zero escala, sidecar existente→editar/adicionar, rollback exato, repetir/finish e removerarrayvazio. Temas efetivos/axe/responsividade e preservação do contexto. Cleanup exato/sem instâncias e recursos anteriores preservados. Não declarar compartilhamento/rede/execução física por prova de persistência.

## Resultado

Implementado no drawer atual: workloadSidecarUpgrades=true controla opt-in separado. Editor SidecarsEditor compartilhado com criação, preservando chaves estáveis; origem normalizada pelo schema criável, revisão e snapshot completo, array vazio explícito para remover. ServiceUpgradeForm mantém a imagem principal e os campos não editados. ResourcePanel busca coleção completa de schemas frescos ao editar sidecars e revalida cada campo aninhado para evitar filtragem silenciosa de opções revogadas.

Build529 testes/60 arquivos + TypeScript/Vite aprovado. Cinco testes novos de payload/formulário cobrem adicionar/editar/remover, primário preservado, no-op, concorrência, campo revogado, revisão e flag off; testes de criação/saúde anteriores continuam passando. Matriz browser/lifecycle final aprovada: 13 checks, quatro cenários axe/tema real sem violações/overflow, edição da imagem de sidecar existente e inclusão de outro, configuração primária/env auxiliar/escala0/contexto preservados. Rollback restaura arrays anteriores; repetir/finish, remoção total com marcadores nativos e finish mantêm primário/escala. Flag off e negação de POST fora do environment validadas. Fixture final 1st112/1s144 removida, configurações/volumes anteriores preservados e nenhuma instância agendada. Manifest ausente. Relatórios sidecar-upgrade-e2e-results.json/sidecar-upgrade-a11y-results.json/sidecar-upgrade-cleanup-results.json.

Readonly de upgrade compartilha o endpoint/ação exercitados no recorte39 (422 InvalidAction, ação ausente e configuração preservada); a suíte41 prova negação fora do environment, sem declarar uma nova matriz completa de papéis/cada campo. Execução física de sidecars/rede/volumes continua gate separado.

## Contrato de remoção descoberto no aceite

A primeira tentativa de remover todos com secondaryLaunchConfigs=[] chegou a upgraded, mas os dois sidecars continuaram presentes. Esse resultado foi rejeitado. ServiceUpgradeValidationFilter.finalizeUpgradeStrategy mescla configs existentes omitidas e só remove sidecars cujo imageUuid é ServiceConstants.IMAGE_NONE, valor rancher/none. Portanto a lista visível desejada é traduzida para itens finais mais marcadores {name:<nome anterior ausente>,imageUuid:rancher/none}. Marcadores adicionados após normalização de imagens, preservando valor nativo sem prefixo docker:. Nomes omitidos ou renomeados são tratados explicitamente; não usar ausência como remoção. Imagem reservada não pode ser informada manualmente. Serviços selectorContainer ficam fora deste editor, pois o backend condiciona a remoção a selectorContainer==null.

Teste adicional cobre rename/marcador e imagem reservada. Repetição nativa com contrato corrigido aprovada; não interpretar upgraded como aplicação correta sem conferir secondaryLaunchConfigs.
