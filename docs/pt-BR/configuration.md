# Configuração e flags

<!-- rancho-language-navigation:start -->
[Português (Brasil)](configuration.md) | [English](../en/configuration.md)
<!-- rancho-language-navigation:end -->


## Configuração do frontend

A distribuição lê `console/public/console-config.json`; `console/src/config.ts` define o contrato validado. Parta de uma configuração completa existente, não de um exemplo parcial sobreposto ao arquivo. Chaves desconhecidas, booleanos inválidos e overrides de tema inválidos são rejeitados.

`schemaVersion: 1` versiona a configuração. Entrada legada é convertida em memória sem reescrever a origem. Módulos existentes da versão1 são explícitos; flags aditivas `metricsPayloadTransport`, `serviceMetrics`, `workloadUlimitEditors` e `workloadUlimitUpgrades` ficam false quando ausentes. Flags novas precisam preservar essa compatibilidade.

Em `console/`, valide ou gere um arquivo migrado separado:

```sh
npm run config:migrate -- --check public/console-config.json
npm run config:migrate -- --write public/console-config.json console-config.next.json
```

O destino precisa ser novo. Revise o diff antes de selecioná-lo para deploy. A migração não sobrescreve o arquivo original nem autoriza alteração de banco.

| Configuração | Finalidade |
|---|---|
| `enabled`, `classicUrl` | Disponibilidade da console e fallback clássico |
| `branding` | Assinatura comunitária opcional; identidade Rancher permanece |
| `themeDefault`, `themeSelectable`, `customTheme` | Default escuro/claro/sistema, escolha do usuário e overrides validados |
| `modules.workloads`, `contextActions` | Workspace e menus contextuais de workloads |
| `modules.workload*` | Editores independentes de criação/upgrade e capacidades de lifecycle |
| `modules.observability`, `metrics`, `serviceMetrics` | Streams/métricas contextuais; métricas de serviço também exigem workloads/contextActions |
| `modules.groups`, `users`, `localAccountAdministration` | UI de gestão local de acessos |
| Outras entradas `modules` | Environments, catálogo, armazenamento, rede, administração e integrações |

Use `moduleNames` e os rótulos de Sobre como inventário exato. Cada função verifica dependências e entradas de rota/ação. Alterar módulo visual não muda permissões nativas, grants existentes ou workloads armazenados.

## Política de backend

Variáveis Compose configuram o backend; `/oidc/config` expõe capacidades solicitadas/efetivas/disponíveis. Confira a capacidade efetiva, não apenas o valor de uma variável. Switch mestre e compatibilidade do artefato/proxy podem tornar uma solicitação inefetiva.

| Variável | Contrato |
|---|---|
| `RANCHER_CUSTOMIZATION_ENABLED` | Switch mestre das extensões opcionais |
| `RANCHER_LOCAL_RBAC_ENABLED` | Acesso por grupos locais; desligar não restaura grants diretos retirados |
| `RANCHER_DISABLE_AUTO_ENVIRONMENT`, `RANCHER_ENV_CREATION_ADMIN_ONLY`, `RANCHER_NO_ACCESS_VIEW_ENABLED` | Política de novos usuários/sem-acesso e criação |
| `RANCHER_OIDC_ENABLED`, `RANCHER_OIDC_ONLY`, `RANCHER_OIDC_AUTO_LOGIN` | Entrada OIDC opcional, exclusiva e automática |
| `RANCHER_OIDC_LOGIN_PREFLIGHT_ENABLED`, `RANCHER_OIDC_FEDERATED_LOGOUT_ENABLED` | Verificação de disponibilidade e logout federado opcional |
| `RANCHER_SESSION_ACCOUNT_GUARD_ENABLED`, `RANCHER_SUBSCRIPTION_SESSION_GUARD_ENABLED` | Validação atual de conta/sessão em caminhos distintos |
| `RANCHER_HOST_STREAM_SESSION_GUARD_ENABLED` | Guarda de sessão UI nos streams de host compatíveis |
| `RANCHER_METRICS_PAYLOAD_TRANSPORT_ENABLED` | Negociação de descritores grandes com frontend/proxy compatíveis |
| `RANCHER_API_KEY_STREAM_GUARD_ENABLED` | Verificação de credencial nos streams; exige guarda de host e artefato compatível |
| `RANCHER_API_KEY_STREAM_MAX_SECONDS` | Prazo de socket/prova, 30–86400 segundos, default86400; não expiração nativa da credencial |
| `RANCHER_AUDIT_CREDENTIAL_REDACTION_ENABLED` | Redação de credenciais em gravação e projeção de auditoria histórica |
| `RANCHER_SCHEMA_MIGRATIONS_ENABLED` | Startup de schema aditivo versionado; off não desfaz DDL |

O compose base mantém streams/payload/auditoria/schema opt-in. O moderno assume redação de auditoria, guardas UI de host/subscription, transporte de métricas e preflight OIDC ligados, com overrides. Guarda de API key e migração de schema continuam off por padrão. Confira os arquivos Compose antes de mudar política; overrides do runtime local não são defaults da distribuição.

## Autenticação e rollout

Segredos OIDC ficam em configuração privada/ignorada, não em docs ou realms públicos. O template usa placeholders e callbacks exatos. Preserve credenciais/realm existentes no startup. Comprove administrador de aplicação e recuperação antes do login exclusivo. Administrar Keycloak não concede administração Rancher automaticamente; grupos continuam locais.

Marcadores de protocolo backend/proxy precisam corresponder antes de ligar guardas. Desligar uma flag pode retirar proteção ou acesso por grupo; não é rollback de dados. Auditoria antiga continua sensível, e grants diretos devem ser restaurados antes de desligar RBAC local após cutover. Veja [segurança](security-model.md), [migração de acesso](access-migration.md) e [recuperação](recovery.md).

## Schema de banco no runtime

`migration/sql/001-local-groups.sql` é a migração aditiva canônica embutida no backend. Quando habilitada, o startup usa lock nomeado MySQL, SHA256 com LF normalizado e checks estruturais de colunas, tipos, tamanhos, nullability, engines e índices. Versão futura/checksum divergente são recusados. A versão só é registrada após verificação concluída. DDL MySQL5.5 faz auto-commit; inicialização parcial interrompida deve ser repetível sem registrar sucesso prematuro. Não há drop de tabela, reassociação de identidade ou conversão automática de grants. Off preserva o bootstrap anterior; rollback exige backup correspondente, não apenas downgrade do binário.
