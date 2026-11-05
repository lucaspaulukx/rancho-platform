# Modelo de segurança

<!-- rancho-language-navigation:start -->
[Português (Brasil)](security-model.md) | [English](../en/security-model.md)
<!-- rancho-language-navigation:end -->


## Autorização

O backend impõe autorização. Rotas, mutações, targets de streams e capacidades administrativas validam identidade atual, estado da conta, environment e permissão nativa. Flags visuais e menus ocultos não impõem segurança. Grants diretos e de grupos coexistem; use o papel efetivo do servidor, incluindo prioridades configuradas, sem inventar ordenação fixa.

Grupos são armazenados e administrados no Rancher. OIDC identifica a pessoa; claims de grupos Keycloak não concedem acesso implicitamente. Vínculos de identidade usam issuer/subject, não inferência por email/nome. Novos usuários ficam sem acesso nem environment automático sob a política habilitada. Administração global exige provisionamento explícito e recuperação testada.

## Sessões e capacidades

Sessões HTTP, sockets de subscription e capacidades de logs/exec/métricas têm validações distintas. Guardas opcionais ligam streams compatíveis a identidade/conta/papel/escopo atuais e fecham após revogação ou expiração. Fechamento por permissão não deve iniciar reconexão automática.

API keys pessoais acompanham permissões atuais da conta; chaves compartilhadas pertencem ao environment e independem dos grupos humanos do criador. Provas de stream validam a credencial nativa efetivamente autenticada, não um header Authorization arbitrário ou cookie antigo. Prazo máximo do socket não é expiração nativa da API key. Credenciais internas de agentes continuam em modo técnico separado; subscriptions técnicas e compatibilidade/carga/HA completas seguem como gates.

Descritores grandes de métricas modernas podem usar payload negociado no primeiro frame. Preserve escopo assinado, callback privado, limites de payload/targets e correspondência de capacidades. O cliente clássico intacto não negocia esse transporte; URLs agregadas grandes pelo proxy moderno ainda têm gate de compatibilidade. Aceite do navegador moderno não prova paridade clássica.

## Informação sensível

Não exponha credenciais, estado do realm, erros API brutos, tokens ou descritores de stream em logs públicos, storage persistente, screenshots, PRs ou artefatos versionados. Evidências usam checks/contagens/campos numéricos selecionados. Mensagens de exceção podem conter URLs privadas; sanitize em vez de imprimi-las integralmente.

Redação de credenciais de auditoria cobre gravações novas e projeções de registros antigos enquanto ligada. Não reescreve banco antigo ou backups. Desligar a redação ou voltar para software anterior pode expor capacidades armazenadas. Planeje retenção/saneamento separadamente; não reescreva histórico destrutivamente como teste rotineiro.

## OIDC e recuperação

Use callbacks públicos exatos e backchannel privado, validação issuer/audience/JWKS, state/nonce e PKCE. Segredos ficam fora do Git. Preserve realm e credenciais existentes no startup; rotação é manutenção explícita, não etapa de regressão. Logout federado e disponibilidade do IdP exigem checks próprios de falha/retorno.

Não inicie engine restaurado com rotas para agentes, webhooks ou provedores originais. Banco, estado criptográfico Rancher, IdP e imagem/configuração correspondentes são necessários à recuperação. Dois engines nunca devem controlar a mesma base. Veja [migração](migration.md), [recuperação](recovery.md) e [segurança](security.md).

## Fronteira de release

O runtime é legado, sem certificação produtiva. Aceites finais de rotas/ações/escopos, CSRF, secrets/cache, dependências, auditoria, streams, recuperação e compatibilidade permanecem explícitos no [roadmap](roadmap.md). Configure contato privado antes de abrir o projeto; não inclua dados de clientes em issues/PRs.
