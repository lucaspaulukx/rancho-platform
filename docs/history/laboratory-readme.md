> **Checkpoint histórico (21/10/2026):** [handoff](HANDOFF-2026-10-21.md), [status](docs/08-status.md) e [roadmap](docs/04-roadmap.md). Fonte funcional anterior aprovada com 243 testes/29 arquivos + TypeScript/Vite; sem nova execução nessa atualização documental. Editor Compose especializado somente planejado. Desenvolvimento restrito ao novo frontend `console/`; trechos sobre extensões `ui/local-rbac` abaixo descrevem o protótipo histórico.

## Atualização operacional — 23/10/2026

Console independente aprovada com **565 testes/65 arquivos + TypeScript/Vite**. Operação contextual, criação Compose, vínculos, LB HTTP/TCP e portas/volumes estruturados na criação/upgrade estão habilitados. Também disponíveis sob flags próprias: chaves de API, auditoria, Sobre/capacidades, processos/replay, settings e CRUD de webhooks. HA/pools, gerenciamento de drivers e repositórios globais também estão habilitados em recortes testados. Administração de contas locais também habilitada (42), com revisão e validação da sessão atual. Docs24–42 e [status atual](docs/08-status.md) registram provas e limites; as fases completas ainda não estão concluídas. A UI Ember original permanece intacta. Administrador do Keycloak master e administrador Rancher são identidades distintas; modo OIDC exclusivo exige administrador de aplicação previamente provisionado/testado. Nenhuma senha foi incorporada à documentação.

> Plano de evolução e regras comuns: [documentação da migração](docs/README.md). Consulte o [status](docs/08-status.md) antes de considerar uma fase concluída.

# Rancher 1.6.30: laboratório de grupos locais e OIDC

Este é um protótipo executável local, com alterações reais no Cattle. Não foi aplicado em nenhum Rancher externo. Há um host legado isolado registrado para aceites físicos; a VM adicional de políticas foi parada após os testes. Nenhum host corporativo foi conectado.

## Acesso

- Nova console: http://localhost:18090/console/
- Rancher clássico: http://localhost:18080
- Grupos locais: http://localhost:18080/local-groups (administrador)
- Keycloak de teste: http://localhost:18081
- Tela sem acesso: http://localhost:18080/no-access

O administrador local é `labadmin`; a senha está em `.env`, na variável `RANCHER_ADMIN_PASSWORD`. No Keycloak, `labadmin` usa `KEYCLOAK_ADMIN_PASSWORD`.

No botão **Entrar com Keycloak**, os usuários sintéticos `sem-acesso`, `leitor` e `operador` usam `LAB_USER_PASSWORD`, também em `.env`. Não usar credenciais corporativas neste laboratório.

Após os testes, `sem-acesso` fica sem environments; `leitor` tem Read Only no RBAC-DEV; `operador` tem Member no RBAC-DEV. RBAC-PROD não é liberado a esses usuários.

## Inicialização original do protótipo

Para continuar o laboratório já existente, use os comandos de build/recriação **somente da console** no [README da console](console/README.md); não reinicialize credenciais ou o realm. O script abaixo documenta o bootstrap original.

Requisitos: Docker Desktop com containers Linux, PowerShell 7 e Python 3. Bibliotecas Java são as da imagem oficial; não é necessário instalar Maven, Java ou o antigo Bower no Windows.

```powershell
./Start-Lab.ps1
python ./tests/integration.py
```

O script cria credenciais aleatórias locais em `.env` e o realm descartável em `keycloak/realm.json`. Ambos são ignorados pelo Git; `.env` também é excluído do contexto de build. Não compartilhar esses arquivos. Os testes modificam exclusivamente os fixtures de laboratório nomeados no código e deixam os dados demonstráveis para revisão.

Para parar preservando os dados:

```powershell
docker compose stop
```

Os volumes preservam o MySQL, as chaves/estado do Rancher e o Keycloak. O container `rancher16-rbac-baseline` foi preservado parado como referência da imagem original; não iniciá-lo junto com o laboratório, pois usa o mesmo volume MySQL.

## Implementação

