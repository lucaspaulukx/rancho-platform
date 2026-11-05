# Sobre, ajuda e capacidades — plano

1. Diálogo reutilizado no AppShell, disponível em todas as rotas autenticadas pelo menu do usuário, sob flag independente `modules.about`. Preservar identidade Rancher/comunidade conforme branding e tema. Usar a versão da console do package.json e identificar Rancher 1.6.30 como base deste laboratório, sem fingir detectar a versão remota.
2. Explicar a customização, limites da migração e acesso ao Rancher clássico. Referenciar licença da fonte Inter já incluída. Não afirmar certificação/endosso ou auditoria completa de licenças.
3. Mostrar capacidades sanitizadas do servidor apenas como booleanos solicitados/efetivos/disponíveis existentes; nenhuma URL de issuer, client secret, token ou objeto genérico. Mostrar flags do frontend com rótulos, sem permitir alteração no navegador de configurações administradas por arquivo/Compose.
4. Modal com rolagem e teclado compartilhados; flag off remove ponto de entrada. Testes de componente, build e navegador nos dois temas/desktop/móvel; nenhuma escrita de negócio.

Status: plano antes da implementação. Complementa HELP-01 e parte somente leitura de ADMIN-03; não substitui administração de autenticação/configurações no servidor.

## Implementado e validado

`modules.about=true`. Menu compartilhado em stacks/auditoria e demais rotas do AppShell; versão importada do package.json (resolveJsonModule), produto e aba capacidades. Rótulos de módulos; booleanos solicitados/efetivos/disponíveis por allowlist conhecida, sem despejar configuração genérica. Quatro testes de componente; 8 cenários produto/capacidades × claro/escuro ×1440/390 com axe/overflow e flag off aprovados. `console/about-e2e-results.json`. Nenhuma escrita de negócio. A licença Inter existente é linkada; não constitui auditoria jurídica completa de todas as dependências.

Brand foi extraído para componente próprio e reutilizado em shell/login/Sobre. A aba Produto agora exibe os dois logos oficiais e respeita o preset positivo/negativo; oito cenários de tema/viewport e quatro testes de componente foram repetidos após a alteração.
