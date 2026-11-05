# Boas práticas de frontend

<!-- rancho-language-navigation:start -->
[Português (Brasil)](ui-guidelines.md) | [English](../en/ui-guidelines.md)
<!-- rancho-language-navigation:end -->


## Layout e identidade

Use `AppShell` e `AuthLayout` em `console/src/layouts.tsx`. Páginas autenticadas compartilham sidebar/navbar e contexto de environment; login e sem-acesso usam a mesma linguagem visual. Preserve marcas e atribuição Rancher junto da assinatura comunitária Rancho opcional. Referências a identidades visuais alheias não pertencem ao produto.

O shell atual usa sidebar224px, recolhida80px, painel móvel260px e breakpoint767px; navbar68px no desktop e72px no móvel. A navegação rola em sua própria região. Use o hook de preferência e estados acessíveis existentes, sem duplicar navegação. Trate medidas como contratos atuais de tokens/layout e confira o layout ao alterá-las.

## Temas e controles

`console/src/themes/presets.json` é a fonte das paletas. Gere CSS pelo script existente, sem editar `tokens.css` gerado manualmente. Azul Rancher e superfícies neutras suportam modos escuro/claro/sistema e overrides validados. Aplique tokens antes da pintura; o tratamento existente evita combinações temporariamente ilegíveis durante a troca.

Reuse `Field`, `CheckboxField`, botões, menus, tabelas e modais compartilhados. Associe rótulos, erros e descrições aos controles. Confira opções nativas do select além do seletor fechado: texto/fundo devem permanecer legíveis em cada tema. Busque contraste4.5:1 para texto e3:1 para controles nas superfícies adjacentes reais.

## Operação contextual

Mantenha stacks alinhadas verticalmente com serviços/containers, controles diretos de lifecycle e menu `...`. Logs, terminal, métricas e configuração abrem no mesmo contexto. Preserve filtros da URL, environment e expansões; evite criar rota para ação que cabe no drawer comum. Reuse a conexão de stream ao selecionar uma réplica, em vez de abrir socket por troca do seletor.

Respeite estados/ações nativos e permissões. Controles desativados explicam a dependência real; esconder ação não impõe segurança. Falhas parciais ficam visíveis e não apagam rascunhos. Operações destrutivas ou que substituem containers usam revisão/confirmação comuns e explicam o impacto pertinente.

## Formulários e dados de stream

Descubra campos graváveis nos schemas atuais. Use editores dedicados para contratos suportados e fallback nativo explícito. A primeira edição inválida deve marcar o formulário alterado, manter o texto em memória e bloquear envio; não arredonde valores ou descarte dados legados desconhecidos silenciosamente.

Explicite limites inteiros e unidades. Memória/reserva, CPU/IO, capabilities, saúde, dependências de sidecars e ulimits usam validadores de domínio comuns. Ulimits distinguem `-1` ilimitado, valores explícitos e configuração herdada/reset; campos imutáveis de containers avulsos exigem outra operação nativa.

Limite frames de entrada e amostras retidas. Métricas de serviço mantêm contadores/séries independentes por container; identidades alheias são ignoradas. Mostre cobertura e lacunas sem chamar contadores dessincronizados de total do serviço. Troca de identidade/environment reinicia/fecha o painel; encerramento por permissão não inicia loop de reconexão. CSV contém somente as séries desejadas, sem capacidades.

## Aceite

Verifique desktop/móvel, foco/retorno por teclado, loading/vazio/erro/parcial, os dois temas, proteção de rascunhos e cleanup. Unitários e axe não substituem leitor de tela manual, medição em alto volume ou efeitos nativos reais. Mantenha gates incompletos no [roadmap](roadmap.md), com defaults em [configuração](configuration.md).
