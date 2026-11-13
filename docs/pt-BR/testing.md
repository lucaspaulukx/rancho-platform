# Testes

<!-- rancho-language-navigation:start -->
[Português (Brasil)](testing.md) | [English](../en/testing.md)
<!-- rancho-language-navigation:end -->

O harness de navegador próprio `console/tests/localization_acceptance.py` também simula uma resposta de falha no módulo JavaScript de auditoria. Ele verifica a recuperação localizada, preserva a URL do environment e recarrega o módulo real após o transporte voltar. Seus contextos de navegador permitem tráfego de API somente para leitura e usam uma sessão temporária revogada durante a limpeza.

O build de produção executa `check:bundles` após o Vite. Ele percorre os imports do manifesto e confere os tamanhos gzip em `console/scripts/bundle-budgets.json`. Os limites são 256 KiB para o JavaScript inicial, 20 KiB para o CSS inicial, 100 KiB para qualquer chunk JavaScript sob demanda, 600 KiB para o JavaScript da aplicação e 64 KiB por catálogo de prévia. Um catálogo entra no próprio limite quando tem uma entrada dinâmica exclusiva e nenhum import estático. O código compartilhado continua no total da aplicação, e o relatório também mostra o tamanho do pacote JavaScript completo.




## Checks de fontes

Execute em checkout limpo, sem importar credenciais do laboratório. O frontend usa fixtures de contratos sanitizadas do pacote, não clones de consulta.

```sh
cd console
npm ci
npm run check:locales
npm test
npm run build
npm run format:check
```

Na raiz, valide conteúdo/histórico para distribuição e documentação:

```sh
python scripts/check_repository.py
python scripts/check_public_history.py
python scripts/docs_languages.py
python -m unittest discover -s tests -p test_public_history.py
python -m unittest discover -s tests -p test_docs_languages.py
python -m unittest discover -s tests -p test_repository_layout.py
python -m unittest discover -s tests -p test_artifact_inventory.py
```

Execute `python scripts/check_backend_contracts.py` com um JDK que suporte `javac --release 8`. O script compila as classes selecionadas direto do patch exportado do Cattle e executa os contratos de configuração, logout OIDC e disponibilidade do provedor sem laboratório ou clone do upstream.

O scanner de conteúdo confere o índice; revise alterações não selecionadas separadamente. Scanner de histórico e revisão de idiomas têm limites explícitos e não certificam ausência de secrets, qualidade da tradução, conformidade de licenças ou prontidão produtiva.

## Backend e migração

Para contratos backend alterados, execute os testes Java/Go pertinentes e export/check dos patches pinados. O Dockerfile inclui testes/race do Go; o script de validação faz build limpo a partir de fontes/patches do índice. Reusar fontes locais continua exigindo pins e patches válidos.

```sh
python scripts/upstream.py check
python scripts/validate_clean_backend.py --reuse-local-upstream
python -m unittest migration.test_tool migration.test_crypto_stream migration.test_recovery migration.test_engine_isolation migration.test_images migration.test_grants
```

O último comando executa contratos. Comandos `*_lab`, integração de bootstrap e harnesses físicos são ações operacionais distintas; confira precondições/ownership antes de executá-los. Um nome de teste unitário não torna um ensaio de banco inofensivo.

### Ensaio isolado com 20 ambientes

Execute no laboratório local do Rancher com um banco sintético próprio. O teste gera um backup criptografado, restaura uma cópia sem rede nem montagem de volumes de origem e prepara nela uma fixture com schema original e 20 ambientes. Ele verifica a consistência da restauração, a aplicação do schema, a idempotência, o rollback e a limpeza. Este ensaio valida o fluxo de banco. O boot do Rancher e o login federado têm testes de aceite separados.

```sh
python -m migration.test_original_rehearsal
```

### Upgrade e rollback do engine original

Execute apenas no laboratório sintético indicado, durante uma janela de manutenção. O teste interrompe brevemente o Rancher, o Keycloak e o console locais para uma captura a frio consistente e reinicia os três antes de testar a cópia restaurada. A cópia isolada inicia o Rancher 1.6.30 com 20 ambientes, migra para a imagem local de backend selecionada, confere o registro da migração após reiniciar e verifica que uma divergência de checksum bloqueia a inicialização. No rollback, o teste inicia a imagem original sobre uma nova cópia do snapshot original correspondente e verifica a ausência das tabelas customizadas. O teste de recuperação confere o documento de entrada do cliente clássico e os dois bundles JavaScript, o login administrativo e o inventário de ambientes. Registre os IDs das duas imagens, a preservação dos containers de origem e a disponibilidade HTTP a partir do relatório. O aceite de workloads, armazenamento externo e topologia final é separado.

