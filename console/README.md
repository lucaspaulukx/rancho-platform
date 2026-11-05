# Rancher Community Console

Frontend independente React/TypeScript sobre APIs e sessão do Rancher 1.6.30, em `http://localhost:18090/console/`. Rancher clássico preservado na porta 18080; Keycloak na 18081. Não depende de Ember nem substitui seus assets.

Último gate: **595 testes/70 arquivos + TypeScript/Vite**, em 26/10/2026. [Status](../docs/08-status.md), [roadmap mestre](../docs/48-master-roadmap.md) e [handoff](../HANDOFF-2026-10-21.md) registram os recortes e lacunas; todas as fases ainda não estão completas.

## Build e execução no laboratório existente

Na raiz rancher16-lab, validar/criar somente a rede dedicada antes do primeiro up (ver [endereços estáveis](../docs/57-stable-sandbox-addresses.md)):

```powershell
python ensure-lab-network.py
docker compose -f compose.yaml -f compose.console.yaml -f compose.legacy-host.yaml build console
docker compose -f compose.yaml -f compose.console.yaml -f compose.legacy-host.yaml up -d --no-deps console
```

Dockerfile executa npm ci → Vitest → TypeScript/Vite. Recria somente console. Preservar overlays/callback 18090; não reinicializar o backend por padrão, não iniciar baseline sobre o mesmo MySQL, não remover volumes/órfãos. A VM do host original e as VMs adicionais de teste têm estados próprios; não iniciar/parar projetos externos. Credenciais permanecem privadas em `.env` e nos serviços; não copiar para evidências.

## Configuração e experiência comum

`public/console-config.json` é público e montado read-only, com `schemaVersion: 1`. Arquivos legados sem versão são normalizados em memória; módulos ausentes ficam desligados. Validar/migrar sem sobrescrever origem: `npm run config:migrate -- --check origem.json` ou `--write origem.json destino-novo.json`; [procedimento e rollback](../docs/53-versioned-console-configuration.md). `enabled` controla a console; `modules` controla cada funcionalidade; `branding`, `themeDefault`, `themeSelectable` e `customTheme` controlam aparência. Arquivo não concede permissões nem contém segredos. Recarga aplica mudanças, sem promessa de hot reload/revogação de credencial. [Contrato e defaults efetivos](../docs/05-configuration-themes.md).

AppShell/Sidebar/Navbar/EnvironmentSwitcher são comuns às rotas autenticadas; AuthLayout compartilha marca/tema. `components/Brand.tsx` reutiliza os símbolo e wordmark originais Rancher no shell/login/Sobre. Modal/DataTable/CheckboxField/menus/contexto, seletores e editores de bindings são compartilhados. Visual usa a paleta Rancher moderna e fonte Inter e preset claro, com tokens e contraste.

Operação vertical de environment/stack/serviço/container mantém menus `…`, logs/exec/métricas, escala/upgrade e contexto. Compose de criação, vínculos, LB HTTP/TCP, portas/volumes na criação e no upgrade de serviço estão habilitados nos recortes dos documentos 12–23/29. O upgrade preserva imagem quando só bindings mudam, com revisão/rollback/finish; não há prova de toda montagem/tráfego físicos.

Módulos especializados habilitados: apiKeys (24), audit (25), about (26), processes/processReplay (27), settings (28), webhooks (30). HA/membros e pools do engine (31) também estão habilitados, com atualização pausável e consulta sem mutação. Cada um tem flag própria. Webhooks criam/clonam/excluem receivers e mostram URL protegida; aceites não invocam eventos. As flags genéricas admin/api/optional continuam false; não habilitam HA/drivers/orquestradores por inferência.

OIDC exclusivo/autologin e políticas pertencem ao backend/Compose; o JSON da console não altera esse controle. Administrador Keycloak master e administrador Rancher não são intercambiáveis; provisionar/testar identidade de aplicação antes de modo exclusivo. Usuário novo continua sem acesso/environment pessoal por padrão.

## Validação

`src/test` contém domínio/componentes. O harness `tests/e2e/run.py` usa Playwright/Chromium headless próprios, com contexto isolado, sem perfil/cookies/abas do usuário e credenciais via stdin. Exemplos sem escritas de negócio:

```powershell
python -u console/tests/e2e/run.py smoke
python -u console/tests/e2e/run.py accessibility
python -u console/tests/e2e/run.py about
python -u console/tests/e2e/run.py form-themes
python -u console/tests/e2e/run.py audit
```

