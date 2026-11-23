# Preparação de release

<!-- rancho-language-navigation:start -->
[Português (Brasil)](release.md) | [English](../en/release.md)
<!-- rancho-language-navigation:end -->


## Fronteira atual

A versão alfa comunitária disponibiliza o código-fonte para avaliação em laboratório isolado. Fonte disponível, CI verde ou recorte aceito não autorizam mudar visibilidade, publicar pacote, fazer merge ou cutover produtivo. O aceite é controlado por capacidade/risco no [roadmap](roadmap.md), não por contagem acumulada de testes.

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

## Inventário de artefatos

A ferramenta offline usa Syft pinado e IDs locais das imagens. `plan` lê identidades/tamanhos escalares e hashes de manifests, sem exportar imagens ou reiniciar serviços. Scan é explícito e exige saída nova.

```sh
docker pull anchore/syft:v1.56.0@sha256:697ae864af1299cfa43c54b161cea3dd65c6d54de82e3dba66ea3dccb3acc313
python scripts/artifact_inventory.py plan
python scripts/artifact_inventory.py scan --output migration-runs/artifact-inventory
```

`--backend-image` e `--console-image` selecionam imagens locais; export usa IDs imutáveis resolvidos. Scanner não tem rede, socket Docker, workspace ou capabilities. Lê só archives/manifests próprios e scratch, com limites de recursos. Ownership/caminhos protegem cleanup.

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

## Instalação experimental de nó único

Gere o runtime e a console a partir do mesmo checkout. Execute a preparação das fontes fixadas antes de compilar o Dockerfile da raiz.

```sh
docker build -t rancho-backend-legacy-build:local .
docker build -f console/tests/legacy-host/Dockerfile.java17 --build-arg BACKEND_IMAGE=rancho-backend-legacy-build:local -t rancho-backend-java17:local console/tests/legacy-host
docker build -f console/tests/legacy-host/Dockerfile.modern-backend -t rancho-backend-modern-runtime:local console/tests/legacy-host
docker build -f console/tests/legacy-host/Dockerfile.modern-packages --build-arg BACKEND_IMAGE=rancho-backend-modern-runtime:local -t rancho-backend-modern:local console/tests/legacy-host
docker build -t rancho-console:local console
docker compose -f compose.modern.yaml --env-file <local-env-file> up -d --pull never
```

Defina um `RANCHO_DB_PASSWORD` exclusivo no arquivo de ambiente e proteja esse arquivo. A console fica disponível em loopback em `http://localhost:18090/console/`. Em um banco novo, inicialize a autenticação do administrador local antes de expor a console por um proxy de rede. O OIDC inicia desativado. Para habilitá-lo, configure emissor, ID e segredo do cliente e callback, e registre no provedor de identidade o callback na origem da console. Use HTTPS para acesso pela rede. Execute a instalação com uma réplica do servidor Rancher.

Para a imagem opcional de healthcheck do Cattle com Ubuntu 24.04, configure os limites flexível e rígido de `nofile` em 32768 no **serviço de healthcheck** do catálogo isolado. A integração no Docker 29 confirmou que os limites chegaram ao container e que o HAProxy expôs seu socket de estatísticas. Reproduza a inicialização e o reload em um container descartável com:

```sh
docker build -f console/tests/legacy-host/Dockerfile.modern-healthcheck -t rancho-healthcheck-modern:local console/tests/legacy-host
docker run --rm --network none --ulimit nofile=32768:32768 --entrypoint /bin/bash -i rancho-healthcheck-modern:local -s < console/tests/legacy-host/smoke-modern-healthcheck.sh
```

## Aceite final

Use um candidato identificado para autenticação/RBAC/streams, operação contextual, acessibilidade/performance, compatibilidade clássica, instalação nova, upgrade e recuperação/rollback completos. Registre limites/topologias. Configure canal privado de segurança antes de abrir o projeto. Mantenha [migração](migration.md) e [recuperação](recovery.md) vinculadas ao artefato; testes sintéticos não garantem migração universal.
