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

## Links e evidências

Use links relativos válidos, nomes exatos de comandos/APIs e limites claros de evidência. Erros brutos, credenciais, dumps, relatórios locais e dados de clientes ficam fora do Git. Referencie entrypoints de teste mantidos, sem colar o log de execução de um operador. Leitor de tela manual, efeitos nativos e recuperação não são substituídos por verificador documental.

Atualize o [roadmap](roadmap.md) ao mudar capacidade ou aceite. Par documental completo não torna o produto pronto para produção. Publicação permanece decisão separada do mantenedor conforme o [guia de release](release.md).
