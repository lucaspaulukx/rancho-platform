# 87 — Limites de processo na criação contextual

Plano de05/11/2026, antes da implementação. Recorte OPS11; não encerra dispositivos/securityOpt/OOM nem upgrade físico.

## Contrato e experiência

Schema nativo conferido: container/launchConfig/secondaryLaunchConfig expõem ulimits como array[ulimit], create=true/update=false. O tipo ulimit tem name:string e soft/hard:int criáveis; a classe Java Ulimit usa Integer. Portanto, limites inteiros de -1 a2147483647, sem expoentes/frações; soft não pode exceder hard, considerando -1 ilimitado. Não prometer edição PUT de container existente. Docker documenta os limites soft/hard em https://docs.docker.com/reference/cli/docker/container/run/#set-ulimits-in-container---ulimit.

Nova flag aditiva modules.workloadUlimitEditors=false quando ausente. Na criação de serviço/container e sidecars, seção Recursos terá linhas nome/limite inicial/limite máximo, adicionar/remover e texto sobre unidades por recurso e herança quando não configurado. Componentes Field/Button e tokens comuns; nenhuma preferência host/global é alterada. Não inventar valores ao abrir o editor. JSON legado permanece quando a flag está off ou o contrato é incompatível.

Primeiro editor aceita nomes Linux explicitamente suportados no recorte; desconhecidos permanecem visíveis e exigem correção ou uso do formulário nativo. Arrays malformados não são convertidos em vazio. Limite32 linhas, nomes únicos, sem propriedades descartadas silenciosamente. Exigir soft/hard explícitos para cada nova linha; nomes/valores atuais preservados durante edição. Sem liberação automática da flag pública.

## Tasks e gates

1. Modelo/contrato atual, intervalos, ilimitado, duplicatas, formato legado e validação recursiva com schema revogado.
2. Editor compartilhado acessível em container/launchConfig/sidecar; flag independente com fallback, revisão nativa e revalidação antes do POST.
3. Testes de componente e payload, dependências/default off, Linux frontend + TypeScript/Vite.
4. Fixture própria com criação pelo formulário, persistência nativa, valor físico no Docker e processo, negação fora do environment e cleanup. Não usar controle de API como substituto do teste de UI. Até esse gate, manter flag off e estado parcial.
5. Documentar resultados/limites, commit e PR na branch da entrega. Upgrade/reset/rollback serão recorte separado, mantendo os campos atuais quando apenas imagem/CPU/memória mudarem.

## Implementação e validação intermediária

Criado editor compartilhado em SchemaForm, propagado a launchConfig e SidecarsEditor. ResourceCreator revalida o schema atual e os valores antes do POST. A flag workloadUlimitEditors é aditiva e ausente=false; não depende de habilitar as demais edições de segurança. Limites inválidos, nomes repetidos/desconhecidos e propriedades incompatíveis não são descartados silenciosamente.

Oito testes específicos cobrem domínio, contrato revogado, recursão, dados legados, edição de linhas, payload numérico, integração primária/sidecar e flag. Bateria Linux atual:647 testes/74 arquivos, TypeScript/Vite aprovados. Artefato do novo frontend testado localmente; backend/Ember sem mudança.

Primeiras tentativas de browser corrigiram nomes nativos dos controles e a distinção entre input/select informada pelo schema. Criação real persistiu limites, mas uma tentativa sem relay excedeu120s de alocação. Recuperação exigiu stop antes de remove; confirmou configurações/containers/volumes anteriores preservados. Falha permanece registrada. Com relay temporário85, criação/persistência passaram, mas a projeção do inspect como JSON foi filtrada pelo canal privado; o harness passou a emitir somente contagens e inteiros permitidos, sem ampliar o filtro de segurança. Esse ensaio também limpou integralmente a fixture e não conta como aceite dos limites físicos. Repetição final em andamento, sem aumentar budget90s de alocação com relay.
