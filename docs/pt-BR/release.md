# Preparação de release

<!-- rancho-language-navigation:start -->
[Português (Brasil)](release.md) | [English](../en/release.md)
<!-- rancho-language-navigation:end -->


## Fronteira atual

A instalação da beta comunitária abaixo destina-se à avaliação em laboratório isolado com Linux amd64, um servidor Rancho, MariaDB 10.11 externo e hosts Cattle Docker 29. A distribuição de código inclui as receitas de build e os avisos de licença. Aceite de produção, alta disponibilidade e substituição direta de stacks IPsec existentes ficam fora do escopo da beta. O [roadmap](roadmap.md) registra as validações pendentes.

O pacote contém fontes de aplicação/extensões, patches pinados, testes, templates, licenças e documentação mantida. Clones de consulta, dependências instaladas, credenciais/realms locais, dumps, evidências de sessão, estado de fixtures, backups e notas de máquina ficam fora do versionamento. Git preserva versões anteriores; elas não são instruções de onboarding.

## Fontes reproduzíveis e validação

```sh
python scripts/upstream.py apply
python scripts/upstream.py check
python scripts/check_repository.py
python scripts/check_public_history.py
python scripts/docs_languages.py --require-complete
```

O lock upstream fixa commits oficiais. Faça build desses fontes e patches exportados, não de checkout modificado fora do índice. Preserve licenças/NOTICE, lockfiles revisados, imagens imutáveis e artefato anterior recuperável. Confira estado privado em imagens/configuração antes de distribuir.

CI de fontes/console usa permissão readonly, actions pinadas e nenhum secret de laboratório. Confere fonte e histórico, contratos dos scanners, contratos de migração offline, instalação por lock, formatação, testes frontend e TypeScript/Vite. O aceite de backend físico, HA e migração de ponta a ponta é separado. A documentação de release exige todos os pares ativos pt-BR/inglês revisados, atuais e ligados.

## Verificar um pacote de código-fonte

O workflow `Source release provenance`, iniciado manualmente na `main`, empacota o commit selecionado e assina o digest do ZIP. Baixe o artefato do workflow e atribua a `commit` o hash completo do commit da release. Verifique o checksum e a atestação do GitHub.

```sh
sha256sum -c SHA256SUMS.txt
gh attestation verify "rancho-platform-${commit}-source.zip" \
  --repo lucaspaulukx/rancho-platform \
  --signer-workflow lucaspaulukx/rancho-platform/.github/workflows/source-provenance.yml \
  --source-ref refs/heads/main --source-digest "$commit" --deny-self-hosted-runners
```

O workflow atesta o ZIP do código-fonte. As imagens de runtime exigem atestações próprias vinculadas aos digests de seus manifests OCI. O workflow armazena o ZIP e o checksum como artefatos de CI para preparar a release.

## Inventário de artefatos

A ferramenta offline usa Syft pinado e IDs locais das imagens. `plan` lê identidades/tamanhos escalares e hashes de manifests, sem exportar imagens ou reiniciar serviços. Scan é explícito e exige saída nova.

```sh
docker pull anchore/syft:v1.56.0@sha256:697ae864af1299cfa43c54b161cea3dd65c6d54de82e3dba66ea3dccb3acc313
python scripts/artifact_inventory.py plan
python scripts/artifact_inventory.py scan --output migration-runs/artifact-inventory
```

`--backend-image` e `--console-image` selecionam imagens locais; export usa IDs imutáveis resolvidos. Scanner não tem rede, socket Docker, workspace ou capabilities. Lê só archives/manifests próprios e scratch, com limites de recursos. Ownership/caminhos protegem cleanup.

Repita `--extra-image NOME=IMAGEM` para incluir cada imagem adicional do perfil selecionado. Por exemplo, use `--extra-image database=rancho-mariadb:local --extra-image restore=rancho-migration-restore:local` para incluir o banco e o importador. Use nomes únicos em minúsculas. No perfil moderno de workloads, inclua o bootstrap e as oito imagens de sistema do Cattle. O exemplo grava `runtime-database.cdx.json` e `runtime-restore.cdx.json`, com os IDs imutáveis correspondentes em `summary.json`.

