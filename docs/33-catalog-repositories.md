# 33 — Administração de repositórios de catálogo

## Plano anterior ao código

O schema estático de v1-catalog/catalog anuncia somente leitura. Para fontes globais a UI clássica grava o JSON de settings/catalog.url. A sondagem posterior do documento36 confirmou CRUD nativo para fontes por environment; não usar esse endpoint para substituir a configuração global. Este recorte trata dos repositórios globais, sem alterar configuração específica de environments.

Tela administrativa compartilhada /catalog-repositories, flag catalogRepositories independente de catalog. Listagem com nomes/branches configurados e indicação da fonte nativa; URLs somente no editor privado, mascaradas. Edição estruturada em um modal: adicionar, alterar branch/URL, remover uma entrada e revisar o conjunto. Preservar campos desconhecidos do documento e das entradas, rejeitar nomes duplicados/chaves perigosas. Valor original não vai para cache/storage/logs. Formatos legados ou inválidos não são convertidos silenciosamente; podem ser inspecionados na configuração nativa do servidor.

Cada envio relê schema setting e snapshot catalog.url, usa o mesmo contrato seguro de configurações e protege navegação/recarga/fechamento. Sem repetir escrita e sem modificar namespaces ou grants. Efeito global explicitado na revisão. Gravação de configuração e clone de repositório são estados distintos: não prometer sincronização por aceitar o PUT. Atualização remota de templates será fluxo separado, pois pode acessar redes externas.

Validação: domínio para preservação/duplicatas/URL/snapshot; componentes e build; navegador com repo de nome aleatório e URL localhost fechada, adicionar/editar/remover, restauração exata da configuração/fonte anterior no finally, rejeição nativa para usuário comum, claro/escuro × desktop/móvel. Não invocar template ou provisionar máquina. Não remover repositórios preexistentes nos testes.

## Implementado e validado — 23/10/2026

Flag catalogRepositories=true. Build geral 476 testes/54 arquivos + TypeScript/Vite, incluindo 20 casos de domínio e cinco de página do recorte. Configuração global listada sem URLs no cache, editor privado com linhas estáveis e URLs mascaradas, adicionar/editar/remover e revisão global. Documentos/entradas desconhecidos preservados; URLs existentes não suportadas podem ser mantidas sem conversão, URLs novas são validadas. Branch ausente continua ausente se não alterada. Remover todas as fontes globais exige aceite próprio. Formatos legados não são sobrescritos por uma conversão implícita.

18 checks E2E reais e oito cenários axe/layout, claro/escuro ×1440/390 sem violações/overflow. Adicionar/editar/remover somente a entrada aleatória localhost porta fechada, descarte sem escrita, preservação do documento restante, flag e acesso admin. O finally removeu apenas o override de teste e conferiu value/activeValue/source/inDb exatamente iguais ao início. Manifest catalog-repositories-fixture.json ausente. O fixture catalog-fixture.json preexistente pertence a outro aceite e foi preservado. Relatórios catalog-repositories-e2e-results.json/catalog-repositories-a11y-results.json.

Native GET de catalog.url é permitido ao usuário comum (200), como necessário ao catálogo legado; PUT negado com CSRF e payload válidos. A UI administrativa exige admin. Mascarar URLs não é mudança de autorização do endpoint nativo. Duas primeiras execuções assumiram incorretamente GET negado, falharam nesse check e restauraram o override no finally; a repetição corrigiu a expectativa conforme o contrato e passou.

Este aceite valida configuração persistida. Clone/commit de repositório físico, atualização remota e catálogos por environment continuam separados; nenhum template foi lançado, nenhum refresh remoto foi solicitado e nenhuma máquina criada.


### Repetição da matriz visual

Revisão de screenshots identificou que alternar tema com o modal aberto não alcançava o controle do shell. O harness passou a selecionar o tema antes de reabrir cada formulário e conferir data-theme efetivo; as oito combinações foram repetidas com sucesso, e os relatórios atuais incluem appliedTheme igual ao tema solicitado. Repositórios reutilizam nested-fields para separar entradas sem estilos paralelos.
