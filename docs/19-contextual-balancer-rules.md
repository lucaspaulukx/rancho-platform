# Regras de balanceadores no contexto

## Plano — 22/10/2026

1. Flag modules.balancerRulesEditor, inicialmente false. Comando Configurar balanceador no menu e detalhe da operação, usando drawer compartilhado. Fallback de flag mantém edição nativa genérica.
2. Primeiro recorte: editar/adicionar/remover regras HTTP e TCP com destino por stack/serviço, porta de entrada/destino, hostname/path HTTP e acesso publicado/interno. Regras de outros protocolos, seletores, regiões e configurações avançadas permanecem visíveis como preservadas e não editáveis neste recorte.
3. Preservar integralmente configuração customizada, certificados, política de sessão e regras avançadas, usando o recurso fresco e os schemas nativos. Reconstituir portas/expose do launchConfig conforme comportamento clássico, mantendo IP de publicação existente. Bindings não suportados bloqueiam edição, sem conversão silenciosa.
4. Campo de porta exige inteiro1–65535. Recusar destino fora do environment, misturas de protocolo no mesmo listener, regras ambíguas e perda de schema/permissão. Snapshot privado de lbConfig/ports/expose detecta alterações concorrentes; outros campos frescos do launchConfig são preservados. Não é CAS atômico.
5. Recurso/configuração completa somente no estado privado do editor, sem query cache. Revisão antes/depois, impacto e confirmação; erros e rascunhos protegidos. Não iniciar serviços automaticamente.
6. Unitários de preservação/contratos/bindings/escopo/conflito, build Linux, CUA com LB sintético inativo/escala zero, readback nativo, negativa de acesso, flags/temas/móvel e cleanup. Aceite físico HTTP/TCP/TLS, publicação entre hosts e todos os protocolos permanecem gates adicionais: não confundir configuração persistida com tráfego aprovado.

## Contrato conferido

loadBalancerService permite PUT de lbConfig e launchConfig. Subschemas lbConfig/portRule usam campos criáveis dentro desses objetos. portRule aceita http/tcp/https/tls/sni/udp, portas1–65535, serviceId/selector e hostname/path. A UI clássica deriva launchConfig.ports/expose das regras, com publicação x:x/tcp ou udp e IP opcional. Alterar labels/imagem aciona upgrade separado no clássico; este editor não faz essa alteração.

## Situação

Implementado no novo frontend, com `modules.balancerRulesEditor=true` no laboratório após aceite E2E de configuração e apresentação. Menu contextual e detalhe abrem o mesmo drawer, preservando URL, environment e stack. A UI clássica não foi alterada.

O recorte permite adicionar/editar/remover regras HTTP/TCP com serviço de aplicação do mesmo environment, publicação interna/pública, portas, hostname/path HTTP e IP existente preservado. Para configurações que contenham protocolos, seletores, regiões ou bindings não suportados, **todo o editor fica protegido** e apresenta um resumo das regras preservadas. O formulário genérico continua disponível com a flag desligada e pelo comando Editar configuração. Não há conversão parcial de regras avançadas.

A revisão mostra antes/depois e exige confirmação do impacto quando há portas publicadas. Rascunho, descarte, erro e troca de contexto usam os componentes comuns. Configuração privada é carregada em estado local, sem cache de query/mutation do editor. Antes de PUT, são relidos recurso, serviços/stacks e todos os schemas do environment; estado, identidade, environment, contratos e snapshot de configuração/ports/expose são revalidados. Campos frescos independentes do launchConfig são preservados. O snapshot não é um CAS atômico.

## Evidências — 22/10/2026

- 14 testes de domínio e 7 testes de painel: portas, IP IPv4/IPv6, rotas duplicadas, protocolo/acesso conflitante, schemas revogados/alterados, destinos fora do escopo, preservação de configuração/certificados/sessão/variáveis, privacidade, revisão, descarte e concorrência. Gate global deve ser conferido em `console/last-build.log` e documento 08.
- `console/tests/balancer_rules_fixture.py` usa **o mesmo módulo de domínio do frontend**, carregado pelo Node 24 através de `balancer_rules_payload.cjs`, contra a API nativa. Não automatiza um navegador e não equivale a um teste E2E da UI.
- `console/balancer-rules-test-results.json`: **9 checks nativos passed**. HTTP com hostname/path e binding interno; TCP com binding publicado; imagem/environment/labels e configuração customizada preservados; usuário sem acesso ao environment recusado; alteração externa detectada e preservada.
- Fixture única `console-lb-45df51f2`: stack 1st84, backend 1s110, balanceador 1s111, todos inativos/escala zero. A stack e os dois serviços foram removidos; manifest ausente. Hashes das configurações dos balanceadores anteriores conferidos após cleanup.
- Nenhum container da fixture foi iniciado. Não foi comprovado tráfego HTTP/TCP/TLS, publicação real de portas, alta disponibilidade ou comportamento entre hosts.

## Gate visual e ativação — concluído no recorte

`balancerRulesEditor=true` após a suíte isolada do documento 22. O teste de projeto possui contexto/cookies próprios e não controla Google Chrome do usuário. Testou menu/drawer no contexto da stack, claro/escuro/móvel, HTTP/TCP, confirmação para publicação, revisão, salvar/readback, beforeunload real, alteração concorrente, descarte e fallback com flag off. Sete auditorias axe de drawers/diálogos passaram sem violações automatizadas. A primeira tentativa interativa foi recusada pela ferramenta; isso é histórico e não bloqueia mais estes testes isolados.

Fixture E2E final `console-lb-07fc73da`: stack 1st87, backend 1s115, LB 1s116 e serviço criado pela UI 1s117. Cleanup confirmou todos removidos e balanceadores anteriores preservados. `context-editors-e2e-results.json`, `context-editors-a11y-results.json` e `context-editors-cleanup-results.json` registram aceite.

Não comprova tráfego HTTP/TCP real, TLS, HA, multi-host ou todos os protocolos. A edição de configurações avançadas continua protegida conforme o recorte acima; isso não fecha F5/F6 ou a paridade de balanceadores.
