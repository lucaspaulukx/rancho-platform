# 78 — Plano/diff de acessos diretos para grupos locais

Plano RBAC03, antes de implementar: separar diagnóstico, coexistência e cutover. Nunca inferir identidade por email/nome nem importar grupos gerenciados pelo Keycloak. Contas/perfis globais e identidades externas dinâmicas conservam suas regras; casos não resolvidos entram em revisão explícita.

Primeiro recorte somente leitura: snapshot consistente MySQL5.5 de contas/membros/grupos, propostas determinísticas de grupos para usuários com vetores **idênticos** de environment→papel. Não criar produto cartesiano entre ambientes de usuários diferentes. Papéis conflitantes/identidade desconhecida/inativa/ausente não podem produzir concessões automáticas. Não escolher hierarquia de roles por suposição: prioridades são configuráveis no Rancher. Preservar vínculos diretos e grupos existentes.

Plano privado criptografado e resumo sem identidades; hash vincula baseline, mudanças esperadas, exclusões e modo. Sem apply da origem neste recorte. Antes de coexistência/cutover: backup completo76, revalidar drift, backend/RBAC/flags, escopo e atores. Escrita por APIs nativas e auditoria; sem DELETE/UPDATE direto em project_member. Rollback nunca remove grupo modificado posteriormente nem substitui lista de membros concorrente.

Testes: isolamento de vetores, duplicatas/conflitos, estados/removidos, IDs canônicos, providers desconhecidos, colisão de nomes, determinismo e ausência de ampliação. Depois, em cópia original20: aplicar grupos, comparar acesso efetivo20×usuários antes/depois, retirar diretos por ação nativa e provar apenas grupos, negação readonly e rollback por baseline correspondente. Esses passos ainda não estão aceitos pelo plano somente leitura.

## Recorte somente leitura aceito — 05/11/2026

```sh
python -m migration.grants --source-container NOME_DO_RANCHER --output migration-runs/grants-plan-001
```

Senha sem eco, mínimo20 caracteres, ou variável privada `RANCHER_MIGRATION_BACKUP_PASSWORD`; `--defaults-file` aceita arquivo de cliente MySQL já existente dentro do container. Exige diretório novo. Não aceita URL remota, apply, remoção ou cutover. Requer tabelas envolvidas InnoDB; coleta contas, membros e grupos na mesma conexão/transaction REPEATABLE READ com consistent snapshot. Não lê senhas/certificados. IDs, identidades externas e configuração dos grupos são privados e ficam exclusivamente em `groups-plan.enc` autenticado. `summary.json`/stdout têm contagens e motivos de preservação, sem linhas de identidade. Esse plano não substitui o backup de recuperação76.

`mode=coexist`, `directGrantsUnchanged=true`, `cutoverAccepted=false`. Vetores iguais compartilham grupo; vetores diferentes/papéis diferentes nunca são unidos. Nome gerado por hash do vetor, sem marca organizacional ou nome de usuário. Duplicatas do mesmo papel são deduplicadas na proposta, mantendo referência a todos os registros nativos. Conflito de papéis por usuário/environment exige revisão; não escolhe prioridade fixa. Provider externo, ID não canônico (`001`), conta global/inativa/ausente, environment inativo/ausente e papel desconhecido permanecem nativos. Colisão com grupo existente exige revisão e nunca o substitui.

13 testes passam, incluindo propriedade de igualdade das tuplas de permissão em grafo50 usuários×20 environments. CLI real leu a origem do laboratório, criptografou/descriptografou o plano e confirmou contas/associações diretas/grupos intactos; encontrou0 propostas porque os7 vínculos diretos ativos eram de administrador global, corretamente preservados. Não chamar plano vazio de conversão concluída.

Ensaio adicional `python -m migration.test_grants_original_db_lab`: origem só fornece dump criptografado; restaura em banco próprio offline, cria20 environments e3 usuários sintéticos com5 vínculos ativos. Proposta real de2 grupos preserva exatamente as5 tuplas; snapshot anterior/posterior ao planner é igual. Repetido nas3 restaurações, com schema aditivo, idempotência e rollback do banco aprovados; cleanup completo. Usuários da fixture não têm senha e nenhum engine é iniciado nesse ensaio.

**Limite importante do Cattle original:** ação nativa setmembers exige ao menos um owner na lista de membros diretos. Logo, um cutover futuro não pode remover o último owner direto só porque existe owner por grupo. O guia precisa conservar owner de recuperação e validar essa condição por environment; nenhuma escrita de cutover existe neste recorte. Ainda faltam grupos criados por API, matriz efetiva60 (3×20), retirada nativa dos diretos com owner preservado, negação readonly, revogação de grupo e rollback com proteção de drift.
