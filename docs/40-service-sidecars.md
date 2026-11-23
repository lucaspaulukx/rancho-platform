# 40 — Sidecars na criação de serviços

## Plano antes do código

Contrato runtime confirmado: service.secondaryLaunchConfigs é array[secondaryLaunchConfig], create=true/update=false; nome obrigatório único1–63, caracteres a-zA-Z0-9-. Cada item tem imagem e configuração de container/saúde/rede/volumes/labels. Não inferir suporte a PUT para adicionar sidecars.

Flag workloadSidecars independente. Campo JSON genérico substituído, somente na criação de serviço, por grupos de formulários reutilizando EditorField/seções/portas/volumes/saúde do mesmo design system. Adicionar/remover sidecar com chaves estáveis e nome/imagem obrigatórios. Cada sidecar identificado no fieldset. Não introduzir layouts/páginas paralelos. Off volta ao JSON genérico, preservando payload/API existentes.

Validar quantidade, nomes únicos (inclusive container primário), imagem, schema criável fresco e referências entre launchConfigs. Não aceitar referência a nome ausente ou a si mesmo, ciclos de compartilhamento de rede/volumes; remover/renomear sidecar referenciado deve exigir corrigir vínculos antes de enviar. Campos de saúde aninhados nas listas devem passar pelo mesmo validador. Sem novos comandos shell ou descoberta de imagens externas.

Aceite: domínio/componentes para inclusão/remoção/chaves/duplicatas/referências/campos revogados. UI criação de serviço com dois sidecars, temas reais claro/escuro ×desktop/móvel, payload/persistência nativos escala0/startOnCreate=false. Hashes de recursos anteriores/volumes/containers preservados, cleanup exclusivo. Compartilhamento físico de volumes/rede e upgrade de sidecars são gates separados; não declarar concluídos pela persistência.

## Resultado

Implementado com flag workloadSidecars=true. Cada sidecar reutiliza WorkloadSections/EditorField e editores de bindings/saúde conforme flags; nome/imagem obrigatórios, chaves UUID estáveis, remoção não reaproveita estado de outro container. Defaults apenas criáveis, campos kind/stackId/startOnCreate não duplicados no formulário do sidecar. Campos de referência usam nomes nativos, sem inventar IDs. Validação antes do payload e com schema fresco.

Build524 testes/60 arquivos + TypeScript/Vite; sete testes novos de nomes/imagens/contrato/referências/ciclos e estado preservado após remover primeiro item. Validador de saúde passou a percorrer arrays de schemas, cobrindo secondaryLaunchConfigs. Nenhum campo mode/chave interna de UI vai para API.

Dez checks E2E/quatro cenários de tema real claro/escuro ×1440/390 com zero axe/overflow: dois sidecars, healthcheck HTTP aninhado, duplicatas bloqueadas antes da requisição, persistência nativa escala0/inativo, filtro/contexto e flag off. Inspeção visual rejeitou primeira estrutura mesmo com axe aprovado: muitos fieldsets aninhados estreitavam o móvel. Duas camadas redundantes removidas; screenshot e matriz repetidos. Primeiros timeouts do harness eram seletores por legenda que mudava ao renomear e Sidecars ambíguo com flag off; corrigidos sem desabilitar validações.

Verificação nativa aprovada: worker/cache e HTTP aninhado, escala0/inativo/sem instâncias; POST de criação de serviço negado403 para identidade sem environment. Fixture final removida, hashes anteriores/containers/volumes preservados e manifest ausente. Relatórios sidecars-e2e-results.json/sidecars-a11y-results.json/sidecars-native-results.json/sidecars-cleanup-results.json. Upgrade de sidecars e efeitos físicos de compartilhamento/rede/saúde continuam abertos.
