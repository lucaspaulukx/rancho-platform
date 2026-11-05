# Configurações do servidor — plano e limites

- Módulo independente `modules.settings`, inicialmente false. Lista de nomes/origem/override no banco, busca local explicitamente identificada. O SettingManager nativo materializa configurações e ignora o filtro de nome; não prometer paginação/filtragem de servidor inexistentes.
- DTO de listagem elimina value/activeValue e campos desconhecidos antes do cache. Valores são consultados somente ao abrir edição e ficam em estado privado do modal, mascarados por padrão, com revelar explícito. Nenhum segredo real em screenshots/relatórios/storage; respostas de mutações retornam void. Erros de API recebem mensagem sanitizada sem payload.
- Editar value com revisão e confirmação; valor vazio exige aceite adicional. Schema/recurso frescos e comparação de nome, titular do setting, value/activeValue/source/inDb antes de PUT. Guard de identidade/unmount e rascunho. Valores administrados por arquivo/Compose podem prevalecer; activeValue é somente leitura, PUT configura o override nativo.
- Restaurar padrão remove somente override DB via DELETE quando inDb=true e contrato atual permite. Explicar que o valor efetivo pode vir de outra fonte e consultar novamente. Nenhum reset coletivo, remoção de variável ou reinício automático.
- Plano não inclui criar/renomear configurações arbitrárias na UI. O schema name é imutável; preservar nomes e credenciais existentes. Ainda não constitui interface de drivers/HA.
- Gates: domínio/DTO/conflito/vazio/schema, componente/segredo não cacheado/guard/flags, build, navegador real em setting descartável prefixado `console.lab.fixture.*`, salvar/readback/reset e preservação de todas as configurações anteriores por hash (sem gravar valores). Testar acesso não admin e temas/axe/móvel; habilitar só após aceite.

Limitação concorrente: validação fresh antes do write não é CAS atômico no servidor; alterações entre GET e PUT ainda são possíveis. Não prometer atomicidade inexistente no Rancher.

## Implementado e validado — 22/10/2026

`modules.settings=true` após 383 testes/46 arquivos + TypeScript/Vite e 10 checks E2E reais. Oito casos de domínio e seis de página cobrem DTO, valores multiline, nulidade, endpoint, caixa de nome, activeSetting, concorrência/permissão revogada, valor vazio, reset, revisão com valores novamente mascarados, cache/erros/storage e reload. Quatro cenários claro/escuro ×1440/390 sem violações axe/overflow.

Fixture inicial console.lab.fixture.3f42612d93 e repetição console.lab.fixture.cbfb1d3cef, ambas removidas. PUT persistiu value e activeValue multiline; DELETE removeu somente o override DB. Hashes de todas as **697 configurações anteriores** preservados; manifest ausente. Relatórios settings-e2e-results.json/settings-a11y-results.json/settings-cleanup-results.json. Nenhum valor real de configuração gravado nesses artefatos; valores da fixture são sintéticos e identificados como preview-only.

Particularidades conferidas: a leitura retorna type=activeSetting/baseType=setting, e é aceita somente nessa combinação ou setting. Links self nativos podem converter nomes camelCase para minúsculas, que são outra chave: a console valida a referência e constrói o endpoint com o nome original preservado. Teste de leitura real de activate.by.default.externalHandler e variante minúscula confirmou a distinção, sem alteração. O backend retorna 698 itens mesmo com limit=100; busca/paginação são locais e não fingem suporte de filtro nativo. Não há criação de chaves arbitrárias nem reset coletivo na UI.
