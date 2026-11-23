# 32 — Drivers de máquinas

## Plano antes da implementação

Recorte F8: inventário administrativo nativo, cadastro inativo, edição de drivers personalizados, ativação/desativação e remoção. Catálogo de drivers e provisionamento de máquinas permanecem tarefas separadas.

- Tela `/drivers`: shell compartilhado, pesquisa, estado, origem (embutido/catálogo/personalizado), atualização manual e automática; ações junto à linha.
- Modal de criação/edição: URL do binário, checksum, URL de interface e descrição. Nome é inferido pelo servidor; não enviar nome, builtin ou externalId arbitrários. Cadastro sempre com activateOnCreate=false.
- Revisão antes de gravar; aviso de impacto na ativação (download/execução de código pelo servidor). Guardar alterações não salvas via fluxo compartilhado.
- Drivers embutidos e vinculados ao catálogo não têm editor ou remoção manual neste recorte. Não carregar JavaScript de uiUrl.
- Flag machineDrivers para o módulo; driverActivation para as ações de ativação/desativação. Administração real exigida no frontend e validada no backend.
- Metadados em cache sem URLs/checksum/configuração; dados do editor somente em estado privado, mascarados por padrão, descartados ao fechar/trocar conta. Erros sem conteúdo da resposta nativa.
- Antes de cada escrita, buscar schema e recurso atuais, conferir snapshot/estado/ação nativa e limitar destino ao mesmo recurso local. Sem repetir mutações automaticamente.

## Validação planejada

Contrato real e fixture com nome aleatório, URL localhost porta fechada e cadastro inativo. CRUD, negação para não administrador, preservação dos drivers anteriores e limpeza exata. Ativação apenas de driver embutido local, se não houver máquinas dependentes, restaurando o estado. Testes de domínio/componentes, build, acessibilidade nos dois temas e viewport móvel/desktop e operações reais no navegador isolado.

## Limites

Cadastrar metadados não comprova download/execução de binários de terceiros ou criação de máquinas em provedores. Checksum é repassado ao contrato nativo; não representa verificação pelo frontend. Revalidação é proteção contra alterações detectáveis, não transação CAS. Ativação real de provedor externo e catálogo de drivers exigem evidência própria.

## Implementado e validado — 23/10/2026

Flags machineDrivers/driverActivation=true. Build do recorte: 451 testes/52 arquivos + TypeScript/Vite; a fonte seguinte de repositórios elevou o gate geral a 476/54. Inventário, cadastro com activateOnCreate=false, editor protegido de personalizados, menu compartilhado de ações, estado Badge, transições/atualização manual e pausável. Embutidos e vinculados ao catálogo não recebem edição/remoção manual.

22 checks reais de navegador, oito cenários axe/layout sem violações/overflow, nos dois temas e 1440/390px. CRUD de fixture com URL localhost fechada, revisão mascarada, descarte, preservação dos 14 drivers anteriores e mesmo env/rota. Ativação, reativação e desativação do embutido generic por UI e API; estado/configuração original restaurados e zero máquinas provisionadas. Nenhum provedor externo ativado. Flags independentes e acesso administrativo conferidos. Relatórios machine-drivers-e2e-results.json, machine-drivers-a11y-results.json, machine-driver-contract-results.json e machine-driver-activation-results.json. Manifests das fixtures nativas ausentes ao finalizar.

Nuance comprovada: activateOnCreate=false solicita o estado inativo, mas não impede processamento do binário no registro. A fixture pode atingir inactive e depois error com URL fechada. Cadastro/edição/revisão avisam desse efeito; não prometer cadastro sem execução ou sucesso de download. O usuário comum lê o inventário nativo (GET200), mas POST/PUT/DELETE receberam405 com sessão OIDC/CSRF válidos. Administração moderna continua restrita a admin. URLs protegidas no frontend não mudam os campos públicos do contrato nativo.

A primeira sondagem aguardava apenas inactive, foi interrompida ao detectar error e retomada pela identificação exata da fixture; esta foi removida. Uma sondagem de preservação coincidiu com o teste de ativação do generic; após restaurar o driver, os 14 hashes foram reconferidos e a suíte nativa repetida isoladamente com sucesso. Não apresentar essas tentativas como gates aprovados; os relatórios atuais correspondem às repetições concluídas.


### Repetição da matriz visual

Revisão de screenshots identificou que alternar tema com o modal aberto não alcançava o controle do shell. O harness passou a selecionar o tema antes de reabrir cada formulário e conferir data-theme efetivo; as oito combinações foram repetidas com sucesso, e os relatórios atuais incluem appliedTheme igual ao tema solicitado. Repositórios reutilizam nested-fields para separar entradas sem estilos paralelos.
