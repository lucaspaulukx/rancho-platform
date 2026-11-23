# 82 — Credenciais em registros de auditoria

Plano antes de implementar. A leitura de AuditServiceImpl do upstream pinado mostra remoção apenas de campos sensíveis no primeiro nível. Ações POST de host podem retornar credenciais de WebSocket; é necessário conferir o registro real, sem imprimir/persistir os valores. GET não é auditado por esse handler. Isso é hipótese de exposição, ainda sem prova física.

## Tasks e gates

1. Conferir somente eventos das fixtures próprias de streams: tipo/ação/status, presença de campos e igualdade em memória, nunca conteúdo. Distinguir vazamento persistido de mera capacidade em resposta legítima; não alegar acesso readonly sem testá-lo. Revogar sessões próprias.
2. Redação compartilhada e recursiva antes da persistência para tokens, chaves, cookies, autorização, senhas e credenciais de configuração, incluindo listas/objetos aninhados e URLs com queries sensíveis. Preservar metadados úteis e não mutar objeto/resposta original. Não ampliar acesso à coleção nem desabilitar auditoria. Guardar casos de colisão e limites.
3. Flag independente com rollback explícito; contratos Java usando a serialização real e mapas/objetos aninhados, sem segredos nos outputs. Compilar overlay/patch reproduzível, testar no mesmo artefato on/off e registrar riscos dos registros legados já existentes. Não apagar silenciosamente histórico; saneamento anterior exige ferramenta/backup/escopo separado.
4. Teste real com conta/grupo/container próprios: admin continua recebendo capacidade válida, auditoria conserva quem/ação/status mas não segredo, readonly continua isolado; cleanup e preservação dos recursos anteriores. Regressão apropriada, docs e commit local.

Este recorte não conclui REL05/OBS02: revisão de toda a exposição legada, retenção, contas técnicas e carga permanece no roadmap48.

## Baseline confirmado e expansão do gate

No primeiro artefato82 com flag off, conta readonly própria recebeu200 nos eventos de logs/execute do environment da fixture e leu os tokens emitidos para admin. Coleção global retornou404 e a ação execute não estava disponível ao readonly; isso não impediu a exposição pela auditoria. Banco e resposta da API continham o mesmo token, comparado somente em memória; nenhum token está no relatório. Não foi executado comando privilegiado pelo readonly neste ensaio. Streams admin legítimos e sua revogação passaram; conta/grupo/sessões/workload próprios foram limpos.

Gate ampliado: mesma flag protege projeção de requestObject/responseObject e campo genérico data em toda resposta auditLog, inclusive registros anteriores, sem reescrever o banco. JSON legado tem limite1MiB/profundidade32 e falha fechada. Testar a leitura de IDs off anteriores com flag on, verificando que o banco ainda contém o registro e a API não o revela. Backup antigo continua sensível e desligar a flag reexpõe o conteúdo original; não prometer saneamento retroativo em disco.

## Aceite no mesmo artefato — 05/11/2026

Artefato1325d5e6a006c17e59eeee0a0c39f47ec8c9de3ce1bd22c2088f1f32dd297e34: comparação final off reproduziu exposição e reutilização real da capacidade de terminal por conta readonly, apesar da ausência da ação execute. A reutilização enviou somente o marcador da fixture ao seu shell de eco. Raw status failed e legacyCredentialExposureReproduced=true preservam a classificação de vulnerabilidade, mesmo quando o wrapper aceita a baseline esperada.

No mesmo artefato com flag on: respostas legítimas admin ainda abriram logs/exec/métricas; banco dos2 eventos novos não contém o token emitido. Readonly recebeu200 na auditoria do próprio environment, sem token; global404 e ação execute ausente. Dois eventos anteriores off continuaram intactos no banco e tiveram projeção redigida tanto para admin quanto readonly, com no-store. Revogação posterior fechou3 sockets1008, zero dados posteriores, novosWS401 e controles saudáveis. Contas/grupos/sessões/workload próprios limpos; mudanças autônomas do scheduler/volumes de sistema registradas separadamente.

Java155 configuração/129 redação (repetida nos modos off/on/customização off) aprovados. Primeira tentativa do teste usou mapper incompatível no harness, corrigido para gdapi.JacksonMapper real. Outra tentativa de reuso rejeitou marcador do próprio probe; corrigido passando o marcador original, relatório falho preservado. Houve atraso de alocação e3 pong timeouts observados no scheduler; não atribuir falha do marcador à infraestrutura. Linux628/72+TypeScript/Vite e backend limpo do índice+patches aprovados.

Após aceite, compose moderno habilita RANCHER_AUDIT_CREDENTIAL_REDACTION_ENABLED por default substituível false; base/Java continuam false. Sobre tem rótulo comum da capacidade; nenhuma tela nova nem regra só visual. Evidências locais ignoradas: console/audit-credentials-{on,off}-results.json, audit-credentials-probe-marker-failure-results.json e migration-runs/audit-redaction-{backend,clean,console}-build.log.

## Limites e rollback

A política trata campos estruturados conhecidos, configurações opacas, headers/env/Compose/comandos/certificados, JWTs/PEM reconhecíveis e URLs com userinfo/query/fragmento. Valores ocultados ficam [REDACTED]; metadados de ator/ação/status e nomes não sensíveis permanecem. Profundidade32,20 mil nós e texto64KiB limitam a cópia; JSON legado tem1MiB e pré-validação de profundidade. Falha de serialização deixa marcador genérico sem mensagem de exceção que possa citar dados privados. Isso não identifica todo segredo arbitrário digitado em descrição/nome/texto livre. Auditoria não é cofre e controles de escrita/retenção continuam necessários.

Registros/backups/logs antigos não são reescritos nem eliminados. O filtro protege a API enquanto on; rollback para artefato anterior ou flag off pode reexpor valores históricos. Antes de distribuir/migrar uma base existente, revisar retenção e planejar saneamento com backup protegido e escopo explícito. Nenhum saneamento destrutivo foi executado. Contas técnicas/API keys, exposição por outros canais, carga/HA e aceite final REL05 continuam abertos.