Projeções CycloneDX públicas permitem identidades/versões/hashes/licenças e relações, excluindo configuração de imagem, environment, caminhos privados e metadados desconhecidos. O CI offline verifica que referências ambíguas são rejeitadas antes que um arquivo filtrado oculte uma dependência de pacote. Nomes de pacotes ainda podem ser privados e exigem revisão. Runtime e lockfile de desenvolvimento são evidências distintas; JS incorporado e Go antigo podem ter detecção incompleta. Licenças desconhecidas são pendências, não aprovação. Não é scanner CVE nem certificação jurídica e não publica automaticamente.

## Instalação limpa isolada

Use duas imagens Linux locais já compiladas. O ensaio usa volumes próprios novos e uma rede privada sem portas publicadas. Verifica a UI clássica, o proxy do console, a migração de schema e a idempotência após reiniciar o backend. O teste usa MySQL embutido com OIDC e redirecionamento moderno do backend desligados.

```sh
python -m migration.test_fresh_install_lab --backend-image rancho-backend:local --console-image rancho-console:local
```

Adicione `--configuration-reversal` para ativar, desativar e reativar a customização nos mesmos volumes isolados de banco. O ensaio confere as flags solicitadas e efetivas de RBAC/schema, a entrega da UI clássica e da API, a preservação do registro de migração e a recuperação do proxy do console. Esse perfil mantém o OIDC desativado.

## Ensaio com um artefato fixado

Execute o teste combinado com três imagens locais e o Chromium do Playwright disponível no ambiente Python. Deixe a porta local 18091 livre para o proxy temporário de rollback. A ferramenta resolve os IDs das imagens uma vez, executa a instalação limpa e o upgrade/rollback do frontend com a mesma imagem candidata e registra os IDs, o hash da configuração e a limpeza. O relatório cobre essas duas verificações. Registre separadamente os demais critérios de release.

Passe `--configuration-reversal` também nesse comando para registrar a reversão de flags em execução no mesmo relatório.

```sh
python -m scripts.release_artifact_rehearsal --backend-image rancho-backend:local --previous-console-image rancho-console:previous --candidate-console-image rancho-console:candidate
```

