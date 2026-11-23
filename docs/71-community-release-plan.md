# 71 — Distribuição comunitária e migração assistida

Data: 04/11/2026. Esta etapa passa a preceder os gates restantes do roadmap48.

## Entregas e commits

1. Base pública sanitizada: fontes próprias, testes, documentação e patches reproduzíveis contra commits oficiais fixos. Excluir credenciais, dumps, evidências locais, dependências instaladas e clones de consulta. Não reconstruir commits históricos que nunca existiram.
2. Identidade comunitária: somente marca Rancher, azul e superfícies neutras, sem material visual externo. Preservar temas, overrides, densidade, shell compartilhado e flags. `branding` controla a assinatura comunitária opcional; não altera autorização nem remove a marca Rancher.
3. Distribuição: bootstrap verificável das fontes oficiais, aplicação idempotente dos patches, licenças preservadas e instruções de contribuição/segurança. Cada alteração posterior deve ter commit revisável após validação.
4. Migração: diagnóstico somente leitura, backup consistente, ensaio offline em volumes próprios, comparação de inventário, migrações versionadas, validação de login/grants e rollback. Nenhum script pode iniciar uma cópia do engine com acesso aos hosts da origem.
5. Retomar OBS02, AUTH04 e os demais gates48. A preparação comunitária não declara os gates funcionais concluídos.

## Guia de migração obrigatório

- Identificar versão exata da origem, topologia MySQL interno/externo, armazenamento e estado criptográfico do Rancher, configuração do IdP e dependências.
- Diagnóstico: integridade das tabelas, engines, espaço disponível, schema esperado e inventário de environments/contas/membros/stacks/serviços/hosts. Relatórios públicos contêm apenas contagens, hashes e resultados; dumps são privados.
- Backup: MySQL consistente, estado do Rancher, configuração e IdP; registrar imagem/digest, horários, checksums, criptografia e requisitos de restauração. Backup do banco sozinho não é recuperação completa.
- Ensaio: restaurar sem rede em recursos novos, conferir checksums e inventário, aplicar migração e repetir; bloquear continuidade em incompatibilidade ou divergência. Não registrar agentes reais ou enviar eventos externos.
- Política de acesso: associações individuais existentes permanecem até plano explícito de conversão para grupos; novos usuários sem acesso. Apresentar diff/dry-run e recuperação administrativa antes de OIDC exclusivo.
- Cutover: janela de manutenção, impedir dois engines sobre a mesma base, backup final, atualização e smoke de autenticação/autorização/operação; estabelecer gatilhos e prazo para rollback.
- Evidência: logs estruturados sem SQL, senhas, tokens ou nomes privados; passos com status e versão do executável. Um ensaio aprovado reduz risco, não garante ausência de falhas futuras.

## Critérios de aceite

Build/testes de frontend; inspeção visual desktop/mobile; ausência de material de referência privado nos arquivos versionados e commits; bootstrap e patches conferidos; preflight que não modifica origem; restauração e rollback em laboratório; documentação que distingue ensaio de liberação para produção. Publicação remota será uma etapa posterior.