```sh
python -m migration.test_original_engine_lab --quiesce --backend-image my-backend:candidate
```

Adicione `--classic-browser` com o Chromium do Playwright instalado para conferir o login pelo Ember e a lista de ambientes depois de restaurar o engine original. Uma ponte temporária em porta local efêmera encaminha apenas leituras, login e revogação da sessão para a cópia restaurada. O namespace Docker restaurado fica sem portas publicadas. O teste bloqueia outras origens no navegador e registra a revogação da sessão.

## Aceite nativo e de navegador

Execute os testes unitários, a verificação dos catálogos e o build do console sem o laboratório Docker. Para testes de navegador com login local, inicie Rancher e console. Adicione o Keycloak para verificar OIDC. O host Docker legado só é necessário nos testes que executam workloads ou abrem streams reais. Quando o teste exigir o host, inicie o serviço explicitamente na raiz do repositório.

```sh
docker compose -f compose.yaml -f compose.console.yaml -f compose.legacy-host.yaml up -d --no-deps legacy-test-host
```

Após os testes, desligue a VM com `python console/tests/legacy_guest.py shutdown`. A VM tem limite de 2.300 MiB e guarda seu disco no volume nomeado.

Execute `python console/tests/standalone_metadata_readback.py` com o Chromium do Playwright e o host legado isolado em execução. O teste cria um container avulso, edita nome e descrição em Operações, confere sua identidade no Rancher e no Docker e remove o recurso de teste.

Execute `python tests/flag_integration.py --browser --release-images BACKEND_SHA256_ID CONSOLE_SHA256_ID` no laboratório local indicado durante uma janela de manutenção. O teste recria o backend do Rancher com OIDC exclusivo, entrada automática e grupos locais desativados. Ele verifica o login e as falhas no navegador, restaura a configuração híbrida e confere o acesso dos grupos e as variáveis de ambiente originais do backend. Use os IDs imutáveis das imagens registrados no relatório de release.

Execute o teste do cliente clássico no laboratório local indicado com o Chromium do Playwright instalado. Use o mesmo ID de backend registrado no ensaio de release. O teste confere se o container esperado é dono da porta local, entra pelo Ember, abre a lista de ambientes sem erros não tratados no navegador e revoga a sessão de teste. As requisições do navegador se limitam a leituras locais e ao login. Esse teste cobre o backend candidato. O ensaio de rollback isolado cobre a entrega dos arquivos clássicos no backend original.

```sh
python -m migration.test_classic_browser_lab --backend-image rancho-backend:candidate
```

Use host/guest Docker dedicado e compatível com a geração legada. Harnesses físicos em `console/tests/` restringem-se intencionalmente a sandbox nomeado, environment/host esperados e ownership explícito. Não são diagnósticos genéricos de produção nem automaticamente portáveis para qualquer instalação nova. Leia o script e provisione a fixture exigida antes de executá-lo.

Cada teste define alegação e budget, usa recursos próprios, exerce controles positivos/negativos, preserva dados/configuração anteriores e confere cleanup. Execute uma fixture com baseline global/canal serial do guest por vez. Cleanup incompleto é falha mesmo se a asserção principal passou. Preserve relatórios sanitizados de falhas; não edite relatório para obter sucesso.

Entrypoints mantidos incluem `physical_ulimits.py`, `ulimit_upgrade_acceptance.py`, `physical_ulimit_upgrades.py`, `service_sidecar_ulimit_creation.py`, `host_stream_matrix.py` e `localization_acceptance.py`. Leia CLI/implementação antes do uso. Testes browser criam contextos próprios e não devem operar a aba ativa do usuário, registrar storage privado ou capturar credenciais. O harness de localização exige o laboratório local nomeado, sobrescreve apenas a resposta de configuração do seu navegador, usa GET/HEAD no browser e revoga a própria sessão de controle. Verifica a prévia pt-BR/en-US implementada, diálogos abertos, comportamento mobile e de temas e alguns fluxos RTL. Nas 21 rotas principais do menu, verifica títulos, escopo de environment e se o conteúdo e as ações cabem na tela em inglês e persa, a 320 e 390 px. Tradução completa, cobertura RTL e troca de idioma em streams reais de host exigem aceite separado.

O helper de transporte do scheduler é diagnóstico limitado para a rede gerenciada legada. Confere ownership/IP/MAC, instala regra temporária para peer/destino exatos e remove antes das asserções de stream/inspect. Teste aprovado com esse helper não prova estabilidade CNI nativa. Não afrouxe timeouts do produto para disfarçar falha de alocação.

