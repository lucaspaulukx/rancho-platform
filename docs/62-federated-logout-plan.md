# 62 — Plano de logout federado opcional

AUTH04b aceito no recorte RP-Initiated Logout com Keycloak26.0.8. Flag backend independente OIDC_FEDERATED_LOGOUT_ENABLED implementada, padrão off e dependente de OIDC/customização efetivos. Frontend anterior/backend anterior conservam logout existente. Mostrar capacidade com nome legível em Sobre. Não mudar Ember nem introduzir permissões/grupos no IdP.

## Contrato e fluxo

POST /oidc/logout deve preparar destino somente para sessão OIDC válida; validar Origin contra origem pública configurada e double-submit CSRF do Rancher. Resolver cookie token como chave opaca via AuthTokenDao, validando registro/provider/expiração e JWE armazenado antes de ler loginMethod. O campo público Token.jwt atualmente retorna a chave opaca, não o JWE; não tentar descriptografar diretamente o cookie nem transportar tokens em query. Login local/flag off conservam saída local.

Obter end_session_endpoint no discovery validado com disponibilidade limitada61. Só permitir destino com mesma origem do issuer, sem userinfo/fragmento; retorno fixo configurado, registrado no cliente e na mesma origem do callback de login, sem parâmetros controlados pelo navegador. Usar client_id e post_logout_redirect_uri, sem expor ID token. Conforme [RP-Initiated Logout1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html), ausência de id_token_hint exige confirmação do usuário no IdP. Não substituir essa confirmação por endpoint administrativo/global de logout.

Frontend prepara destino antes de invalidar a sessão, chama DELETE token/current nativo e sempre limpa estado local/cookie no finally. Saída explícita suspende autoLogin, inclusive ao voltar do IdP. Falha de discovery/IdP ou sessão já vencida não pode impedir saída local: manter usuário na tela moderna e informar que saída do provedor não foi confirmada; nunca abrir fallback local no exclusivo. Não interpretar retorno ao login como prova de revogação no IdP. Retorno não cria sessão nem altera dados; não aceitar redirect arbitrário.

Logout nativo remove a entrada auth_token pela chave; replay da chave e streams já abertos precisam de provas distintas. Não prometer revogação de todos os JWTs/APIs keys, expiração de sessões de outros aplicativos ou back-channel logout com esse recorte. AUTH03/OBS02/REL05 mantêm seus gates próprios.

## Gates

Contratos Java: flags/dependências, destinos e origens/CSRF, provider/sessão/local/OIDC, URI com credenciais/fragmento/host externo recusada. Frontend: preparo→invalidação→limpeza, falha/timeout/aba com sessão alterada, autoLogin sem loops, flag off. Integração isolada com identidade própria: botão Sair em shell e sem-acesso, confirmação real Keycloak, retorno, nova tentativa exige credenciais; login local não encerra SSO. Provedor parado: saída local funciona e aviso correto; exclusivo mantém restrição. Replay da chave encerrada recusa APIs. Restaurar flags/provedor e remover somente fixtures próprias. Nunca salvar JWT, chave, senha ou state de navegador em evidência.

## Implementação em validação

Destino deriva de end_session_endpoint fresco, mesma origem do issuer; retorno fixo deriva da origem pública do callback para /console/login?oidc_logout=returned. POST somente com Origin e CSRF coincidentes, sessão opaca/provider/JWE/conta ativos e loginMethod oidc; local retorna federated=false. Nenhum ID token ou segredo no destino. Frontend prepara antes de DELETE nativo, trata cookie expirado pelo próprio servidor, encerra estado local mesmo em falha, evita autoLogin explícito e não encerra sessão substituída durante preparo.

Contratos Java134 configuração +31 URI/Origin/CSRF +10 writer aprovados. Frontend605 testes/71 arquivos e TypeScript/Vite aprovados em Docker. Dez testes novos de logout incluem recuperação de erro/timeout, sessão alterada, cliques duplicados e Set-Cookie de DELETE nativo. Matriz real está em execução; ainda não é aceite de AUTH04b. Primeira tentativa de HTTP nativo foi recuperada sem resíduos: cliente Python não recebe CSRF se não usa User-Agent de navegador; harness ajustado para obter cookie pelo GET nativo antes dos casos positivos. Não desativar CSRF para facilitar teste.

Build Docker também detectou imports de contratos locais fora do pacote: schemas sanitizados de upgrade/webhooks foram movidos para src/test/fixtures, sem registros de recursos ou links privados. Repetição605/71 aprovada sem essas capturas externas.

## Aceite real

15 checks de integração e4 cenários independentes de navegador passaram: confirmação no Keycloak e retorno; replay da chave Rancher revogada401; nova entrada OIDC exige credenciais; logout de conta local conserva SSO do IdP; logout na tela sem acesso; provedor parado/religado em modo exclusivo+autologin mantém aviso correto, sem formulário local e sem loop. Oito combinações de tema/resolução passaram axe/layout. Source, conta/grupo/vínculo próprios, configuração do cliente e política foram restaurados; manifestos temporários ausentes. Flag permanecefalse por padrão, inclusive no Compose moderno, até ativação explícita do operador.

Fronteiras: não é logout back-channel, desativação automática por evento do IdP, nem revogação de sessões de outros aplicativos/API keys. O retorno por URL não é usado como prova de saída do IdP; a prova deste recorte foi nova autenticação exigir credenciais no navegador isolado.

Diagnóstico visual detectou contraste transitório no botão secundário ao trocar tema. Corrigido no ThemeProvider compartilhado, aplicando tokens antes da pintura e suspendendo transições de cor por duas frames. Matriz repetida passou sem adicionar espera para mascarar o contraste. Testes HTTP usam User-Agent de navegador e cookie CSRF obtido nativamente, mantendo checagens positivas/negativas independentes.

Referências: [OpenID RP-Initiated Logout1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html) e [endpoints OIDC do Keycloak](https://www.keycloak.org/securing-apps/oidc-layers), consultados durante implementação. Sem id_token_hint, o provedor solicita confirmação; retorno deve estar registrado exatamente. Nenhum ID token é enviado na URL.
