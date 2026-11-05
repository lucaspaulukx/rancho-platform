# Rancho Platform

Roadmap completo e ordem de execução vigente: [Roadmap mestre](48-master-roadmap.md). Estado por entrega, gates restantes e critérios para100%; checkpoints abaixo preservam o histórico.

Planejamento iniciado em 20/10/2026; documentação consolidada para handoff em 21/10/2026.

**Leia primeiro:** [status atual](08-status.md) e [handoff vigente](../HANDOFF-2026-10-21.md). Último build frontend:647 testes/74 arquivos + TypeScript/Vite; recuperação76:36 testes Python e15 checks reais em cópias isoladas. Compose, checkboxes, vínculos e criação por seções foram entregues em recortes validados; os editores de balanceadores e bindings estão habilitados após aceite isolado; a migração completa permanece pendente.

## Objetivo

Modernizar o Rancher Docker 1.6.30 com identidade Rancher modernizada, preservando sua marca, as regras de autorização do backend e a continuidade operacional. Acrescentar grupos locais, acesso centralizado aos environments e autenticação Keycloak/OIDC. Entregar por fases, com ativação e desativação explícitas, temas configuráveis e componentes compartilhados.

**Regra de execução:** documentar antes de migrar. Cada fase passa por seus critérios de aceite e rollback antes da seguinte. Uma tela desenhada ou compilada não é uma funcionalidade validada.

## Leitura

1. [Análise do estado atual e decisão de arquitetura](01-analysis.md)
2. [Arquitetura, layouts e regras comuns de frontend](02-architecture.md)
3. [Catálogo de telas, funções e modais](03-screens.md)
4. [Tasks, fases e dependências](04-roadmap.md)
5. [Flags, configuração, branding e temas](05-configuration-themes.md)
6. [APIs, autenticação e autorização](06-api-security.md)
7. [Testes, aceite e rollback](07-validation-rollout.md)
8. [Situação real do trabalho](08-status.md)
9. [Inventário extraído dos fontes legados](09-source-inventory.md)
10. [Identidade visual e dimensões](10-visual-identity.md)
11. [Aceite isolado das políticas de rede](11-network-policy-acceptance.md)
12. [Operação unificada, menus contextuais e upgrade](12-unified-operation-ux.md)
13. [Upgrade contextual de catálogo](13-catalog-stack-upgrade.md)
14. [Escala efetiva de serviços](14-contextual-service-scaling.md)
15. [Criação contextual por Compose](15-stack-compose-creation.md)
16. [Checkboxes compartilhadas](16-shared-checkboxes.md)
17. [Vínculos contextuais de serviços](17-contextual-service-links.md)
18. [Criação de workloads por seções](18-workload-creation-sections.md)
19. [Regras contextuais de balanceadores](19-contextual-balancer-rules.md)
20. [Proteção adicional de rascunhos e envios](20-unsaved-changes-protection.md)
21. [Editores de portas e volumes](21-workload-binding-editors.md)
22. [Harness isolado de navegador](22-isolated-browser-acceptance.md)
23. [Matriz de acessibilidade](23-accessibility-matrix.md)
24. [Chaves de API](24-api-keys.md)
25. [Auditoria administrativa](25-administrative-audit.md)
26. [Sobre e capacidades](26-about-capabilities.md)
27. [Processos administrativos](27-administrative-processes.md)
28. [Configurações do servidor](28-server-settings.md)
29. [Upgrade contextual de configuração](29-service-configuration-upgrade.md)
30. [Webhooks nativos](30-native-webhooks.md)
31. [HA e pools do engine](31-ha-engine-monitoring.md)
32. [Drivers de máquinas](32-machine-drivers.md)
33. [Repositórios globais de catálogo](33-catalog-repositories.md)
34. [Compose de stack existente](34-existing-stack-compose.md)
35. [Percentual estimado e trabalho restante](35-progress-and-remaining-work.md)
36. [Catálogos por environment e proteção de escrita nativa](36-environment-catalogs.md)
37. [Compatibilidade de abas e recuperação de atualização](37-console-update-recovery.md)
38. [Verificações de saúde na criação](38-workload-healthchecks.md)
39. [Upgrade contextual de saúde](39-healthcheck-service-upgrades.md)
40. [Sidecars na criação de serviços](40-service-sidecars.md)
41. [Upgrade contextual de sidecars](41-sidecar-service-upgrades.md)
42. [Administração de contas locais e sessão](42-local-account-administration.md)
43. [Agendamento estruturado na criação](43-workload-scheduling.md)
44. [Upgrade contextual de afinidades](44-scheduling-service-upgrades.md)
45. [Delegação de fontes por environment](45-delegated-environment-catalogs.md)
46. [Memória em unidades legíveis](46-memory-resource-editor.md)
47. [Capabilities e aceite físico de recursos](47-workload-capabilities.md)
48. [Roadmap mestre completo](48-master-roadmap.md)
49. [Upgrade de memória e reserva](49-resource-service-upgrades.md)
50. [Upgrade contextual de segurança](50-security-service-upgrades.md)
51. [Recuperação da infraestrutura local](51-sandbox-infrastructure-recovery.md)
52. [Plano de healthcheck físico](52-physical-healthcheck-acceptance.md)

