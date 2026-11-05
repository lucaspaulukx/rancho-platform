# Vínculos de serviços no contexto da operação

## Resultado — 22/10/2026

Implementado no ResourcePanel da operação, pelo menu e detalhe, com modules.serviceLinksEditor=true após aceite. ServiceLinksPanel é lazy; carrega apenas metadados e vínculos de saída no query cache, com gcTime0. Snapshot original permanece congelado no rascunho. Mutation relê origem, schemas/action, mapas, serviços e stacks antes do POST. Recusa targets de outro environment, origem como destino, duplicidades, estados transitórios e vínculos avançados. Fonte é limitada a service; LB/aliases externos/portas avançadas seguem no formulário nativo. Desligar a flag com recarga recupera o schema genérico.

Onze regressões novas; build Linux **266 testes/31 arquivos + TypeScript/Vite**. A revisão reutiliza Confirm, agora com corpo opcional para apresentar listas antes/depois. Remover todos exige checkbox explícito antes da revisão. Erro preserva o rascunho e fecha a confirmação para mostrar a falha.

CUA aplicou consumer → backend com alias api, sem navegar da operação. Cliente independente alterou o alias para external-client enquanto UI mantinha stale-draft; UI recusou o POST e readback preservou a mudança externa. Reabrir trouxe o alias atual. Remoção completa foi bloqueada sem checkbox, depois persistida com lista vazia. Claro/escuro, drawer de 390 px sem overflow e fallback de flag conferidos. Relatório browser: console/service-links-browser-test-results.json. Capturas console-service-links-{dark,light,mobile,review,conflict}.png.

Fixture exclusiva console-links-7541178a, stack 1st82, consumer 1s107 e backend 1s108, ambos escala zero/inativos. Os readbacks verificam que nenhuma instância foi iniciada e mapas preexistentes permaneceram iguais. Helper console/tests/service_links_fixture.py tem modos seed/verify-linked/conflict/verify-conflict/verify-empty/authorization/cleanup, manifest próprio e validação de ID/nome/marcador/environment. Não usar contra recursos preexistentes.

Este aceite é de configuração nativa. Não comprova resolução DNS nem comunicação física entre serviços, LB/multi-host ou CAS atômico. A negação direta a leitor sem environment foi exercitada sem grants novos. O cleanup e a contagem final de checks ficam registrados após a conclusão do helper.

## Plano — 22/10/2026

1. Flag `modules.serviceLinksEditor`, inicialmente false, com fallback para schema nativo. Entrada pelo menu … e pelo detalhe, mantendo URL/environment/lista.
2. Drawer compartilhado para serviços Cattle de aplicação (`service`), com lista de vínculos de saída, destino selecionado por stack/serviço, alias opcional, adicionar/remover e revisão antes do envio. Não editar vínculos de LB/infraestrutura ou destinos externos neste primeiro recorte.
3. Usar action nativa `setservicelinks`, payload `{serviceLinks:[{serviceId,name}]}`, conforme fontes clássicos. Carregar mapas reais por escopo e guardar apenas apresentação/IDs no query cache. Vínculo não suportado/avançado deve bloquear a edição completa para impedir perda silenciosa.
4. Antes de POST, reler recurso, schema/action, mapas e destinos. Recusar mudança de identidade/environment, remoção, perda de capacidade, destinos indisponíveis, conflitos detectados por snapshot e duplicidades. Snapshot é proteção de cliente, sem CAS atômico. Mostrar que substituir a lista pode modificar resolução/conectividade.
5. Proteger rascunho, manter erros, impedir duplo envio. Revisão confirma remoções; vazio só é aceito com confirmação explícita de remover todos. Releitura do backend após envio, sem interpretar toast como conclusão física.
6. Testes de contrato/escopo/conflito/preservação; build Linux, aceite CUA com fixtures sintéticas isoladas, links e aliases persistidos, negativa de autorização, flag/temas/mobile e cleanup exclusivo. Validação de DNS/tráfego depende de fixture física apropriada; não alegar essa cobertura se só mapas forem relidos.

## Contratos conferidos em leitura

`serviceConsumeMap` é coleção GET, com serviceId, consumedServiceId/consumedService, name e ports. `setServiceLinksInput.serviceLinks` é array[serviceLink]; `serviceLink.name` aceita a-zA-Z0-9-._; serviceId é reference[service], service é string. A UI clássica edit-service chama setservicelinks com a lista completa após editar serviço.

## Situação

Planejado; implementação e gates em andamento.


Cleanup concluído: stack 1st82, serviços 1s107/1s108 removidos, manifest service-links-fixture.json ausente e mapas preexistentes preservados. Relatório nativo contém 8 checks passed; os sete checks browser se sobrepõem a esse readback e não devem ser somados como cobertura independente. Tema escuro e viewport restaurados; aba de testes fechada.