Executar da raiz do laboratório. Suítes api-keys/context-editors/processes/settings/config-upgrade/webhooks exigem fixture exclusiva preparada pelo helper correspondente; consultar o documento do módulo. Não reutilizar IDs de relatórios antigos nem executar scripts históricos automaticamente. Cleanup valida nome/marker/escopo e preserva recursos anteriores; não há prune/reset global.

Relatórios `*-e2e-results.json`, `*-a11y-results.json` e `*-cleanup-results.json` descrevem testes reais e seus limites. Screenshots de credenciais reais são mascaradas, sem HAR/trace/storageState. Não somar contagens de relatórios históricos como cobertura atual. O soak de uma hora do build 133 não pertence ao build atual.

## Pendências

Configuração/migração HA, catálogo de drivers/provisionamento e sincronização física/fontes por environment de catálogo, formulários avançados e demais opções Compose, testes físicos LB/TLS/storage/webhooks, matriz de expiração/logout federado e consolidação F10. Opcionais F9 dependem de orquestradores utilizados e laboratório correspondente. Não há deploy externo, push/merge/release ou alteração do frontend Ember nesta entrega.

Drivers e repositórios globais: docs32–33, flags machineDrivers/driverActivation/catalogRepositories. Aceites autônomos `python -u console/tests/e2e/run.py machine-drivers` e `catalog-repositories` fazem escritas locais e restauram fixtures; executar serialmente, com laboratório exclusivo. O segundo exige catalog.url originalmente sem override DB. Nunca confundir persistência de fontes com clone concluído.

Compose de stacks existentes com origem persistida: doc34, flag stackComposeUpgrades. Helper de aceite exclusivo: stack_compose_upgrade_fixture.py seed → e2e/run.py stack-compose-upgrade → cleanup; criação inativa e scale0 pela API evitam o padrão nativo de escala1. Após reiniciar Docker: prepare_legacy_host.py e repair_legacy_connection.py verificam/reconectam somente o host legado existente, sem exibir registro.

Fontes por environment: doc36, environmentCatalogs=true. Editor contextual no Catálogo exclusivo de administrador; E2E environment-catalogs usa fonte aleatória loopback em CONSOLE-POLICY-LAB e restaura fontes anteriores. Proteção nativa independente RANCHER_CATALOG_WRITE_GUARD_ENABLED=true. Delegação de UI e clone físico têm gates separados. Estimativa/pendências completas no doc35, cerca de70% Docker/Cattle.

Atualização de abas abertas: doc37. CONSOLE_ASSET_RETENTION=true mantém assets antigos em console-assets, sem reter imagens Docker. false serve só o build atual e preserva volume. Acompanhar crescimento e definir janela antes de limpeza. Teste: python -u console/tests/e2e/run.py update-recovery; a prova de cliente anterior exige update-prior-assets.json do build preservado.

Healthchecks: docs38–39. Criação: healthcheck_fixture.py seed → e2e/run.py healthchecks → healthcheck_fixture.py verify → cleanup. Upgrade: config_upgrade_fixture.py seed → e2e/run.py healthcheck-upgrade → config_upgrade_fixture.py cleanup. Usar fixture exclusiva, sem simultaneidade com config-upgrade. Nenhuma prova de saúde física/quórum multihost é inferida de escala0.

Sidecars (40): sidecar_fixture.py seed → e2e/run.py sidecars → sidecar_fixture.py verify → cleanup. Exclusividade no UI-OPS-LAB durante baseline/cleanup; não rodar junto com outras suítes que criam workloads. Teste não agenda containers e não prova compartilhamento físico de rede/volumes.

Upgrade de sidecars (41): sidecar_upgrade_fixture.py seed → e2e/run.py sidecar-upgrade → sidecar_upgrade_fixture.py cleanup. Fixture ativa escala0, sidecar auxiliar prévio; nunca executar junto a outro aceite de workloads. Comparação de configurações/volumes anteriores no cleanup.

Administração de contas locais (42): flag localAccountAdministration, criação/perfil/senha/lifecycle na própria tela Usuários. SESSION_ACCOUNT_GUARD_ENABLED é proteção backend independente; senha nova não revoga JWT. Aceites: python -u console/tests/e2e/run.py local-accounts (fixture/cleanup próprios), python -u console/tests/session_account_regression.py (consulta/auth sem escritas de negócio). Nunca executar cleanup sem manifesto exclusivo.
