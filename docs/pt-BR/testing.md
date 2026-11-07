# Testes

<!-- rancho-language-navigation:start -->
[Português (Brasil)](testing.md) | [English](../en/testing.md)
<!-- rancho-language-navigation:end -->

O harness de navegador próprio `console/tests/localization_acceptance.py` também simula uma resposta de falha no módulo JavaScript de auditoria. Ele verifica a recuperação localizada, preserva a URL do environment e recarrega o módulo real após o transporte voltar. Seus contextos de navegador permitem tráfego de API somente para leitura e usam uma sessão temporária revogada durante a limpeza.

O build de produção executa `check:bundles` após o Vite. Ele lê o manifesto gerado, percorre imports estáticos e verifica os tamanhos gzip contra `console/scripts/bundle-budgets.json`. Os limites cobrem JavaScript inicial (256 KiB), CSS inicial (20 KiB), o maior chunk JavaScript carregado sob demanda (100 KiB) e JavaScript total (600 KiB). Imports e CSS compartilhados são contados uma vez. A linha de base inicial inclui as prévias atuais de idiomas. Esses limites de artefatos complementam medições em runtime de latência, memória e renderização. Revise a alteração e seu custo medido antes de ajustar um limite.




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

O scanner de conteúdo confere o índice; revise alterações não selecionadas separadamente. Scanner de histórico e revisão de idiomas têm limites explícitos e não certificam ausência de secrets, qualidade da tradução, conformidade de licenças ou prontidão produtiva.

## Backend e migração

Para contratos backend alterados, execute os testes Java/Go pertinentes e export/check dos patches pinados. O Dockerfile inclui testes/race do Go; o script de validação faz build limpo a partir de fontes/patches do índice. Reusar fontes locais continua exigindo pins e patches válidos.

```sh
python scripts/upstream.py check
python scripts/validate_clean_backend.py --reuse-local-upstream
python -m unittest migration.test_tool migration.test_crypto_stream migration.test_recovery migration.test_engine_isolation migration.test_images migration.test_grants
```

O último comando executa contratos. Comandos `*_lab`, integração de bootstrap e harnesses físicos são ações operacionais distintas; confira precondições/ownership antes de executá-los. Um nome de teste unitário não torna um ensaio de banco inofensivo.

## Aceite nativo e de navegador

Use host/guest Docker dedicado e compatível com a geração legada. Harnesses físicos em `console/tests/` restringem-se intencionalmente a sandbox nomeado, environment/host esperados e ownership explícito. Não são diagnósticos genéricos de produção nem automaticamente portáveis para qualquer instalação nova. Leia o script e provisione a fixture exigida antes de executá-lo.

Cada teste define alegação e budget, usa recursos próprios, exerce controles positivos/negativos, preserva dados/configuração anteriores e confere cleanup. Execute uma fixture com baseline global/canal serial do guest por vez. Cleanup incompleto é falha mesmo se a asserção principal passou. Preserve relatórios sanitizados de falhas; não edite relatório para obter sucesso.

Entrypoints mantidos incluem `physical_ulimits.py`, `ulimit_upgrade_acceptance.py`, `physical_ulimit_upgrades.py`, `service_sidecar_ulimit_creation.py`, `host_stream_matrix.py` e `localization_acceptance.py`. Leia CLI/implementação antes do uso. Testes browser criam contextos próprios e não devem operar a aba ativa do usuário, registrar storage privado ou capturar credenciais. O harness de localização exige o laboratório local nomeado, sobrescreve apenas a resposta de configuração do seu navegador, usa GET/HEAD no browser e revoga a própria sessão de controle. Verifica a prévia pt-BR/en-US implementada, diálogos abertos, mobile e temas; não comprova tradução completa, RTL ou troca com streams reais de host.

O helper de transporte do scheduler é diagnóstico limitado para a rede gerenciada legada. Confere ownership/IP/MAC, instala regra temporária para peer/destino exatos e remove antes das asserções de stream/inspect. Teste aprovado com esse helper não prova estabilidade CNI nativa. Não afrouxe timeouts do produto para disfarçar falha de alocação.

## Evidências e escopo

`physical_security_options.py` compara um container com a opção nativa `no-new-privileges` com um controle equivalente. Exige Docker no host legado isolado original e compara os valores da API do ambiente, as opções de segurança do Docker e `NoNewPrivs` nos processos em execução. O teste cobre uma opção e um runtime.

`physical_devices.py` exercita separadamente o editor default off pela criação real de container avulso, verificando mapeamento nativo/Docker exato, modo não privilegiado, leitura de dispositivo char e resultado real de abertura para escrita. Confere negação ao membro revogado e limpeza exata. A fixture /dev/null não certifica isolamento de escrita pelas permissões padrão nativas; upgrades de serviços, sidecars físicos e outros dispositivos/runtimes exigem aceites separados.

`service_sidecar_device_creation.py` exercita a criação contextual real de serviço com mapeamentos diferentes na configuração principal e em um sidecar. Cada container em execução deve ter apenas o próprio caminho mapeado. O teste compara a API e a configuração do Docker com a leitura pelo processo e confere a limpeza em relação ao inventário anterior.

`device_upgrade_acceptance.py` exercita upgrade contextual, reversão, conclusão e remoção explícita em um serviço de teste com escala zero. Confere autorização após revogação e limpeza exata. `physical_device_upgrades.py` usa separadamente uma réplica para verificar o mapeamento nativo, a configuração do Docker e a leitura dos dispositivos nos containers substituídos. Rode esses testes em sequência no sandbox nomeado. Sidecars físicos e comportamento em múltiplos hosts exigem fixtures próprias.

`sidecar_device_upgrade_acceptance.py` verifica o editor estruturado em serviço próprio com escala zero, incluindo flag desligada, campo ausente no schema atualizado do ambiente, retenção do rascunho, upgrade, reversão, conclusão e remoção explícita. Confere a preservação do mapeamento principal, a limpeza e a revogação da sessão.

### Inventário em alto volume

Com o console compilado em localhost:18090 e o Chromium do Playwright disponível, rode este comando na raiz do repositório.

```sh
node console/tests/e2e/high-volume-inventory.cjs
```

Defina `PLAYWRIGHT_MODULES` e `CHROMIUM_EXECUTABLE` se o Playwright ou o Chromium estiverem instalados fora dos caminhos padrão. O benchmark usa três contextos novos de navegador e 20 ambientes sintéticos com 20 stacks, 200 serviços e 2.000 containers em cada um. Confere a paginação da API, busca o último container e percorre todos os ambientes em um contexto. Registra o asset inicial, o tempo de carregamento e troca de ambiente, o tamanho do DOM, tarefas longas e o heap após a coleta de lixo. O navegador fornece as respostas da API sem credenciais nem gravações no Rancher. Use o mesmo navegador, máquina e configuração de build para comparar resultados. A latência do backend e sessões longas exigem testes separados.

Separe unitário/componente, build limpo, renderização browser, comportamento nativo real e CI remoto. Registre identidade do artefato, flags, escopo, controles, resultados medidos e cleanup; publique somente resumos sanitizados. Teste `nofile` em um host não valida todos os limites ou multi-host. Probe curto de WebSocket não prova estabilidade do scheduler/soak. Restore offline de DB não prova recuperação de engine/IdP/workloads. Aceites restantes ficam no [roadmap](roadmap.md).