Checkpoints anteriores estão em `history/` e não prevalecem sobre o status atual.

## Diretrizes já definidas pelo usuário

- Grupos e seus membros são administrados no Rancher; o Keycloak autentica.
- Usuário novo não recebe acesso nem environment automaticamente. Recebe uma tela explicativa.
- OIDC pode ser exclusivo; login automático pode ser ligado separadamente.
- Visual usa marca Rancher, azul e tons neutros em tokens compartilhados.
- Telas modernas precisam ser amigáveis; reproduzir os formulários antigos com outra cor não basta.
- Tudo novo precisa ter controle de ativação/desativação e comportamento de reversão definido.
- Temas devem ser configuráveis.
- Sidebar, navbar e componentes são reutilizados em todas as telas aplicáveis. Telas autenticadas não podem construir um layout próprio.
- Regras de frontend devem ser coerentes e verificadas em toda a aplicação.

## Escopo e limites

O laboratório é local. Nenhum ambiente corporativo foi alterado. A documentação cobre a migração funcional do frontend, incluindo fundação, autenticação, acesso e os fluxos operacionais já entregues em recortes: workloads, logs/terminal, lifecycle, upgrade de imagem/catálogo e escala. Os aceites específicos não fecham a paridade completa por consumir a mesma API.

O novo frontend está em desenvolvimento em `console/`, servido por um container independente em `http://localhost:18090/console/`. O Rancher clássico permanece disponível na porta 18080. O status de cada entrega e suas limitações estão no documento 08; as fases operacionais ainda não estão concluídas.

Administração/integrações habilitadas em recortes validados: apiKeys, audit, about, processes, processReplay, settings e webhooks; upgrade de portas/volumes contextual também ativo. Configuração HA e provas operacionais avançadas seguem pendentes. Status08 é a referência atual.

Monitoramento HA e pools habilitados (31), sem migração/tuning/failover físico. Drivers e repositórios globais habilitados nos recortes32–33; clone/provisionamento/refresh remoto seguem gates próprios.

Compose de stacks Cattle com fonte persistida habilitado no recorte34; parâmetros privados/exportação nativa/rollback/finish, sem considerar todas as opções Compose ou execução física como concluídas.

- [Configuração versionada, migração e rollback do JSON](53-versioned-console-configuration.md)

- [Expiração real local e OIDC](54-real-session-expiration.md)
- [Validação combinada de dependências de sidecars](55-sidecar-dependency-validation.md)
- [Execução física de sidecars](56-physical-sidecar-acceptance.md)

- [Endereços estáveis e bootstrap seguro da rede do laboratório](57-stable-sandbox-addresses.md)

- [Upgrades físicos de memória e segurança](58-physical-configuration-upgrades.md)

- [Configuração privada do segredo OIDC local](59-local-oidc-secret-configuration.md)

- [Administrador OIDC e recuperação do modo exclusivo](60-oidc-administrator-recovery.md)

- [Disponibilidade do provedor no login](61-oidc-provider-availability.md)
- [Plano de logout federado opcional — ainda pendente](62-federated-logout-plan.md)

- [Upgrades físicos de sidecars — aceito em recorte](63-physical-sidecar-upgrades.md)

- [CPU e I/O no formulario compartilhado](64-cpu-io-creation.md)

- [Regressao de21 rotas em desktop e movel](65-readonly-route-regression.md)

- [CPU e I/O no upgrade contextual — recorte aceito](66-cpu-service-upgrades.md)

- [Afinidade fisica por label de host — recorte aceito](67-physical-host-affinity.md)

- [Rascunhos invalidos de memoria e CPU](68-invalid-resource-drafts.md)

- [Observacao independente de heartbeat WebSocket](69-websocket-heartbeat-observation.md)

- [Reset fisico de CPU e I/O](70-physical-cpu-reset.md)

- [Distribuição comunitária e migração assistida](71-community-release-plan.md).

- [Guia e ferramenta de migração](72-migration-guide.md).
- [Revogação de streams](73-open-stream-revocation.md).
- [Histórico Git e base comunitária](74-git-and-community-validation.md).

- [Bootstrap seguro e limites de validação](75-bootstrap-safety.md).

- [Backup frio completo e ensaio de recuperação](76-complete-recovery-plan.md).

- [Schema runtime e upgrade/rollback original20](77-runtime-schema-migration.md).

- [Plano de migração de acessos diretos para grupos](78-direct-grants-to-groups.md).

- [Guarda de sessões dos streams de host](79-host-stream-session-guard.md).

- [Inventário de dependências e licenças por artefato](80-artifact-dependency-inventory.md).

- [Negociação de métricas grandes e conexões ociosas](81-metrics-payload-transport.md).

- [Proteção de credenciais na auditoria](82-audit-credential-redaction.md).

- [Revogação de streams de chaves de API](83-api-key-stream-guard.md).

- [Plano de métricas contextuais de serviços](84-contextual-service-metrics.md).
- [Diagnóstico do heartbeat do scheduler](85-scheduler-heartbeat-diagnosis.md).

- [Fluxo Git do Rancho Platform](86-repository-workflow.md).
- [Limites de processo na criação contextual](87-workload-ulimits.md).
