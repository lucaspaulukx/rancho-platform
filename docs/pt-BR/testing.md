# Testes

<!-- rancho-language-navigation:start -->
[Português (Brasil)](testing.md) | [English](../en/testing.md)
<!-- rancho-language-navigation:end -->


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

`physical_devices.py` exercita separadamente o editor default off pela criação real de container avulso, verificando mapeamento nativo/Docker exato, modo não privilegiado, leitura de dispositivo char e resultado real de abertura para escrita. Confere negação ao membro revogado e limpeza exata. A fixture /dev/null não certifica isolamento de escrita pelas permissões padrão nativas; upgrades de serviços, sidecars físicos e outros dispositivos/runtimes exigem aceites separados.

`device_upgrade_acceptance.py` exercita upgrade contextual, reversão, conclusão e remoção explícita em um serviço de teste com escala zero. Confere autorização após revogação e limpeza exata. `physical_device_upgrades.py` usa separadamente uma réplica para verificar o mapeamento nativo, a configuração do Docker e a leitura dos dispositivos nos containers substituídos. Rode esses testes em sequência no sandbox nomeado. Sidecars físicos e comportamento em múltiplos hosts exigem fixtures próprias.

Separe unitário/componente, build limpo, renderização browser, comportamento nativo real e CI remoto. Registre identidade do artefato, flags, escopo, controles, resultados medidos e cleanup; publique somente resumos sanitizados. Teste `nofile` em um host não valida todos os limites ou multi-host. Probe curto de WebSocket não prova estabilidade do scheduler/soak. Restore offline de DB não prova recuperação de engine/IdP/workloads. Aceites restantes ficam no [roadmap](roadmap.md).
