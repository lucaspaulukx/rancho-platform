# Upgrade de stack pelo catálogo no contexto da operação

## Checkpoint documental — 21/10/2026

228/28 é o gate histórico desta funcionalidade; a base posterior é 243/29. catalogUpgrades permanece true. O aceite final usou escala efetiva zero configurada antes do upgrade: não promete manter serviços parados nem aplicar escala pelo parâmetro do template. Administração de repositórios e matriz completa continuam pendentes.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


## Objetivo e tasks

1. Reaproveitar o drawer de catálogo, perguntas tipadas, referências e arquivos para atualizar uma stack existente. Abrir pelo menu Atualizar stack sem navegar para outra página. Flag independente catalogUpgrades, dependente de catalog/workloads; desligar retorna ao schema nativo.
2. Resolver referências catalog:// válidas no formato do laboratório; outras origens ficam no adaptador nativo. Reler stack/template e mostrar versão atual/disponíveis, sem confundir revisão do catálogo com nome da versão.
3. Inicializar perguntas com respostas atuais compatíveis, preservando números/booleanos e mascarando campos privados. Novas perguntas recebem defaults. Respostas/Compose ficam no estado do editor, sem armazenamento local nem query cache.
4. Manter o nome da stack fixo, resumo de impacto e arquivos antes do envio. Enviar somente stackUpgrade, sem startOnCreate ou criação de nova stack. Revalidar schema/action, identidade/environment, snapshot e revisão do catálogo antes do POST; recusar conflito.
5. Proteger rascunhos, troca de versão, fechamento e navegação. Ao aceitar, voltar aos detalhes da stack no mesmo painel. Rollback/finish seguem actions nativas.

## Aceite e resultado

Build Linux final: **228 testes em 28 arquivos, TypeScript/Vite aprovados**. Flag catalogUpgrades=true no laboratório. CUA abriu o editor pelo menu da stack, manteve URL/environment, preservou perguntas existentes, trouxe defaults novos, protegeu rascunho e voltou aos detalhes depois do POST. Desligar a flag recuperou o schema nativo; reativação releu versão/valores. Tema claro/escuro e drawer 390x844 sem overflow horizontal conferidos.

**Comportamento nativo observado, sem promessa de preservar serviços parados:** os dois primeiros ensaios mostraram que stackUpgrade pode iniciar serviços antes inativos e preservar a escala efetiva mesmo quando a resposta do template pede zero. Esse gate inicial falhou. As fixtures e instâncias foram removidas e auditadas. A UI agora explica os dois efeitos e exige checkbox explícito antes de habilitar envio; alterar perguntas ou versão retira esse aceite. Isso comunica o impacto ao usuário do produto; não é um pedido do assistente para trabalhar no sandbox.

O terceiro ensaio recebeu PUT explícito de escala zero no serviço **antes** do upgrade. Pela UI, ZooKeeper 3.4.6-rancher1 para 3.4.8-rancher1 persistiu a revisão community:zookeeper:1 no mesmo ID/nome/environment, memória 384 e escala efetiva zero, sem agendar containers. Finishupgrade foi enviado pelo mesmo painel. Não comprova rolling upgrade de ZooKeeper executando nem que parâmetros do template alterem a escala de serviços existentes. O aceite Alpine do documento 12 comprova substituição/rollback de containers executando.

Onze checks de API/setup/cleanup, abrangendo auditoria dos ensaios anteriores e negação real de GET/POST para usuário sem acesso ao environment, em console/catalog-upgrade-test-results.json. Nenhum grant novo. As três stacks exclusivas (1st76, 1st77, 1st78) e dependências foram removidas. Helper: console/tests/catalog_upgrade_fixture.py. Não generalizar esse aceite para todos os catálogos, drivers ou topologias.

Respostas, arquivos e fingerprint privados ficam no estado do editor. Inventário e detalhes de stacks passam por publicWorkload antes do query cache, retirando environment/answers/Compose. O editor relê esses campos fora do cache. Chaves/segredos multiline não aparecem em textarea até revelar explicitamente; quebras de linha são preservadas. Proteções são de cliente, sem CAS atômico, e não substituem o backend.

Capturas: evidence/console-catalog-upgrade-{review,applied,light,mobile}.png. O review final mostra o aviso e o aceite desmarcado; envio fica desabilitado. Administração de repositórios, migração entre serviços, versões/origens legadas e matrizes completas de orquestradores continuam pendentes. Os assets Ember não foram modificados.