O teste de localização injeta um link sintético de paginação de outra origem na página de Hosts. Ele confere se o link continua bloqueado e se a mensagem visível muda de idioma sem revelar o endereço.

### Verificações automatizadas de acessibilidade

Execute o teste de localização no navegador com `--accessibility` e as dependências de desenvolvimento do console instaladas. Ele usa axe em Grupos, Usuários, Chaves de API, Configurações, Auditoria e Ambientes a 390 e 1440 px nos temas escuro e claro. O teste reporta identificadores de regras e contagens. Revise as verificações manuais indicadas no relatório e exercite os fluxos críticos com teclado e leitor de tela antes da release.

Para gerar evidência de release, passe os IDs do backend e do console registrados no relatório de release. O teste confere as imagens em execução antes de criar a sessão e verifica se os dois containers foram preservados ao terminar.

```sh
python console/tests/localization_acceptance.py --accessibility --release-images BACKEND_SHA256_ID CONSOLE_SHA256_ID
```

```sh
python console/tests/localization_acceptance.py --accessibility
```

## Evidências e escopo

Execute `python console/tests/gateway_security.py` com os containers locais do Rancher e do Nginx da console disponíveis na porta 18090. O teste usa uma sessão descartável de administrador e a revoga ao terminar. Verifica a política de cache e os cabeçalhos de segurança pelo Nginx, incluindo um callback OIDC inválido, sem precisar iniciar o provedor de identidade. Também verifica que scripts com hash mantêm o cache imutável.

Execute `python console/tests/gateway_authorization.py` com o mesmo gateway local e o Keycloak em execução. O teste exige os fixtures RBAC-DEV/RBAC-PROD e usa três sessões descartáveis. Verifica escopo de projeto, bloqueio de escrita para leitores, reutilização de tickets OIDC, ausência de campos de credenciais na configuração OIDC pública e requisições de outra origem com cookie de sessão. Se houver um proxy reverso à frente do Nginx, verifique que ele preserva o cabeçalho Host público usado na comparação de origem.

`physical_security_options.py` compara um container com a opção nativa `no-new-privileges` com um controle equivalente. Exige Docker no host legado isolado original e compara os valores da API do ambiente, as opções de segurança do Docker e `NoNewPrivs` nos processos em execução. O teste cobre uma opção e um runtime.

`physical_devices.py` exercita separadamente o editor default off pela criação real de container avulso, verificando mapeamento nativo/Docker exato, modo não privilegiado, leitura de dispositivo char e resultado real de abertura para escrita. Confere negação ao membro revogado e limpeza exata. A fixture /dev/null não certifica isolamento de escrita pelas permissões padrão nativas; upgrades de serviços, sidecars físicos e outros dispositivos/runtimes exigem aceites separados.

`service_sidecar_device_creation.py` exercita a criação contextual real de serviço com mapeamentos diferentes na configuração principal e em um sidecar. Cada container em execução deve ter apenas o próprio caminho mapeado. O teste compara a API e a configuração do Docker com a leitura pelo processo e confere a limpeza em relação ao inventário anterior.

`device_upgrade_acceptance.py` exercita upgrade contextual, reversão, conclusão e remoção explícita em um serviço de teste com escala zero. Confere autorização após revogação e limpeza exata. `physical_device_upgrades.py` usa separadamente uma réplica para verificar o mapeamento nativo, a configuração do Docker e a leitura dos dispositivos nos containers substituídos. Rode esses testes em sequência no sandbox nomeado. Sidecars físicos e comportamento em múltiplos hosts exigem fixtures próprias.

`sidecar_device_upgrade_acceptance.py` verifica o editor estruturado em serviço próprio com escala zero, incluindo flag desligada, campo ausente no schema atualizado do ambiente, retenção do rascunho, upgrade, reversão, conclusão e remoção explícita. Confere a preservação do mapeamento principal, a limpeza e a revogação da sessão.

`physical_sidecar_device_upgrades.py` executa separadamente a estratégia nativa com uma réplica no host legado isolado. Confere os dois containers durante upgrade, reversão, conclusão e remoção do mapeamento. Verifica a configuração exata do Docker e a leitura de dispositivos de caractere depois que o relay temporário de alocação é removido. Na fixture, o Rancher substituiu os dois containers durante os upgrades e a reversão e preservou o mapeamento principal. O teste também confere a limpeza exata e a rejeição da sessão revogada. O escopo cobre as permissões solicitadas e a leitura dos aliases em um host.

### Upgrade e rollback do frontend

