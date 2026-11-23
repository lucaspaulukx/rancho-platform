# 43 — Agendamento estruturado de workloads

## Plano antes do código

Próximo recorte F5: afinidades na criação de serviço/container e sidecars, dentro da seção Agendamento existente. Sem nova página. Flag workloadScheduling controla editor; off mantém o mapa nativo. Editor compartilhado oferece alvo (label de host/container ou nome de container), obrigação/preferência/negação, chave/valor e adicionar/remover. Vínculo a serviço é representável pela label nativa io.rancher.stack_service.name. Host solicitado continua no seletor nativo existente.

Contratos lidos em form-scheduling, scheduling-rule-row e manage-labels do Ember original (somente leitura): io.rancher.scheduler.affinity:host_label/container_label/container, sufixos vazio/_soft/_ne/_soft_ne e múltiplos valores separados por vírgula. Campos comuns e labels desconhecidas precisam permanecer preservados. Regra desconhecida/não decodificável não deve ser convertida silenciosamente. Global existente permite apenas host_label obrigatório/negação; não oferecer mudança de escala global neste recorte.

Validar caracteres, chave/valor obrigatórios, limites e compatibilidade global no editor e antes da criação com schema fresco. Nada pode agendar workloads físicos no aceite de persistência: serviços escala0/inativos. Testes de domínio/componentes, flag off, claro/escuro e desktop/móvel, persistência nativa, autorização sem environment e cleanup de fixture com hashes anteriores. Execução multi-host e upgrades ficam em gates distintos.

## Estado

Habilitado após gate543 testes/62 arquivos + TypeScript/Vite. Sete testes novos cobrem roundtrip das variantes/valores com igual, campos incompletos/controles, restrições de global, validação recursiva em primário/sidecars, edição sem perda de labels, fallback legado e flag off.

Onze checks browser e oito cenários reais (serviço/container × claro/escuro ×1440/390), sem violações axe ou overflow. Persistência de duas afinidades (host obrigatório e container_label_soft_ne) e label customizada em serviço inativo/escala0, nenhuma instância. Native probe confirmou labels e negou criação sem environment403. Cleanup comparou hashes dos serviços anteriores e IDs de containers/volumes; manifesto próprio ausente. `scheduling-*-results.json` e capturas `evidence/e2e-isolated/scheduling-*`.

Revisão visual encontrou inputs nativos nas labels adicionais porque estavam fora do wrapper Field; corrigido e repetido o aceite completo antes de habilitar. Editor não adivinha regras malformadas: preserva mapa nativo com aviso, e flag off permite o caminho genérico. Ao criar com flag on, regras conhecidas malformadas são bloqueadas também antes do POST com schema fresco. Labels desconhecidas são mantidas. IDs internos das linhas são estáveis; regras vazias não são descartadas silenciosamente.

Repetição: `python -u console/tests/scheduling_fixture.py seed`, `python -u console/tests/e2e/run.py scheduling`, `python -u console/tests/scheduling_fixture.py verify`, e `cleanup` no finally. Somente a stack/marker do manifesto são elegíveis à limpeza; não reutilizar IDs de relatórios.

Sem aceite de posicionamento físico, de múltiplos hosts ou upgrade; apenas primário teve persistência nativa, sidecars têm validação recursiva/editor compartilhado testados em domínio. Escala global preservada, sem novo seletor de modo global. Essas lacunas permanecem abertas.
