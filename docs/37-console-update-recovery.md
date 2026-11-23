# 37 — Abas abertas durante atualização da console

## Plano antes do código

Erro real reportado: Failed to fetch dynamically imported module Groups-<hash>.js em Administração e Integrações. Ctrl+F5 recuperou a navegação. Um HTML/entrypoint já aberto referencia chunks com hash do build anterior, que deixam de existir ao substituir o container. Cache immutable de arquivos com hash é correto; o problema é retirar esses arquivos enquanto ainda existem clientes usando o build anterior.

Preservar assets de builds anteriores em volume próprio, copiando somente arquivos estáticos no startup da console; HTML/configuração continuam atuais e sem cache persistente. CONSOLE_ASSET_RETENTION=true no Compose; false serve apenas assets do build atual sem apagar o volume. Não manter imagens Docker inteiras nem fazer prune. Não executar código externo ou misturar assets do frontend Ember. Crescimento do volume deve ser acompanhado; limpeza é operação separada e encerra compatibilidade de abas muito antigas.

Adicionar boundary compartilhado ao conteúdo das páginas, mantendo shell/navbar/sidebar e oferecendo recarga explícita em falhas de módulo/rede. Nada de recarga automática que possa descartar formulário ou repetir mutação. Fallback raiz do router remove a tela técnica/stacktrace. Ao mudar de rota, o boundary da página é reiniciado. Mensagens são sanitizadas, sem error.message arbitrário.

Validação: build/TS e testes relevantes; navegador real com import deliberadamente bloqueado em Grupos/Integrações, shell preservado, recuperação explícita com URL/environment mantidos e sem loop. Navegar por todas as rotas administrativas e de integração habilitadas. Capturar entrypoint/chunk de build anterior, atualizar console e provar HTTP200 para assets anteriores e atuais, index atual, assets inexistentes404 sem fallback HTML. Conferir flag off em container temporário separado sem backend e sem limpar volume. Nunca afirmar correção retroativa para builds já descartados antes desta retenção.

## Resultado

Implementado e servido na porta18090. Build505 testes/58 arquivos + TypeScript/Vite, incluindo quatro testes novos de reconhecimento de falha, privacidade, recuperação por chave de rota e fallback do router. Formatação aprovada.

26 checks browser aprovados em contexto próprio: falha forçada de Groups e ApiKeys, shell preservado, navegação independente, axe nas duas recuperações, recarga explícita com URL/environment preservados; dez páginas administrativas/de integração com navegação pelo sidebar; zero pageerrors não tratados. Navegador também executou o entrypoint real anterior e carregou Grupos/Chaves depois do deploy, com seus chunks antigos retidos. Não são testes de CRUD completo dessas dez páginas.

HTTP200 para entrypoint e dois módulos anteriores, entrypoint atual diferente e200, arquivo inexistente404. Flag false testada em container temporário sem rede: aplicação atual acessível, chunk anterior não servido, volume preservado; container removido no finally. Relatórios update-assets-results.json e update-recovery-e2e-results.json. Nenhuma escrita de negócio, nenhuma alteração de Ember/backend nesta etapa.

Primeiros harnesses foram corrigidos: Users compartilha dependência de Groups e não é página independente quando esse chunk é deliberadamente bloqueado; usar Auditoria para esse caso. Links de páginas globais omitem env por projeto, portanto a prova de recarga retorna à URL exata antes da falha. Título real de HA usado no teste. Falhas de expectativa do harness não foram contadas como aceite.

O volume foi inicializado antes da primeira troca com os arquivos servidos pelo container anterior. Em novas instalações o Compose cria console-assets; em atualizações o startup copia os assets atuais sem remover os anteriores. Retenção cobre somente /console/assets (bundles com hash), não configurações, bancos ou segredos. HTML continua revalidado. O flag false não apaga o volume. Compatibilidade de API entre builds muito antigos continua um limite distinto; retenção não equivale a suportar versões antigas indefinidamente.
