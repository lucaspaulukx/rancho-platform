# 53 — Configuração versionada da console

Plano CFG02: introduzir schemaVersion 1 no arquivo público. Arquivos históricos sem versão migram somente em memória; flags ausentes recebem false, preservando escolhas explícitas e evitando ativar funções novas implicitamente. Arquivo versionado exige todas as flags conhecidas e rejeita versões futuras, tipos inválidos e erros de digitação. Tema, URLs e controles existentes continuam validados. Não regravar arquivo público durante carregamento, não alterar banco nem permissões.

Backup/rollback: conservar cópia byte a byte do JSON anterior fora da pasta pública, com SHA256, antes de promover a configuração. Para voltar ao frontend anterior, restaurar o JSON e a imagem correspondentes. A migração em memória mantém o arquivo legado intacto; não promete compatibilidade de versão futura com imagem antiga. O build atual deve aceitar a cópia legada e a versão1, rejeitar configuração incompleta versionada e preservar valores explícitos off. Testar carregamento no navegador com configurações interceptadas em contexto isolado, sem editar o JSON compartilhado nem sessão do usuário.

Aceite do recorte:575 testes em66 arquivos + TypeScript/Vite;8 testes novos cobrem migração idempotente, off explícito, origem sem mutação, tipos/versões e flags incorretas. Sete checks reais no navegador cobrem legado→versão1→retorno ao legado, módulo ausente desativado, configuração futura/incompleta recusada antes da autenticação e JSON público intacto. Relatórios config-migration-e2e-results.json e config-migration-cli-results.json.

Ferramenta reutilizável scripts/migrate-config.mjs usa o próprio validateConfig da aplicação via Vite em middlewareMode (sem servidor HTTP); não duplica contrato. Após npm ci, executar da pasta console:

```powershell
npm run config:migrate -- --check caminho/origem.json
npm run config:migrate -- --write caminho/origem.json caminho/destino-novo.json
```

Dry-run exibe versão, flags ausentes desligadas e SHA256; não exibe valores de configuração. Gravação cria exclusivamente arquivo novo, sem sobrescrever origem/destino existente. Aceita BOM UTF8 histórico do PowerShell. Nove checks CLI passaram com arquivos temporários: checksum, defaults, BOM preservado, validação da saída pelo mesmo contrato, recusa de sobrescrita, versão futura sem saída, rollback para origem e arquivo compartilhado intacto. Arquivos temporários removidos pelo harness. O operador promove o resultado após conferir diff e conservar original+imagem; a ferramenta não promove nem altera JSON compartilhado automaticamente.

Versionamento: versão1 é estrita. Ao acrescentar requisito obrigatório ao contrato, incrementar a versão e fornecer migração explícita da anterior; não simplesmente adicionar flag obrigatória a version1. Campos booleanos ausentes somente no formato legado recebem false; campos presentes inválidos falham. Arquivo futuro não é silenciosamente interpretado por código antigo. CFG01 (matriz completa de dependências) e REL01 (migração de banco) permanecem separados.
