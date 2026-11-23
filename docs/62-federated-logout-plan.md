# 62 — Plano de logout federado opcional

AUTH04b ainda não implementado. Depois do aceite61, acrescentar flag backend independente OIDC_FEDERATED_LOGOUT_ENABLED, padrão off e dependente de OIDC/customização efetivos. Frontend anterior/backend anterior conservam logout existente. Mostrar capacidade com nome legível em Sobre. Não mudar Ember nem introduzir permissões/grupos no IdP.

## Contrato e fluxo

POST /oidc/logout deve preparar destino somente para sessão OIDC válida; validar Origin contra origem pública configurada e double-submit CSRF do Rancher. Resolver cookie token como chave opaca via AuthTokenDao, validando registro/provider/expiração e JWE armazenado antes de ler loginMethod. O campo público Token.jwt atualmente retorna a chave opaca, não o JWE; não tentar descriptografar diretamente o cookie nem transportar tokens em query. Login local/flag off conservam saída local.

Obter end_session_endpoint no discovery validado com disponibilidade limitada61. Só permitir destino com mesma origem do issuer, sem userinfo/fragmento; retorno fixo configurado, registrado no cliente e na mesma origem do callback de login, sem parâmetros controlados pelo navegador. Usar client_id e post_logout_redirect_uri, sem expor ID token. Conforme [RP-Initiated Logout1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html), ausência de id_token_hint exige confirmação do usuário no IdP. Não substituir essa confirmação por endpoint administrativo/global de logout.

Frontend prepara destino antes de invalidar a sessão, chama DELETE token/current nativo e sempre limpa estado local/cookie no finally. Saída explícita suspende autoLogin, inclusive ao voltar do IdP. Falha de discovery/IdP ou sessão já vencida não pode impedir saída local: manter usuário na tela moderna e informar que saída do provedor não foi confirmada; nunca abrir fallback local no exclusivo. Não interpretar retorno ao login como prova de revogação no IdP. Retorno não cria sessão nem altera dados; não aceitar redirect arbitrário.

Logout nativo remove a entrada auth_token pela chave; replay da chave e streams já abertos precisam de provas distintas. Não prometer revogação de todos os JWTs/APIs keys, expiração de sessões de outros aplicativos ou back-channel logout com esse recorte. AUTH03/OBS02/REL05 mantêm seus gates próprios.

## Gates

Contratos Java: flags/dependências, destinos e origens/CSRF, provider/sessão/local/OIDC, URI com credenciais/fragmento/host externo recusada. Frontend: preparo→invalidação→limpeza, falha/timeout/aba com sessão alterada, autoLogin sem loops, flag off. Integração isolada com identidade própria: botão Sair em shell e sem-acesso, confirmação real Keycloak, retorno, nova tentativa exige credenciais; login local não encerra SSO. Provedor parado: saída local funciona e aviso correto; exclusivo mantém restrição. Replay da chave encerrada recusa APIs. Restaurar flags/provedor e remover somente fixtures próprias. Nunca salvar JWT, chave, senha ou state de navegador em evidência.
