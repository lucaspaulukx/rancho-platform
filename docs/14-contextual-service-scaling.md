# Escala efetiva do serviço na operação unificada

## Checkpoint documental — 21/10/2026

Este é o último marco funcional entregue: 243 testes/29 arquivos + TypeScript/Vite. workloadScaling permanece true. O relatório específico registra oito checks e cleanup de 1st79/1s105. Nesta atualização não se repetiu o gate físico; os manifests de fixtures foram conferidos ausentes.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


O aceite de catálogo mostrou que respostas de template e escala efetiva podem divergir. A operação deve oferecer Escalar no menu do serviço, sem exigir editar JSON ou visitar outra página.

## Tasks

1. Flag workloadScaling dependente de workloads/contextActions. Mostrar comando somente quando schema permitir PUT e scale.update, com escala atual do recurso nativo.
2. Drawer compartilhado com quantidade desejada, min/max do schema, inteiro não negativo e aviso de impacto. Zero exige confirmação explícita no produto; manter a distinção entre escala configurada e containers running. Sem atualização automática de respostas do catálogo.
3. Revalidar recurso/environment, schema/permissão e escala original antes do PUT parcial contendo somente scale. Se outra sessão mudou a escala, recusar sobrescrita e pedir releitura. Nunca reenviar automaticamente após perda de resposta.
4. Retornar aos detalhes/lista no mesmo contexto e acompanhar transição. Desligar a flag remove a opção, preservando a edição nativa existente.
5. Aceite unitário/componente e fixture física: 2 para 1 para 0 e restauração, readback de escala/instâncias, guard de readonly/flag e limpeza exclusiva. Não generalizar Cattle a serviços globais, orquestradores opcionais ou tipos cujo schema não exponha scale.update.

## Resultado em 21/10/2026

- `workloadScaling=true` no laboratório. Menu e detalhe do serviço abrem o drawer sem mudar URL/environment. Escala atual é congelada durante o rascunho; schema, recurso e escala são relidos antes do PUT parcial. Flags e schemas somente de leitura não expõem o comando. Serviços globais e estados transitórios não são oferecidos.
- Build Linux aprovado: **243 testes em 29 arquivos + TypeScript/Vite**. Quinze regressões específicas cobrem capacidades, limites, valores vazios/fracionários, zero, conflito, escopo, payload somente scale e confirmação.
- Fixture exclusiva `1st79` / serviço `1s105`: UI fez 2 para 1 para 0 para 2 com readback dos containers físicos, preservando imagem/rede. Zero sem checkbox não enviou a alteração. Outro cliente mudou 2 para 1 enquanto o painel mantinha rascunho 3; UI recusou e backend permaneceu em 1. Nova leitura/restauração chegou a 2 containers.
- Durante a última restauração o scheduler legado reiniciou; a UI manteve o estado transitório. O readback final passou sem relaxar os limites do helper. Isso não define SLA do RancherOS emulado nem garante disponibilidade do scheduler.
- PUT negado ao usuário sem acesso ao environment, sem grants novos. Flag off/on, tema claro/escuro e drawer 390x844 sem overflow conferidos por CUA. Relatório `console/service-scaling-browser-test-results.json`; readbacks em `console/unified-operation-test-results.json`.
- Capturas: `evidence/console-service-scale-{zero,conflict,light,mobile,disabled}.png`. Fixture 1st79/1s105 e instâncias foram removidas, com manifest ausente; host original e demais workloads permanecem. Validação de snapshot é proteção do cliente, não CAS atômico. Matrizes de múltiplos hosts, serviços globais e outros orquestradores continuam fora deste aceite.