Para o [ensaio sintético de upgrade e rollback do backend](testing.md#upgrade-e-rollback-do-engine-original), passe o ID `images.backend` do relatório combinado como `--backend-image`. Compare esse ID com `images.candidateBackend` no relatório do engine antes de reunir as evidências. O ensaio do engine exige o laboratório local indicado e uma janela de manutenção para a captura a frio.

Para o perfil moderno com MariaDB, acrescente os dois argumentos abaixo. O comando fixa o ID de cada imagem e valida a importação no primeiro início, a repetição do comando, a rejeição de outro backup, o rollback do banco para Rancher 1.6.30 e o rollback no navegador. A imagem original do Rancher deve estar disponível localmente. O perfil moderno usa as portas de loopback 18119 e 18091.

```sh
python -m scripts.release_artifact_rehearsal --backend-image rancho-backend-modern:local --previous-console-image rancho-console:previous --candidate-console-image rancho-console:local --modern-database-image rancho-mariadb:local --restore-image rancho-migration-restore:local
```

O auxiliar de restauração no primeiro início usa uma base fixada de Python 3.13 com Alpine e instala wheels binárias. O Trivy 0.74.0 com a base de avisos de 13 de novembro de 2026 reportou 2 ocorrências críticas e 81 altas por pacote e aviso na imagem anterior, baseada em Debian, e zero ocorrências dessas severidades na imagem Alpine. O cliente MariaDB se conecta a `db` na rede privada do Compose e aceita o certificado autoassinado padrão desse banco. Mantenha o auxiliar na rede interna de banco definida em `compose.migrate.yaml`.

## Instalação experimental de nó único

Para uma instalação Rancher existente, consulte [hosts existentes e versões do Docker](migration.md#hosts-existentes-e-versões-do-docker) antes de escolher o catálogo Cattle moderno.

Gere o runtime e a console a partir do mesmo checkout. Execute a preparação das fontes fixadas antes de compilar o Dockerfile da raiz.

```sh
docker build -t rancho-backend-legacy-build:local .
docker build -f console/tests/legacy-host/Dockerfile.java17 --build-arg BACKEND_IMAGE=rancho-backend-legacy-build:local -t rancho-backend-java17:local console/tests/legacy-host
docker build -f console/tests/legacy-host/Dockerfile.modern-backend -t rancho-backend-modern-runtime:local console/tests/legacy-host
docker build -f console/tests/legacy-host/Dockerfile.modern-packages --build-arg BACKEND_IMAGE=rancho-backend-modern-runtime:local -t rancho-backend-modern:local console/tests/legacy-host
docker build -t rancho-console:local console
```

Defina um `RANCHO_DB_PASSWORD` exclusivo no arquivo de ambiente e proteja esse arquivo. A console fica disponível em loopback em `http://localhost:18090/console/`. Em um banco novo, inicialize a autenticação do administrador local antes de expor a console por um proxy de rede. O OIDC inicia desativado. Para habilitá-lo, configure emissor, ID e segredo do cliente e callback, e registre no provedor de identidade o callback na origem da console. Use HTTPS para acesso pela rede. Execute a instalação com uma réplica do servidor Rancher.

Configure [um provedor OIDC existente](configuration.md#provedor-openid-connect-externo) se quiser SSO. O exemplo usa uma aplicação Microsoft Entra ID de tenant único.

Para a imagem opcional de healthcheck do Cattle com Ubuntu 24.04, configure os limites flexível e rígido de `nofile` em 32768 no **serviço de healthcheck** do catálogo isolado. A integração no Docker 29 confirmou que os limites chegaram ao container e que o HAProxy expôs seu socket de estatísticas. Reproduza a inicialização e o reload em um container descartável com:

```sh
docker build -f console/tests/legacy-host/Dockerfile.modern-healthcheck -t rancho-healthcheck-modern:local console/tests/legacy-host
docker run --rm --network none --ulimit nofile=32768:32768 --entrypoint /bin/bash -i rancho-healthcheck-modern:local -s < console/tests/legacy-host/smoke-modern-healthcheck.sh
```

O patch opcional `console/tests/legacy-host/modern-catalog-runtime.patch` se aplica ao commit `52a5850bc49247eadd84045da890deaeaeddb9a4` do catálogo Rancher. Aplique em uma cópia separada do catálogo no laboratório isolado e aponte o laboratório para essa cópia. O patch define os limites de descritores do healthcheck e executa o scheduler na bridge Docker. As tags do catálogo selecionam as imagens padrão do Rancher, a menos que as imagens recompiladas correspondentes sejam carregadas com essas tags no daemon descartável.

Em um ambiente Cattle novo, o patch alternativo `console/tests/legacy-host/modern-catalog-images.patch` inclui os ajustes de execução e seleciona explicitamente as imagens recompiladas. Compile as tags locais abaixo e carregue-as em cada host descartável antes do registro. Defina o caminho do catálogo e do patch no shell antes de aplicar o patch. Aplique esse patch sozinho no catálogo original fixado. Use um ambiente novo. A atualização do contêiner principal de IPsec em uma rede existente exige aceite próprio.

```sh
fixture=console/tests/legacy-host
for component in ipsec-holder ipsec-router ipsec-cni network-manager metadata dns healthcheck scheduler; do
  docker build -f "$fixture/Dockerfile.modern-$component" -t "rancho-$component:local" "$fixture" || exit
done
```

O Compose moderno aceita `RANCHO_DATABASE_IMAGE`. Para usar a imagem MariaDB 10.11 com o auxiliar `gosu` recompilado, gere a imagem localmente e defina `RANCHO_DATABASE_IMAGE=rancho-mariadb:local` no arquivo de ambiente usado pelo Compose. O banco continua com o entrypoint original em rede interna. Use `--database-image rancho-mariadb:local` no ensaio de migração sintética para validar a mesma imagem.

```sh
docker build -f console/tests/legacy-host/Dockerfile.modern-mariadb -t rancho-mariadb:local console/tests/legacy-host
```

A imagem oficial fixada do MariaDB 10.11.19 reportou um achado crítico e 25 altos, todos no runtime Go vinculado ao `gosu`. A imagem opcional recompila o mesmo código do gosu 1.20 com Go 1.27.3. Com a base de avisos de 13 de novembro de 2026, a imagem derivada reportou zero achados críticos e altos. A instalação limpa pelo gateway da Console e o reinício do backend passaram com esse banco.

Compile a imagem de bootstrap moderna e use a tag canônica do agente somente nos hosts Docker descartáveis de destino. O registro e o agente persistente usam essa tag. Carregue as oito imagens de sistema do Cattle nos mesmos hosts antes de registrá-los.

```sh
fixture=console/tests/legacy-host
docker build -f "$fixture/Dockerfile.modern-client" -t rancho-agent-modern-client:local "$fixture"
docker build -f "$fixture/Dockerfile.modern-bootstrap" -t rancho-agent-modern-bootstrap:local "$fixture"
docker tag rancho-agent-modern-bootstrap:local rancher/agent:v1.2.11
```

Prepare o catálogo no commit fixado do upstream, aplique o patch independente, faça commit apenas dos quatro templates modificados e crie um clone bare com a branch master. Defina `RANCHO_CATALOG_DIRECTORY` com o caminho absoluto desse clone no arquivo de ambiente do Compose. O override inicia a biblioteca local e o executor Compose. O gateway usa loopback por padrão. Para um host descartável remoto, use um endpoint HTTPS acessível com certificado confiável para o host descartável.

```sh
catalog_checkout="$PWD/../rancho-catalog-worktree"
absolute_patch_path="$PWD/console/tests/legacy-host/modern-catalog-images.patch"
git clone https://github.com/rancher/rancher-catalog.git "$catalog_checkout"
git -C "$catalog_checkout" switch --detach 52a5850bc49247eadd84045da890deaeaeddb9a4
git -C "$catalog_checkout" apply "$absolute_patch_path"
git -C "$catalog_checkout" add -- infra-templates/ipsec/18/docker-compose.yml.tpl \
  infra-templates/network-services/29/docker-compose.yml.tpl \
  infra-templates/healthcheck/7/docker-compose.yml infra-templates/scheduler/13/docker-compose.yml
git -C "$catalog_checkout" commit -m "Use the Rancho modern Cattle images"
git -C "$catalog_checkout" branch -f master HEAD
git clone --bare --branch master "$catalog_checkout" "$PWD/../rancho-catalog.git"
```

Crie um `.env.rancho-beta` local com estes valores. Use o caminho do seu catálogo e gere uma senha exclusiva para o banco.

```dotenv
RANCHO_DB_PASSWORD=<unique-password>
RANCHO_DATABASE_IMAGE=rancho-mariadb:local
RANCHO_CATALOG_DIRECTORY=<absolute-path-to-rancho-catalog.git>
```

```sh
docker compose --env-file ./.env.rancho-beta -f compose.modern.yaml -f compose.modern-cattle.yaml up -d --pull never
```

A candidata passou na instalação e no reinício com o override do catálogo, na atualização e reversão da console com abas antigas e no ensaio de dump e restauração de MySQL 5.5 com 20 ambientes sintéticos. Os testes do gateway com as mesmas imagens da console, do backend e do banco cobriram replay OIDC, isolamento RBAC, CSRF, revogação de sessão e cache. A comparação de segurança usa a base Trivy de 13 de novembro. O SBOM aponta metadados de licença pendentes. O pacote de código preserva as referências e os avisos do upstream.

## Aceite final

Use um candidato identificado para autenticação/RBAC/streams, operação contextual, acessibilidade/performance, compatibilidade clássica, instalação nova, upgrade e recuperação/rollback completos. Registre limites/topologias. Configure canal privado de segurança antes de abrir o projeto. Mantenha [migração](migration.md) e [recuperação](recovery.md) vinculadas ao artefato; testes sintéticos não garantem migração universal.
