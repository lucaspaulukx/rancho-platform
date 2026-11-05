# 09 — Inventário rastreável do frontend legado

## Checkpoint documental — 21/10/2026

O inventário legado permanece referência em leitura. Para a próxima entrega Compose, foram conferidos ui/app/stacks/new/route.js e controller.js e o schema nativo stack: dockerCompose/rancherCompose/environment/startOnCreate são criáveis e não atualizáveis. Não extrapolar esses campos de criação para edição de stack existente.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


Extraído do checkout `ui` v1.6.52 (`60188e28ea545833dd2cea8ce104a77c2dbafd59`). O inventário registra declarações do fonte; não afirma que todas as integrações estão ativas no laboratório.

## Rotas

Fonte: `ui/app/router.js`. Foram encontradas 130 declarações `this.route`. Paths são locais à declaração: hierarquia e `resetNamespace` precisam ser considerados antes de definir URLs finais. Nomes repetidos representam contextos diferentes. Rotas das extensões locais estão em `ui/local-rbac/native-routes.js` e são adicionais.

| Linha | Nome declarado | Path declarado | resetNamespace |
|---|---|---|---|
| 10 | `ie` | `(default Ember)` |  |
| 11 | `index` | `(default Ember)` |  |
| 12 | `failWhale` | `/fail` |  |
| 13 | `not-found` | `*path` |  |
| 15 | `login` | `(default Ember)` |  |
| 16 | `index` | `/` |  |
| 17 | `shibboleth-auth` | `(default Ember)` |  |
| 19 | `logout` | `(default Ember)` |  |
| 20 | `authenticated` | `/` |  |
| 22 | `dummy-dev` | `/dev` |  |
| 24 | `settings` | `(default Ember)` | sim |
| 25 | `projects` | `/env` |  |
| 26 | `index` | `/` |  |
| 27 | `new` | `/add` |  |
| 28 | `new-template` | `/add-template` |  |
| 29 | `edit-template` | `/template/:template_id` |  |
| 30 | `detail` | `/:project_id` |  |
| 35 | `admin-tab` | `/admin` | sim |
| 36 | `auth` | `/access` |  |
| 37 | `activedirectory` | `(default Ember)` |  |
| 38 | `azuread` | `(default Ember)` |  |
| 39 | `github` | `(default Ember)` |  |
| 40 | `openldap` | `(default Ember)` |  |
| 41 | `localauth` | `local` |  |
| 42 | `shibboleth` | `(default Ember)` |  |
| 45 | `settings` | `(default Ember)` |  |
| 46 | `ha` | `(default Ember)` |  |
| 48 | `accounts` | `/accounts` |  |
| 49 | `index` | `/` |  |
| 50 | `new` | `/add` |  |
| 53 | `processes` | `/processes` |  |
| 54 | `index` | `/` |  |
| 55 | `pools` | `/pools` |  |
| 56 | `list` | `/list` |  |
| 58 | `process` | `/processes/:process_id` |  |
| 60 | `audit-logs` | `(default Ember)` |  |
| 61 | `machine` | `(default Ember)` |  |
| 64 | `project` | `/env/:project_id` |  |
| 65 | `index` | `/` |  |
| 66 | `waiting` | `(default Ember)` |  |
| 69 | `infrastructure-tab` | `/infra` | sim |
| 71 | `console` | `/console` | sim |
| 73 | `container-log` | `/container-log` | sim |
| 75 | `console-vm` | `/console-vm` | sim |
| 77 | `vm-log` | `/vm-log` | sim |
| 79 | `hosts` | `/hosts` | sim |
| 80 | `index` | `/` |  |
| 81 | `new` | `/add` |  |
| 82 | `index` | `/` |  |
| 85 | `host` | `/:host_id` | sim |
| 86 | `containers` | `(default Ember)` |  |
| 87 | `ports` | `(default Ember)` |  |
| 88 | `storage` | `/storage` |  |
| 89 | `labels` | `(default Ember)` |  |
| 93 | `containers` | `(default Ember)` | sim |
| 94 | `new` | `/add` |  |
| 95 | `index` | `/` |  |
| 97 | `container` | `/:container_id` | sim |
| 98 | `ports` | `(default Ember)` |  |
| 99 | `volumes` | `(default Ember)` |  |
| 100 | `labels` | `(default Ember)` |  |
| 101 | `commands` | `(default Ember)` |  |
| 102 | `networking` | `(default Ember)` |  |
| 103 | `healthcheck` | `(default Ember)` |  |
| 104 | `scheduling` | `(default Ember)` |  |
| 105 | `security` | `(default Ember)` |  |
| 109 | `virtualmachines` | `/vms` | sim |
| 110 | `new` | `/add` |  |
| 111 | `index` | `/` |  |
| 113 | `virtualmachine` | `/:virtualmachine_id` | sim |
| 114 | `labels` | `(default Ember)` |  |
| 118 | `certificates` | `(default Ember)` | sim |
| 119 | `new` | `/add` |  |
| 120 | `index` | `/` |  |
| 121 | `detail` | `/:certificate_id` |  |
| 124 | `backuptargets` | `(default Ember)` | sim |
| 125 | `index` | `/` |  |
| 127 | `backuptargets.new-target` | `/add-target` | sim |
| 129 | `storagepools` | `(default Ember)` | sim |
| 130 | `index` | `/` |  |
| 131 | `pools` | `/pools` |  |
| 132 | `detail` | `/:storagepool_id` |  |
| 134 | `storagepools.new-volume` | `/add-volume` | sim |
| 136 | `registries` | `/registries` | sim |
| 137 | `new` | `/add` |  |
| 138 | `index` | `/` |  |
| 141 | `secrets` | `/secrets` | sim |
| 142 | `new` | `/add` |  |
| 143 | `index` | `/` |  |
| 144 | `detail` | `/:certificate_id` |  |
| 149 | `applications-tab` | `/apps` | sim |
| 150 | `index` | `/` |  |
| 151 | `service.new` | `/add-service` | sim |
| 152 | `service.new-virtualmachine` | `/add-vm-service` | sim |
| 153 | `service.new-balancer` | `/add-balancer` | sim |
| 154 | `service.new-alias` | `/add-alias` | sim |
| 155 | `service.new-external` | `/add-external` | sim |
| 157 | `stacks` | `/stacks` | sim |
| 158 | `index` | `/` |  |
| 159 | `new` | `/add` |  |
| 161 | `stack` | `/:stack_id` | sim |
| 162 | `index` | `/` |  |
| 163 | `code` | `/code` |  |
| 164 | `graph` | `/graph` |  |
| 165 | `chart` | `/chart` |  |
| 167 | `service` | `/services/:service_id` | sim |
| 168 | `containers` | `(default Ember)` |  |
| 169 | `labels` | `(default Ember)` |  |
| 170 | `ports` | `(default Ember)` |  |
| 171 | `links` | `(default Ember)` |  |
| 172 | `log` | `(default Ember)` |  |
| 173 | `port-rules` | `(default Ember)` |  |
| 174 | `certificates` | `(default Ember)` |  |
| 180 | `swarm-tab` | `/swarm` | sim |
| 181 | `console` | `(default Ember)` |  |
| 182 | `dashboard` | `(default Ember)` |  |
| 186 | `mesos-tab` | `/mesos` | sim |
| 190 | `catalog-tab` | `/catalog` | sim |
| 191 | `index` | `/` |  |
| 192 | `launch` | `/:template` |  |
| 196 | `k8s-tab` | `/kubernetes` | sim |
| 197 | `index` | `/` |  |
| 198 | `kubectl` | `/kubectl` |  |
| 199 | `dashboard` | `/dashboard` |  |
| 203 | `help` | `(default Ember)` |  |
| 205 | `api` | `/api` |  |
| 206 | `keys` | `/keys` |  |
| 207 | `hooks` | `/hooks` |  |
| 208 | `new-receiver` | `/add-receiver` |  |
| 209 | `edit-receiver` | `/receiver/:receiver_id` |  |

