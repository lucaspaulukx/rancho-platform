# 10 — Identidade visual comunitária

O produto mantém símbolo, wordmark e favicon Rancher. A assinatura opcional é `Community Console`; não implica endosso oficial. Não há logo de outra organização ou dependência de repositório visual externo.

A paleta moderna usa azul Rancher (`#0075a8`) com superfícies neutras e estados semânticos. Temas claro/escuro/sistema e overrides continuam disponíveis. A fonte Inter é distribuída pelo pacote público com sua licença OFL.

Fonte de verdade: `console/src/themes/presets.json`. Gerar CSS com `node scripts/themes.mjs`, sem editar `tokens.css` manualmente. Textos exigem contraste4.5:1 e controles3:1; validar sobre cada superfície.

Shell compartilhado: sidebar224px, recolhida80px, móvel260px, breakpoint767px; navbar68px no desktop e72px no móvel. Só a navegação rola; ícones19px, itens13px e padding9px13px. A área de marca tem104px, sem uma segunda logo.

`branding=false` remove a assinatura comunitária e conserva Rancher. Preferências locais usam namespace `rancher.console`; preferências de instalações experimentais anteriores são redefinidas sem alterar contas, permissões ou workloads.
