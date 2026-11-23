# 38 — Verificações de saúde na criação de workloads

## Plano antes do código

Contrato runtime confirmado em23/10: container.healthCheck e launchConfig.healthCheck são instanceHealthCheck, create=true/update=false/nullable=true. Não usar PUT para alterar uma configuração imutável. Schema exige port1–65535 e permite interval/responseTimeout/initializingTimeout/reinitializingTimeout/healthyThreshold/unhealthyThreshold; estratégia none/recreate/recreateOnQuorum. A UI legada usa milissegundos e requestLine HAProxy com path/version entre aspas e Host separado por sequências literais backslash-r/backslash-n; não assumir formato HTTP simples.

Primeiro recorte: seção Saúde nos formulários de criação de serviço/container existentes, editor reutilizável TCP/HTTP/desativado, porta, método/path/HTTP version/Host, limites e estratégia/quórum. Flag workloadHealthChecks; off mantém editor genérico nativo. Somente campos criáveis do schema corrente. Defaults explícitos compatíveis com UI legada; validação sem injeção de linhas/header, números inteiros e intervalo/timeout positivos, thresholds/quórum positivos. Grace periods permitem zero. Campos/payload revalidados com schema fresco no envio. Sem nova página, sem edição do Ember.

Teste de domínio/componentes, build, UI nos temas efetivos claro/escuro ×desktop/móvel. Fixtures de serviço em escala0 e startOnCreate=false comprovam persistência e isolamento sem executar workloads; cleanup somente por marker/escopo e hashes dos recursos anteriores. Aceite de saúde física/recriação/quórum requer containers e múltiplos hosts; não inferir sucesso operacional da persistência. Upgrade contextual de healthcheck fica em recorte posterior e precisa preservar campos atuais/sidecars, snapshot e rollback reais.

## Resultado

Criação implementada: flag workloadHealthChecks=true, seção Saúde compartilhada na criação de serviço/container, TCP/HTTP/desativado, tempos, limites e estratégia/quórum. Formato requestLine compatível com UI1.6, campos HTTP não vão ao payload como propriedades inventadas. Flag off mantém formulário genérico. Schema fresco revalidado mesmo com layout por seções desligado.

Build512 testes/59 arquivos + TypeScript/Vite; sete testes novos de domínio/componentes. 13 checks browser reais: oito cenários de serviço/container ×claro/escuro ×1440/390, com data-theme correto e zero violações axe/overflow; persistência de TCP, HTTP1.1/Host/quórum e desativado, escala0/inativo/sem instâncias; flag off e zero pageerrors. Negação403 de criação com healthcheck para identidade sem environment. Primeira expectativa do harness exigia requestLine vazio para TCP, mas servidor omite o campo; corrigida para ausência/vazio. Fixture da tentativa removida antes da repetição.

Três serviços da repetição removidos, configurações anteriores/volumes/containers preservados, manifest próprio ausente. Relatórios healthcheck-e2e-results.json, healthcheck-a11y-results.json, healthcheck-native-results.json e healthcheck-cleanup-results.json. Formulário de bindings nos quatro temas/tamanhos e recuperação de atualização26 checks repetidos após este build. Não há aceite de health física, recriação ou quórum multihost.
