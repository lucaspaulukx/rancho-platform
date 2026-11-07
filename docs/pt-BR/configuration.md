# Configuração e flags

<!-- rancho-language-navigation:start -->
[Português (Brasil)](configuration.md) | [English](../en/configuration.md)
<!-- rancho-language-navigation:end -->


## Configuração do frontend

A distribuição lê `console/public/console-config.json`; `console/src/config.ts` define o contrato validado. Parta de uma configuração completa existente, não de um exemplo parcial sobreposto ao arquivo. Chaves desconhecidas, booleanos inválidos e overrides de tema inválidos são rejeitados.

`schemaVersion: 1` versiona a configuração. Entrada legada é convertida em memória sem reescrever a origem. Módulos existentes da versão1 são explícitos; flags aditivas `metricsPayloadTransport`, `serviceMetrics`, `workloadUlimitEditors`, `workloadUlimitUpgrades` e `workloadDeviceEditors` ficam false quando ausentes. Flags novas precisam preservar essa compatibilidade.

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

## Dispositivos na criação e no upgrade de serviços

`modules.workloadDeviceEditors` habilita um editor comum de dispositivos na criação de container avulso, launch config principal do serviço e sidecars. O default off mantém o formulário nativo genérico de lista de strings. O schema atual do escopo ainda precisa oferecer `devices: array[string]` com create habilitado. O contrato é relido antes do POST.

`modules.workloadDeviceUpgrades` é uma flag independente e fica desligada quando ausente. Com `modules.workloadUpgrades` habilitada, ela oferece seleção explícita e confirmação para dispositivos na configuração principal de um serviço nativo. Uma lista vazia remove os mapeamentos explícitos. O console relê o serviço e os schemas de upgrade e verifica alterações na configuração principal e nos sidecars antes do envio. O Rancher aplica as mudanças recriando containers, com as ações nativas de reversão e conclusão. PUT de container avulso e edição estruturada de dispositivos de sidecars durante upgrade ficam fora do escopo deste editor.

Cada novo mapeamento informa caminho absoluto no host, caminho absoluto no container e permissões r/w/m distintas. O editor local permite até32 mapeamentos, recusa linhas incompletas/caracteres de controle/destinos duplicados e preserva strings aceitas exatamente até edição explícita. Strings legadas opacas continuam visíveis no rascunho e não são reescritas silenciosamente; enviar formatos incompatíveis exige retornar ao formulário nativo com o editor desligado. O frontend não comprova que um caminho existe ou é dispositivo permitido no host; autorização nativa e Docker continuam decidindo.

Permissões pedidas pelo mapeamento não substituem a lista padrão de dispositivos do runtime. No Docker19.03.15, os [defaults do Moby](https://github.com/moby/moby/blob/v19.03.15/oci/defaults.go) incluem /dev/null rwm, e a [configuração de dispositivos](https://github.com/moby/moby/blob/v19.03.15/daemon/oci_linux.go) adiciona as regras solicitadas. Um mapeamento de /dev/null com r pode persistir corretamente enquanto abrir para escrita continua permitido. Não afirme negação efetiva com base somente em HostConfig ou UI. Teste o processo real no runtime desejado antes de depender de uma restrição.

## Política de idiomas da interface

O objeto raiz opcional `localization` é aditivo na schemaVersion1. Ausente, preserva pt-BR e esconde o seletor; normalizar nunca reescreve a origem. Desativá-lo restaura pt-BR sem apagar preferências salvas. Esta é política de apresentação, não grant de environment ou ajuste OIDC, e não altera o idioma do IdP externo.

| Campo | Default e comportamento |
|---|---|
| `localization.enabled` | `false`; off fixa a interface em pt-BR |
| `localization.defaultLocale` | `pt-BR`; locale canônico do inventário do roadmap, obrigatório na lista disponível |
| `localization.availableLocales` | `["pt-BR"]`; lista não vazia, sem duplicatas, limitada aos dez locales conhecidos |
| `localization.selectable` | `false`; política bloqueada impõe o padrão administrativo e ignora escolhas salvas/do navegador |
| `localization.detectBrowser` | `false`; quando selecionável, negocia idiomas permitidos do navegador após preferências salvas |
| `localization.preview` | `false`; atualmente obrigatório para configurar locale não pt-BR, pois extração/revisão completas seguem pendentes |

Para prévia inglesa isolada, acrescente um objeto `localization` à configuração completa existente com `enabled`, `selectable` e `preview` true, `defaultLocale` pt-BR e `availableLocales` contendo pt-BR/en-US. Valide antes do deploy. Campos desconhecidos, switches não booleanos, locales não canônicos, duplicatas e padrão fora da lista são recusados. O aviso de prévia permanece visível mesmo com idioma bloqueado; o seletor exige ao menos dois locales selecionáveis. Prévia não representa tradução concluída nem aceite de release. As prévias dos oito idiomas adicionais cobrem autenticação, controles compartilhados, navegação, seleção de environments, menus da conta e mensagens de recuperação da interface. Mensagens registradas sem tradução usam o inglês, e páginas não extraídas mantêm o texto original. Para testar, adicione o código desejado (de-DE, fr-FR, hu-HU, ja-JP, fa-IR, ru-RU, uk-UA ou zh-Hans) à lista explícita de idiomas disponíveis.

Preferências contêm apenas versão e locale, na chave de navegador `rancho.console.locale.*` por conta. A escolha salva da conta precede a escolha anônima do login, depois idiomas permitidos do navegador e o padrão configurado. Escolher antes do login pode fornecer o idioma inicial de uma conta sem preferência própria. Falha no armazenamento mantém a escolha utilizável em memória; reconfiguração não relacionada preserva uma escolha explícita ainda permitida. Trocas de identidade, bloqueio/remoção/off da política e mudanças entre abas reaplicam a política. Credenciais, rascunhos de workload e dados API não entram nessa preferência. Trocar locale atualiza contexto e lang/direção do documento sem remontar o shell nem mudar environment/rota.

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
