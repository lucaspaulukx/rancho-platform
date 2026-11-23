# 86 — Rancho Platform: repositório e fluxo Git

Data: 05/11/2026. Repositório canônico: https://github.com/lucaspaulukx/rancho-platform.

## Importação

O mantenedor autorizou enviar o projeto atual e preservar os commits comunitários existentes. O destino estava vazio e privado na conferência inicial; manter essa visibilidade. A importação não é release nem conclusão do roadmap. O histórico anterior não versionado não será reconstruído como se tivesse commits próprios.

Fontes oficiais são obtidas pelos pins de upstream.json; patches são versionados, clones de consulta não. Arquivos ignorados de credenciais, dumps, backups, fixtures, evidências, dependências e relatórios permanecem locais. A assinatura Rancho identifica a iniciativa independente; marcas e atribuições Rancher continuam preservadas.

## Próximas entregas

1. Atualizar a referência remota antes de iniciar nova entrega e conferir alterações locais; não descartar trabalho existente.
2. Criar branch com escopo claro: feat/, fix/, docs/ ou test/. Implementação, contratos e documentação relacionados ficam juntos.
3. Executar gates relevantes. Aceite de interface não substitui teste nativo; falhas de infraestrutura não são sucesso de segurança. Funcionalidade sem aceite físico permanece desativada.
4. Revisar diff e selecionar caminhos explicitamente. Rodar `python scripts/check_repository.py` depois de staging; executar `python scripts/check_public_history.py` antes do push. Os scanners não imprimem matches e não substituem auditoria completa de secrets/licenças.
5. Commit com mensagem que descreva a mudança. Enviar a branch ao repositório e abrir PR para main com comportamento, testes, limitações e rollback. Não reescrever histórico compartilhado nem fazer merge/force-push/release como consequência automática de um teste passar.

O primeiro envio preserva a sequência local na main, pois o destino estava vazio. Depois da importação, entregas continuam em branches. A autorização atual cobre configurar origin e importar o código; ações futuras seguem o escopo solicitado pelo mantenedor.

## Conferência do envio

Conferir que `git rev-parse HEAD` corresponde à referência remota de main e que os commits esperados estão no GitHub. Não enviar todas as refs, artefatos de laboratório ou backups do diretório .git. Registrar resultado no handoff somente depois da confirmação remota. A existência do código no GitHub não comprova build remoto, deploy ou prontidão produtiva.

Ativar os hooks após clonar: `git config core.hooksPath .githooks`. Pre-commit confere índice/patches locais; pre-push confere histórico alcançável. Hooks não são proteção de branch no GitHub nem auditoria completa.

## Importação confirmada

Primeiro push concluído em05/11/2026: main local e remota apontaram para96f1fc540154fec71221cfb610335e3e61695d29, com24 commits (21 existentes +3 commits preparados para a importação). Origin configurado para o destino canônico; working tree limpo ao conferir. Visibilidade privada preservada. Antes do envio passaram os gates de índice, patches upstream e histórico de24 commits/814 objetos; cinco testes do scanner também aprovados. Nenhum dump, segredo local, dependência instalada, relatório de sessão ou clone de consulta foi enviado.

A próxima entrega usa a branch test/service-metrics-acceptance para registrar o teste físico aprovado do recorte84. Main não recebe merge automático; revisão do PR é independente da importação. Não há alegação de CI remoto, deploy ou release por causa desse push.