Use duas referências distintas de imagens do console já disponíveis localmente. O teste cria um proxy próprio na porta de loopback 18091 e troca anterior → candidata → anterior em um volume próprio de assets. Deixe a porta livre. Usa a configuração versionada, respostas sintéticas da API e contextos novos do Chromium. Confere os chunks carregados sob demanda nas duas trocas, o ponto de entrada restaurado em abas novas, a política de cache e a limpeza. Rollback de backend e banco exige ensaios separados.

```sh
python console/tests/frontend_rollback.py --previous-image rancho-console:previous --candidate-image rancho-console:candidate
```

### Inventário em alto volume

Com o console compilado em localhost:18090 e o Chromium do Playwright disponível, rode este comando na raiz do repositório.

```sh
node console/tests/e2e/high-volume-inventory.cjs
```

Defina `PLAYWRIGHT_MODULES` e `CHROMIUM_EXECUTABLE` se o Playwright ou o Chromium estiverem instalados fora dos caminhos padrão. O benchmark usa três contextos novos de navegador e 20 ambientes sintéticos com 20 stacks, 200 serviços e 2.000 containers em cada um. Confere a paginação da API, o limite de 50 linhas, a troca local de página, a busca global pelo último container e o retorno à primeira página ao trocar de ambiente. Testes separados verificam a lista contínua com a paginação desligada e a troca de página em uma viewport de 390 px. O teste agrupado expande uma árvore sintética, percorre as páginas e confere o limite de linhas, os cabeçalhos de contexto, a busca, o recolhimento e a árvore contínua com a opção desligada. Defina `UX06_BASELINE=1` para medir um build anterior sem paginação. Registra o asset inicial, o tempo de carregamento e troca de ambiente, o tamanho do DOM, tarefas longas e o heap após a coleta de lixo. O navegador fornece as respostas da API sem credenciais nem gravações no Rancher. Use o mesmo navegador, máquina e configuração de build para comparar resultados. A latência do backend e sessões longas exigem testes separados.

Defina `UX06_LAYOUT_ONLY=1` para rodar somente as verificações de layout estreito e RTL. Elas exercitam nomes longos de environment e stack nas abas Serviços e Containers e conferem o alinhamento da barra da árvore e do total de métricas em persa.

A 320 px, o teste de layout verifica um rótulo longo de estado em francês. Ele também desativa as ações contextuais em um contexto de navegador separado e verifica o resumo do inventário e a largura da página em português, francês e persa.

Defina `UX06_SOAK_SECONDS` como um inteiro de 60 a 900 para executar somente o soak de inventário. Em uma aba visível do Chromium, o teste verifica atualizações periódicas e recuperação automática após duas falhas sintéticas de leitura. O relatório inclui heap após coleta de lixo, tempo de trabalho do renderer, escopo e contagem de linhas.

### Soak de métricas nativas do host

Execute no laboratório local UI-OPS-LAB com o host existente ativo. O teste abre o console real em um contexto isolado do Chromium, verifica a reconexão explícita e mede a continuidade dos frames, o tempo de trabalho do renderer e o heap após coleta de lixo. Confere o limite do histórico CSV, apaga o download, fecha o stream e revoga a própria sessão. Use 360 segundos para ultrapassar a janela de histórico de cinco minutos. O resultado cobre um stream de métricas de host.

```sh
python console/tests/host_metrics_soak.py --seconds 360
```

### Streams nativos concorrentes

Execute no UI-OPS-LAB com o host legado ativo. O teste provisiona um serviço próprio com uma réplica e abre logs, terminal e métricas de host, container e serviço em páginas separadas. O relatório registra frames, intervalos máximos, respostas do terminal, limites do histórico CSV, hash do asset carregado e limpeza dos sockets, da fixture e da sessão temporária.

Ative as métricas de serviço na configuração servida para o aceite de release. Use `--service-preview` para ativar o recurso no contexto de navegador do teste durante um ensaio com o recurso desligado. Se o scheduler legado local precisar do diagnóstico isolado, passe `--scheduler-relay`. O teste confirma a remoção do relay antes de abrir os streams. As duas opções são registradas no relatório.

```sh
python console/tests/concurrent_streams_soak.py --seconds 360
```

Separe unitário/componente, build limpo, renderização browser, comportamento nativo real e CI remoto. Registre identidade do artefato, flags, escopo, controles, resultados medidos e cleanup; publique somente resumos sanitizados. Teste `nofile` em um host não valida todos os limites ou multi-host. Probe curto de WebSocket não prova estabilidade do scheduler/soak. Restore offline de DB não prova recuperação de engine/IdP/workloads. Aceites restantes ficam no [roadmap](roadmap.md).