- Fontes oficiais: Cattle `v0.183.83` (`82d154a53f4089fecfb9f320caad826bb4f6055f`), UI `v1.6.52` (`60188e28ea545833dd2cea8ce104a77c2dbafd59`) e Rancher `v1.6.30` (`e780d3416460277ec56d77ac367dacbf564669a9`). Branches locais: `feat/local-groups-oidc`.
- `LocalGroupStore`: grupos, membros e concessões ficam em tabelas próprias no MySQL do Rancher. Alterações de membros/concessões são transacionais; revisões impedem sobrescrever uma edição concorrente. Auditoria registra ator, grupo, operação e data.
- `LocalGroupManager`: API nativa `GET/POST /v2-beta/localGroups`, acessível somente a administradores autenticados. Cada POST salva um grupo completo. `delete: true` exclui o grupo e as concessões.
- `AuthDaoImpl`: combina as concessões locais com o acesso original na listagem, seleção do papel e autorização de environments. A composição de papéis segue a prioridade existente do Rancher. Membros são consultados no banco em cada nova requisição, sem depender de claims de grupos no JWT.
- `project.create.default=false`: desativa provisionamento automático. A criação manual de environments também exige administrador no backend.
- `OidcSupport/OidcServlet`: Authorization Code com PKCE S256, estado de login ligado a cookie HttpOnly, nonce, validação RS256/JWKS, issuer, audience, expiração e ticket local de uso único. A identidade é vinculada por hash de `issuer + sub`, sem associação automática por e-mail. Grupos do Keycloak não concedem acesso. O login local do administrador está sujeito à configuração: é recusado quando RANCHER_OIDC_ONLY=true.
- OIDC complementa o provedor local (`localauthconfig`), emitindo a sessão normal do Rancher após validar o Keycloak. Não troca o provedor global por um novo `oidcconfig`.
- `ui/local-rbac`: rotas nativas Ember `/no-access` e `/local-groups`, com o cabeçalho, rodapé, estilos, inputs, tabelas e botões originais do Rancher. O menu Grupos entra na navegação nativa; o botão Keycloak fica dentro do formulário original de login. Os HTML antigos somente redirecionam para essas rotas.
- O Dockerfile recompila apenas as classes alteradas contra os JARs da versão original e atualiza esses JARs na imagem extraída. A UI original é mantida e recebe um inicializador adicional. O build completo histórico Maven/Bower não foi reconstruído.
- Os templates `.hbs` e o JavaScript compilado estão no diretório da extensão. Para alterar templates, use `node ui/local-rbac/compile-templates.cjs <caminho-do-compilador>`. O script verifica o SHA-256 do compilador Ember 2.9.1 indicado em seu cabeçalho.

## Limites antes de produção

Este laboratório prova o fluxo básico e a autorização HTTP; não representa uma certificação de RBAC enterprise.

- Os papéis continuam sendo Owner, Member, Read Only e Restricted. Não há editor de permissões individuais por operação.
- As associações diretas originais continuam válidas. Para exigir acesso exclusivamente por grupos em uma instalação existente, será preciso migrar/revisar essas associações.
- Não foram validados hosts/agentes, workloads reais, Rancher CLI, Rancher Compose, console/exec, streams ou conexões WebSocket já abertas. Retirar alguém de um grupo impede novas requisições, mas não foi implementado encerramento de conexões já estabelecidas nem de processos em execução.
- Chaves de API e contas técnicas, especialmente chaves vinculadas diretamente ao environment, precisam de análise e testes próprios de revogação.
- Logout no Rancher encerra a sessão local; logout global/backchannel e desativação de usuário no Keycloak não invalidam imediatamente sessões locais já emitidas. O tempo de sessão segue a configuração do Rancher.
- Configuração OIDC está nas variáveis de ambiente; ainda não há tela para configurar o provedor. O backend suporta somente ID tokens RS256 nesta versão do protótipo.
- Migração de banco usa `CREATE TABLE IF NOT EXISTS` no startup; antes de produção deve passar a uma migração versionada com backup e rollback definidos. A auditoria ainda não contém snapshots completos antes/depois.
- O laboratório permite HTTP apenas para o Keycloak local e publica portas exclusivamente em `127.0.0.1`. Uma implantação externa exige HTTPS, gestão de segredos, revisão das dependências legadas e revisão de segurança.
- A configuração atual do protótipo impede todos os usuários comuns de criar environments. Se isso precisar ser delegável, deverá virar uma permissão explícita.

Os resultados dos testes são gravados em `test-results.json` somente após a suíte inteira passar.

## Configuração iniciada na fase 0

O contrato completo e os defaults estão em [flags e temas](docs/05-configuration-themes.md). As flags de grupos, apresentação sem acesso, criação de environments, autoenvironment e OIDC agora são passadas pelo Compose. `GET /oidc/config` expõe somente configuração pública e capacidades; `GET /oidc/status` informa os modos de login.

Adicionar a configuração escolhida ao `.env` local e, somente quando for necessário mudar política do servidor, recriar apenas Rancher preservando os overlays atuais: `docker compose -f compose.yaml -f compose.console.yaml -f compose.legacy-host.yaml up -d --no-deps rancher`. O arquivo contém segredos do laboratório: não publicar nem copiar para evidências. Não há alteração dinâmica de política sem recriação nesta fase. Booleanos inválidos e dependências incompatíveis impedem inicialização. A console independente está disponível em 18090 e tem configuração pública própria; variáveis alvo de modernização do backend não devem ser confundidas com flags efetivamente implementadas no frontend.

OIDC exclusivo/autologin e rollback passaram a matriz histórica de 28 checks; expiração real de JWT, logout federado e contas técnicas continuam pendentes. A console moderna implementa temas claro/escuro/sistema e overrides validados, com dark padrão; isso não altera o frontend clássico. Consulte o [status atual](docs/08-status.md) para o escopo e os limites dos aceites.

Compose de stacks existentes com origem persistida: doc34, flag stackComposeUpgrades. Helper de aceite exclusivo: stack_compose_upgrade_fixture.py seed → e2e/run.py stack-compose-upgrade → cleanup; criação inativa e scale0 pela API evitam o padrão nativo de escala1. Após reiniciar Docker: prepare_legacy_host.py e repair_legacy_connection.py verificam/reconectam somente o host legado existente, sem exibir registro.

## Rede estável do laboratório

Antes de instalar/subir a composição, executar `python ensure-lab-network.py` nesta pasta. A composição usa bridge externa dedicada validada sem substituir rede existente, com endereços reservados para Rancher e console. [Configuração, migração e limites](docs/57-stable-sandbox-addresses.md). Não usar down/remover volumes para resolver divergência de rede.
