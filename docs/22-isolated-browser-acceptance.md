# Aceite E2E com navegador isolado

## Plano — 22/10/2026

A fase F1-08 precisa de suíte repetível além da automação interativa. Usar o Playwright JavaScript 1.62.1 já fornecido pelo runtime local, em Chromium headless com contexto novo e não persistente. Isso executa testes da aplicação com sessão própria: não controla Google Chrome instalado nem lê cookies/perfis/abas do usuário. Não alterar permissões de aplicativos ou configuração do Codex. Referência: https://playwright.dev/docs/browser-contexts.

- Credencial de laboratório entregue somente por stdin ao processo, sem argumentos, env de Docker, storageState, HAR, trace ou logs de respostas. Erros sanitizados e screenshots sem segredos revelados.
- Só requests para as origens locais explícitas do laboratório. OIDC usa o Keycloak local. Testes mutantes usam fixtures exclusivas com IDs/markers e cleanup validado por API. Nunca alterar stacks preexistentes.
- Primeiro gate: login local e shell, capturas claras/escuras/móvel e ausência de erros de aplicação. Depois: editor de LB e bindings, revisão, salvamento/readback, conflitos, flag off/on, navegação/teclado e saída com rascunho.
- Flags sob teste podem ser substituídas somente na resposta de configuração deste contexto de teste. Só ativar globalmente após aprovação do gate correspondente; não compartilhar sessão com o navegador do usuário.
- Reportar cada cenário e evidência; screenshot não substitui readback nem comprova tráfego físico/montagem. Não usar o harness para operar sites externos ou desktop.

## Situação

Harness implementado. Executar `python -u console/tests/e2e/run.py smoke|context-editors|accessibility|form-themes` na raiz do laboratório. `context-editors` requer fixture exclusiva criada pelo helper balancer_rules_fixture; as outras suítes não criam workloads. `form-themes` e `accessibility` bloqueiam qualquer write de negócio em rede.

Resultados: 5 smoke, 12 checks contextuais, 7 audits de drawers, 4 previews de formulário, 44 combinações de rotas/tema/viewport e seletor por teclado aprovados. API/readback/cleanup documentados em 19/21. O beforeunload foi observado como diálogo real e dispensado no contexto de teste, preservando o rascunho.

O runtime forneceu Playwright 1.62.1, mas seu executável default de revision 1234 não existia. A suíte usa caminho explícito para o headless shell já instalado revision 1248, versão de navegador 156.0.8078.4, sem download adicional. `context-editors-e2e-browser.json` registra as versões; não assumir a combinação default do pacote nem portabilidade desse caminho para outro host. Não foi anexado a Chrome/perfil do usuário.

Screenshots usam `animations: disabled` para observar cores finais das transições. Auditoria é feita após estabilização da captura: uma leitura no meio da troca de tema produziu achado transitório que não reapareceu no estado final. Uma asserção obsoleta do script concorrente foi corrigida para usar marcador externo único a cada execução. Gates finais passaram; não foram ignoradas violações reais.

Sem HAR/trace/storageState ou senhas em relatórios. Credenciais ficam no stdin e memória do contexto próprio; nenhuma configuração do Codex foi editada.
