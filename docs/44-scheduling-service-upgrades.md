# 44 — Upgrade contextual de afinidades

## Plano antes do código

Próximo recorte F5: reutilizar SchedulingEditor no drawer de upgrade do serviço, com opt-in e flag workloadSchedulingUpgrades independente da criação. Somente labels de launchConfig primário nesta etapa; host solicitado, escala global e sidecars não recebem novo editor de upgrade por inferência.

Preservar configuração completa atual, imagem, portas/volumes, saúde/sidecars, labels desconhecidas e escala. Revalidar schema atual, sessão/escopo/recurso e snapshot completo antes do envio. Usar serviceUpgrade nativo, revisão, rollback/finish. Não fazer PUT direto de launchConfig em serviço ativo. Regras legadas não interpretáveis devem bloquear o opt-in, sem conversão/perda. Regras removidas devem ser comprovadas no estado persistido; não presumir que mapa vazio implica remoção.

Testes de domínio, claro/escuro × desktop/móvel, manutenção do contexto, flag off, upgrade/rollback/finish/remoção com serviço escala0 e fixture exclusiva, negação sem environment e limpeza/preservação de recursos anteriores. Posicionamento físico segue gate distinto.

## Estado

Habilitado após aceite real. Flag workloadSchedulingUpgrades independente da criação, de bindings e saúde/sidecars. Editor comum no mesmo drawer e opt-in explícito; contratos atuais exigidos para labels/map[string], serviceUpgrade e imagem. Snapshot completo do primário/auxiliares protege alterações concorrentes antes do envio (sem CAS no servidor). Regras atuais malformadas impedem opt-in. Não mexe no seletor de host solicitado nem adiciona edição de global.

Gate547 testes/62 arquivos + TypeScript/Vite. Quatro novos testes de domínio/componentes: payload de labels com imagem igual, remoção com mapa vazio, preservação das demais configurações, schema ausente/regras inválidas/no-op/conflito, regras legadas e flag off.

Aceite browser integrado:15 checks/quatro cenários reais claro/escuro ×1440/390, sem violações axe/overflow. Conferidos upgrade nativo/persistência da afinidade, imagem/bindings/env/comando/rede/escala0 mantidos, contexto de busca/rota/environment, rollback, repetição + finish, decodificação existente, remover regra + finish e igualdade exata das demais labels. Usuário sem environment403/404, flag off mantém imagem. Relatórios scheduling-upgrade-*-results.json. Fixture1st115/1s147 removida; relatório config-upgrade-cleanup-results.json comprova configuração e volumes prévios preservados/sem instâncias. A fixture não continha sidecars: preservação com sidecar existe no payload unitário; não é aceite físico.

Repetir com config_upgrade_fixture.py seed → e2e/run.py scheduling-upgrade → config_upgrade_fixture.py cleanup em finally. Não reutilizar IDs deste documento. Somente configuração de serviço escala0 foi exercitada; posicionamento físico/multi-host continua pendente e não se infere do estado upgraded.
