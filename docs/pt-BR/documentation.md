# Manutenção da documentação

<!-- rancho-language-navigation:start -->
[Português (Brasil)](documentation.md) | [English](../en/documentation.md)
<!-- rancho-language-navigation:end -->


## O que pertence ao repositório

Mantenha informação útil a usuários e contribuidores futuros: arquitetura, configuração, contratos de UI, testes, segurança, migração/recuperação, contribuição e aceites de produto pendentes. Não mantenha handoffs de chat, diários datados, IDs privados de fixtures, progresso de máquina ou narrativas duplicadas na documentação ativa. Versões já commitadas continuam no Git; não reescreva histórico compartilhado para reorganizar docs.

Aplicação fica em `console/`, backend em patches pinados, harnesses em `tests/`, `console/tests/` e `migration/`, ferramentas em `scripts/`. Compose/bootstrap da raiz são entrypoints mantidos, não sobras históricas. Backups/evidências locais ignorados e checkouts gerados não integram a distribuição; limpar documentação não autoriza excluir esses recursos.

## Idiomas e navegação

Guias ficam em `docs/pt-BR/` e `docs/en/` com nomes correspondentes. Convenções GitHub da raiz, README/CONTRIBUTING/SECURITY e README da console permanecem canônicos em inglês, com equivalentes completos em português. Instruções e templates bilingues são compartilhados deliberadamente. Índice e portais permitem escolher idioma por documento.

`docs/translations.json` registra fonte canônica, idioma, caminhos e hashes revisados. Hash é declaração do contribuidor com checks mecânicos de atualidade, não certificação automática da tradução. Traduza o documento ativo completo, preservando seções, identificadores, comandos, evidências e limites. Não use resumo ou português sob cabeçalho inglês.

## Alterar ou adicionar guia

Atualize os dois idiomas quando mudar comportamento. Cadastre pares novos explicitamente no manifesto, com fonte e dois caminhos; não classifique documento sem tradução como bilingue compartilhado. Mantenha temas focados e links para o contrato fonte, evitando repetir detalhes mutáveis em muitos guias.

```sh
python scripts/docs_languages.py --navigation
python scripts/docs_languages.py --review docs/pt-BR/architecture.md --catalogs
python scripts/docs_languages.py --require-complete
python -m unittest discover -s tests -p test_docs_languages.py
```

Substitua a fonte pelos caminhos canônicos afetados; `--review` aceita vários documentos. Revise o texto antes dos hashes. Navegação altera só o bloco próprio e preserva bytes do corpo/código e seletores manuais válidos. Catálogos não oferecem links de tradução ausente. O gate estrito rejeita traduções ausentes/desatualizadas, comandos/cabeçalhos alterados, links locais quebrados, caminhos inválidos e Markdown não registrado.

## Revisão das traduções da interface

`npm run check:ui-literals` verifica textos em JSX, propriedades selecionadas de interface e chamadas diretas de feedback em busca de strings fora dos catálogos. Marcas, protocolos e unidades técnicas têm exceções específicas. O CI de fontes e o build da imagem executam a checagem. Revise separadamente os textos gerados por funções auxiliares, pelo backend e por provedores externos.

Os catálogos de prévia em `console/src/i18n/catalogs/` acompanham o texto original em inglês por domínio de mensagens em `console/src/i18n/preview-sources.json`. Execute `npm run check:locales` dentro de `console/`. Alterar o texto ou os parâmetros de um domínio traduzido exige revisar cada idioma afetado. O gate também roda no CI e no build da imagem.

Após revisar e atualizar um idioma, registre a fonte atual com `node scripts/check-locales.mjs --record-preview-source fr-FR`, substituindo o locale conforme necessário. Versione o catálogo e o manifesto de fontes juntos. Esse registro reconhece a versão da fonte usada pelo catálogo. Revisão linguística e cobertura completa da interface continuam como requisitos de aceite separados. Registrar outro locale atualiza somente os hashes daquele idioma.

## Links e evidências

Use links relativos válidos, nomes exatos de comandos/APIs e limites claros de evidência. Erros brutos, credenciais, dumps, relatórios locais e dados de clientes ficam fora do Git. Referencie entrypoints de teste mantidos, sem colar o log de execução de um operador. Leitor de tela manual, efeitos nativos e recuperação não são substituídos por verificador documental.

Atualize o [roadmap](roadmap.md) ao mudar capacidade ou aceite. Par documental completo não torna o produto pronto para produção. Publicação permanece decisão separada do mantenedor conforme o [guia de release](release.md).

## Capture as telas na aplicação

1. Inicie a revisão documentada com dados descartáveis de teste. Abra a rota real, escolha o idioma do documento e entre com o papel exigido pelo exemplo.
2. Reproduza os passos do guia e capture o resultado no navegador. Use nomes sintéticos e confira se a imagem e as URLs visíveis contêm credenciais, nomes de hosts internos, e-mails ou dados de clientes.
3. Adicione texto alternativo conciso e uma legenda que explique o que o leitor deve ver. Revise cada imagem publicada no tamanho de exibição e confira se o idioma acompanha o restante do documento.
4. Guarde os relatórios completos em um espaço privado para evidências. Coloque no guia a captura sanitizada e o contexto necessário para interpretá-la.

Por exemplo, a captura do console mostra a área de Stacks em português, com navegação, seletor de ambiente e inventário de stacks à vista. A página de evidências da migração identifica nas legendas os dados de teste restaurados e o alcance da comparação visual. [Captura do console em português](../images/console-pt-br.png) · [Capturas da migração](migration-evidence.md)
