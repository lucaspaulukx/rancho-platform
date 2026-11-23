# 84 — Métricas de serviços no contexto da stack

Plano antes de implementar; OPS13 continua aberto. O backend81 já fornece lote de containerStats de serviço, mas a console só expõe métricas de host/container. O teste de transporte81 substituiu descriptor apenas no navegador e não entregou essa interface.

## Experiência e funções

No menu ... do serviço, ação Métricas abre o drawer compartilhado mantendo environment/stack, sem criar página nem duplicar navbar/sidebar. Usa o mesmo toolbar de pausar/retomar/reconectar, estados de conexão/permissão e controles de CSV; todos com rótulos/foco/teclado e tokens de tema comuns. Flag aditiva modules.serviceMetrics=false exige métricas/observabilidade/workloads/contextActions; rota/menu e componente conferem dependências. Ausência equivale a false e não muda o recurso.

O drawer mostra réplicas autorizadas e estado da cobertura; selecionar uma réplica preserva a conexão negociada de serviço. Não chamar soma de contadores assíncronos de taxa agregada. Primeiro recorte: séries por réplica, buffer independente, CPU/memória/rede/disco calculados com timestamps dessa réplica e contadores anteriores dela. Resets/restarts/removidos viram lacunas. Agregação de serviço só poderá ser apresentada com política temporal e cobertura explícitas testadas; não inventar zeros para fontes ausentes.

## Contrato de dados e limites

Revalidar serviço no environment atual e suas links/actions; descobrir link containerStats e coleção instances, sem endpoint privilegiado inventado. Snapshot autorizado de instâncias com id/uuid/externalId só do serviço corrente; frames de outros containers ignorados. Service type e estado precisam de allowlist compatível com a API real (service, não presumir suporte a LB/DNS/external). Replica ausente/desconhecida não entra nos gráficos. Mudanças de réplicas exigem atualização da associação antes de aceitar novos IDs; revogação/contexto/fechamento abortam HTTP e WebSocket e descartam payloads.

Definir antes do código orçamento explícito de réplicas/buffers e estratégias de atualização; excesso não pode travar a tela nem exibir uma soma parcial como completa. Limites de frame/payload continuam aplicados. Nenhuma reconexão automática após1008. CSV inclui réplica, timestamp e unidades, evita fórmulas e não exporta tokens/descritores. Conteúdo sensível do handshake só em RAM.

## Tasks e aceite

1. Conferir schema/link/shape real da resposta e amostras sanitizadas próprias; fechar política de associação/limites antes de alterar parser.
2. Modelo de séries por identidade com testes de mistura, duplicatas, out-of-order, resets, desaparecimento, cobertura e limites; contratos de flags e escopo.
3. Reusar drawer/gráficos/toolbar e ação contextual em todas as superfícies de serviço existentes, mantendo shell/tema/foco.
4. Testes de componente: flag off/ausente, serviço sem link, erro parcial, pausa/reconexão, fechamento e troca de ambiente/identidade, cleanup e CSV. Linux unitários+TypeScript/Vite.
5. Teste físico de serviço próprio3 réplicas pelo proxy18090 sem substituir descriptors/rotas no navegador: menu real abre painel, identifica cada réplica com amostras ao vivo, troca seleção, logs/terminal continuam contextuais, temas/layout/teclado, retirada de grant fecha conexões e cleanup completo. Teste de fonte estrangeira no parser não substitui RBAC real.
6. Registrar resultado e limites; habilitar moderno somente após gates. OPS13 também exige demais tipos/gráficos do inventário03/09 e não se encerra pelo recorte inicial.

## Implementação e gate local — 05/11/2026

Implementado o recorte de serviços Docker nativos: ação contextual nas stacks e nos detalhes abre o drawer comum; uma conexão de serviço alimenta séries independentes por réplica. Associação exige environment e serviço atuais, links de mesma origem e instâncias autorizadas. Snapshot limitado a64 targets; frames limitados a1MiB/32 linhas e cada série a300 amostras/5min. Não há soma de réplicas apresentada como taxa agregada. Mudança de associação detectada na revalidação de15s encerra a conexão e pede reconexão explícita.

Seletor usa Field e tokens compartilhados; troca de réplica preserva o socket. CSV inclui somente a réplica selecionada com containerId e unidades. Fechamento/contexto/revogação abortam requisições e conexão;1008 não reconecta automaticamente. Flag aditiva continua off quando ausente e depende dos módulos previstos. Não alterado frontend original.

Build Linux passou639 testes/73 arquivos, TypeScript e Vite. Inclui testes de mistura/escopo/limites de séries, dependências de configuração, menu contextual e lifecycle do painel. Teste físico do menu com três réplicas, CSV, temas, mobile e retirada real de grant ainda pendente. Flag pública permanece ausente/off até esse gate; teste pode ativá-la somente no próprio contexto do navegador, sem substituir descriptors, dados ou endpoints. OPS13 permanece aberto.
