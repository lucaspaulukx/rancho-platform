# 65 — Regressão de rotas no artefato atual

Recorte de UX01/REL06 no build588 testes/68 arquivos:21 links diretos em1440px e390px,42 verificações no navegador isolado, todas aprovadas. Visão geral, environments, stacks, serviços, containers, hosts, volumes, registries, secrets, certificados, catálogo, grupos, usuários, auditoria, processos, repositórios, drivers, HA, configuração, API keys e webhooks.

Cada rota confirmou título renderizado, navegação compartilhada, ausência da recuperação de erro da aplicação, nenhum erro JS ou asset com resposta malsucedida e nenhum overflow horizontal do documento. No móvel, o teste abre e fecha a navegação pelo botão do shell. A primeira tentativa esperava a sidebar visível com o menu móvel fechado; corrigido o harness para exercitar o comportamento responsivo existente, sem alteração no produto.

Script e2e/routes-readonly.cjs, executado por e2e/run.py routes-readonly; relatório routes-readonly-results.json. Somente leitura e criação de sessão local. Nada de screenshots de settings/secrets, HAR, trace, storageState ou respostas privadas em evidências. O teste não altera contas/grupos/workloads e não visita a aba do usuário.

Este gate comprova carregamento/render/layout dos links principais no artefato atual. Não aceita automaticamente CRUD, efeitos físicos, RBAC completo, todos os temas, acessibilidade por leitor de tela, escala ou paridade funcional. REL06 continua dependente dos demais critérios do roadmap48.

Repetido no artefato593/69 apos upgrade CPU/IO:42 rotas novamente aprovadas, seguido de Sobre9. Sem escrita de negocio nem artefatos privados.