## Modais e confirmações

Arquivos sob diretórios `modal-*` e `confirm-*` (36 arquivos). Formulários `new-*`/`edit-*` e popups de console também precisam da revisão funcional da fase do domínio; esta listagem não os classifica automaticamente como modal.

- `ui/app/components/confirm-delete/component.js`
- `ui/app/components/confirm-delete/template.hbs`
- `ui/app/components/modal-about/component.js`
- `ui/app/components/modal-about/template.hbs`
- `ui/app/components/modal-auditlog-info/component.js`
- `ui/app/components/modal-auditlog-info/template.hbs`
- `ui/app/components/modal-confirm-deactivate/component.js`
- `ui/app/components/modal-confirm-deactivate/template.hbs`
- `ui/app/components/modal-console/component.js`
- `ui/app/components/modal-console/template.hbs`
- `ui/app/components/modal-container-logs/component.js`
- `ui/app/components/modal-container-logs/template.hbs`
- `ui/app/components/modal-container-stop/component.js`
- `ui/app/components/modal-container-stop/template.hbs`
- `ui/app/components/modal-edit-backup/component.js`
- `ui/app/components/modal-edit-backup/template.hbs`
- `ui/app/components/modal-edit-driver/component.js`
- `ui/app/components/modal-edit-driver/template.hbs`
- `ui/app/components/modal-edit-env-catalogs/component.js`
- `ui/app/components/modal-edit-env-catalogs/template.hbs`
- `ui/app/components/modal-edit-setting/component.js`
- `ui/app/components/modal-edit-setting/template.hbs`
- `ui/app/components/modal-edit-snapshot/component.js`
- `ui/app/components/modal-edit-snapshot/template.hbs`
- `ui/app/components/modal-feedback/component.js`
- `ui/app/components/modal-feedback/template.hbs`
- `ui/app/components/modal-host-evacuate/component.js`
- `ui/app/components/modal-host-evacuate/template.hbs`
- `ui/app/components/modal-process-error/component.js`
- `ui/app/components/modal-process-error/template.hbs`
- `ui/app/components/modal-shell/component.js`
- `ui/app/components/modal-shell/template.hbs`
- `ui/app/components/modal-wechat/component.js`
- `ui/app/components/modal-wechat/template.hbs`
- `ui/app/components/modal-welcome/component.js`
- `ui/app/components/modal-welcome/template.hbs`

## Fontes para contratos e regras

- `ui/app/models`, `ui/app/services`, `ui/app/mixins`: modelos/actions, sessão, store e fluxos compartilhados.
- `ui/app/components`: tabelas, formulários, modais, detalhes e interações operacionais existentes.
- `ui/app/authenticated`, `ui/app/login`, `ui/app/logout`: restauração de contexto, login/logout e tratamento de erro.
- `cattle/resources/content/schema`: capacidades e schemas por papel.
- `cattle/code/iaas/auth-logic`: autorização, autenticação e extensões locais.
- `tests/integration.py`: evidência sintética das extensões já testadas; não cobre a migração completa.

## Lacunas que exigem inspeção na fase de cada domínio

Payloads por driver/plugin, actions por estado do recurso, validações de formulários, console/exec/WebSocket, integrações externas e diferenças de papel devem ser capturados com dados sanitizados no ambiente de teste. O catálogo de telas no documento 03 define o destino, sem tratar esse inventário como prova de paridade funcional.
