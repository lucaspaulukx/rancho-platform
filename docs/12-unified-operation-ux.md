# Operação unificada: listas verticais e ações no contexto

## Checkpoint documental — 21/10/2026

Esta entrega corresponde ao marco de 212 testes; a base posterior chegou a 243/29 com catálogo (documento 13) e escala (documento 14). As referências abaixo a upgrade de catálogo pendente são históricas daquele marco. O relatório unified-operation-test-results.json hoje contém 14 checks, pois agregou os readbacks posteriores de escala; os oito originais não são uma suite adicional independente.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


## Requisito do usuário

Manter a experiência do Rancher: stacks alinhadas verticalmente, serviços/containers abaixo e menu `…` para operar cada recurso. Logs, terminal, reinício e edição não devem exigir navegar por telas diferentes.

## Entrega e sequência

1. Criar menu de ações compartilhado, com teclado, Escape/clique externo, foco e posicionamento sem corte pelo card. Exibir somente capacidades nativas e módulos disponíveis.
2. Substituir os vários ícones/botão Gerenciar da operação por um `…` por linha, preservando nome clicável e hierarquia. Stacks oferecem criação, ações nativas, exportação e reinício dos serviços com confirmação por alvo; containers oferecem logs/terminal/lifecycle.
3. Abrir logs/terminal diretamente pelo menu de stack ou serviço. O painel permite escolher o container ali mesmo, com teardown ao trocar e consentimento novo para terminal. Não fingir que logs de um container representam a stack inteira.
4. Usar o mesmo workspace nas entradas Stacks, Serviços e Containers, com visões/filtros locais e drawers compartilhados. Preservar rotas de detalhe existentes como deep links, sem exigi-las para ações diárias.
5. Integrar upgrades/rollback e catálogo nesse padrão de painéis. O inventário continua em três coleções paginadas, sem requisição por linha.

## Configuração e autorização

Flag visual `modules.contextActions`, dependente de workloads, permite rollback da nova interação para os comandos anteriores. Logs/terminal seguem `observability`; ações em lote seguem `bulkActions`. A flag não concede acesso. Nenhuma ação destrutiva é enviada diretamente ao clicar no menu: abre confirmação/formulário e revalida capacidades/escopo antes do POST.

Menu de um pai usa todos os recursos associados desse environment, independentemente do filtro de pesquisa visual. Explicitar número de alvos na confirmação; não ampliar o escopo para outros environments ou infraestrutura oculta por coincidência de nomes. Seleção de logs exige vínculo real por IDs e capability atual.

## Atualização de imagem do serviço

Flag `modules.workloadUpgrades` habilita um formulário específico para a estratégia nativa `inServiceStrategy` dos serviços de aplicação. Campos: imagem de destino, lote, intervalo em milissegundos e iniciar antes de parar. Exibir imagem atual e resumo da estratégia; não prometer zero downtime. O envio relê o serviço e constrói o payload a partir da configuração mais recente, preservando portas, variáveis, volumes e sidecars, filtrados pelo contrato de criação dos schemas. Rejeitar números vazios/fracionários, imagem vazia e contrato incompleto. Configurações não são gravadas no navegador. Desativar a flag retorna ao formulário nativo genérico. Atualização de stack/versão de catálogo e migração entre serviços continuam etapas separadas; não contam como aceitas por esse formulário.

## Aceite

- Nome/menu abrem drawers e preservam URL, environment, busca e expansão da lista.
- Logs e terminal acessíveis no contexto de stack/serviço/container, sem visita à tela de containers. Troca de container não mistura buffers nem reaproveita consentimento de execute.
- Menu funciona por teclado, em temas claro/escuro e viewport móvel; não fica cortado no fim da lista nem provoca overflow horizontal.
- Readonly vê somente operações de consulta. Desligar flags retira os comandos e fecha viewers conforme suas regras existentes.
- Lifecycle com fixtures sintéticas comprova estado backend; toast ou abertura de modal não bastam. Registrar o que passou e o que permanece pendente, sem declarar a migração completa só pela nova apresentação.

## Resultado em 21/10/2026

- Workspace compartilhado nas três entradas, tabs locais, menus por linha, criação vinculada à stack, detalhes/lifecycle e logs/terminal com seletor de container implementados. Há três coleções paginadas; nenhuma consulta por linha foi adicionada.
- 212 testes em 25 arquivos passaram no Linux, com TypeScript/Vite. Incluem teclado/clique externo/foco, relações por IDs/environment, readonly/flags, troca e teardown de logs em componente, navegação local, callbacks antigos após troca de contexto e preservação de configuração no upgrade.
- Browser CUA conferiu os temas claro/escuro, menu invertido no fim da lista, viewport 390×844 sem overflow horizontal e foco em Ver detalhes ao abrir, Escape retornando ao `…`. Entrada Containers agora abre a visão correta: navegação entre áreas preserva somente `env`, sem carregar `view` da tela anterior.
- Desligar `contextActions` retornou aos botões Gerenciar; desligar `workloadUpgrades` retornou ao schema genérico. Flags restauradas como true no laboratório.
- Fixture exclusiva `console-upgrade-17991543` (`1st74`, serviço `1s100`, escala zero): UI fez upgrade Alpine 3.20→3.21, rollback→3.20, novo upgrade e finishupgrade→active em 3.21, preservando variáveis, comando, rede e escala. Os cinco checks de API/cleanup estão em `console/upgrade-test-results.json`. Fixture removida.
- O bloqueio do host foi resolvido com autorização explícita do usuário: registro existente reposto somente no arquivo privado da VM original, host/agente active. Posteriormente, o usuário liberou autonomia para o sandbox. Oito checks físicos/setup/cleanup passaram: dois containers reais, marcadores distintos, reinício, tag local, upgrade, rollback e remoção exclusiva da fixture/tag. Upgrade e rollback substituíram os dois IDs de container, preservando comando, rede e escala 2. A tag v2 usa a mesma Alpine cacheada: comprova substituição e reversão do workload, não mudança do binário, registry remoto, multi-host ou zero downtime.
- Evidências: `evidence/console-unified-context-{dark,light,mobile}.png`, `console-context-actions-disabled.png` e `console-service-upgrade-form.png`. Upgrade de stack/versão de catálogo, formulários completos e demais gates continuam pendentes no roadmap. Aceite físico adicional: `console-context-live-{logs,terminal,restart,upgrade,rollback}.png`. Logs confirmaram marcador 1 ausente após trocar para container 2 e vice-versa; terminal executou printf e exigiu nova conexão após trocar de alvo.

### Correção encontrada no aceite físico

O endpoint serviceRestart exige rollingRestartStrategy. O POST vazio dos lotes retornou 422 MissingRequired; o toast foi tratado como falha, sem declarar sucesso. O adaptador compartilhado agora envia batchSize=1 e intervalMillis=2000 para service/loadBalancerService, mantendo restart de container sem esse corpo e preservando estratégias explícitas. O formulário individual recebe os mesmos defaults e o lote explicita a estratégia antes da confirmação. Regressões de contrato e transporte cobrem a diferença. O teste físico foi repetido e comprovou alteração dos containers.
