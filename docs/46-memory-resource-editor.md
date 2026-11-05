# 46 — Memória em unidades legíveis

## Plano antes do código

Recorte F5: campos memory/memoryReservation atualmente exigem bytes sem auxílio. Editor compartilhado Bytes/MiB/GiB na seção Recursos de serviço/container/sidecar; flag workloadResourceEditors independente. Manter valor nativo em bytes, sem arredondamento ao trocar unidade. Vazio conserva omissão, zero explícito representa ausência de limite nativo. Validar inteiro seguro não negativo e reserva menor/igual ao limite positivo; schema fresco antes do POST. Off mantém campo numérico genérico. Não inventar limite CPU nem alterar quotas existentes.

Aceite: conversão exata/fração/limites, troca de unidade sem mutação, labels acessíveis e flag off; claro/escuro × desktop/móvel; serviço escala0/inativo com valores persistidos na API, sem agendar containers; negação de acesso e cleanup exclusivo com preservação anterior. Execução física de limites e editor de upgrade terão gates próprios.


## Aceite

Gate559 testes/64 arquivos + TypeScript/Vite; quatro testes de conversão/limites/reserva/recursão e troca de unidade sem envio. Flag workloadResourceEditors habilitada após11 checks browser/oito cenários reais serviço/container × claro/escuro ×1440/390, sem violações axe/overflow. Revisão visual móvel realizada. API persistiu limite128MiB (134217728 bytes) e reserva64MiB (67108864) em serviço escala0/inativo/sem instâncias; sem acesso negado403. Report resources-native-results.json.

Helpers resources_fixture.py seed/verify/cleanup e e2e/run.py resources usam stack exclusiva, hashes das configurações anteriores e IDs de containers/volumes. Teste inicial teve asserção residual de labels de agendamento no harness; corrigido após cleanup e repetido. Sidecars têm integração compartilhada/validação recursiva, sem persistência nativa específica neste aceite. Upgrade e efeito físico de limite/reserva não foram exercitados. Unidades grandes continuam sujeitas ao contrato/limite efetivo do backend legado; não inferir aceite de todos os tamanhos por teste de conversão.
