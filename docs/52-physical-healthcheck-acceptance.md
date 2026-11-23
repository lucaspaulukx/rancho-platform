# 52 — Healthcheck físico e recuperação

Plano OPS06 após serviços nativos saudáveis: stack/serviço exclusivos com HTTP BusyBox, rede managed e healthcheck HTTP nativo/recreate. Confirmar container healthy e resposta real; remover somente arquivo /www/health dentro do container próprio para provocar404, observar substituição com ID Docker diferente e recuperação healthy. Sem interromper hosts ou workloads anteriores. Estratégia/quórum multi-host continua gate separado.

Registrar manifesto UUID/marker e baseline de configs/containers/volumes antes das mutações. Secrets/stream tokens/logs completos ficam privados. Schema nativo e grants não são alterados. Cleanup via stack remove e conferir recursos próprios removidos e estado anterior preservado. Não rodar ao mesmo tempo que outra fixture mutante com baseline global. Erros/timeouts não contam como aceite.

## Resultado23/10

Helper executado com sucesso:6 checks aprovados em physical-healthcheck-results.json. Infraestrutura pronta; serviço HTTP atingiu running/healthy no host original; remoção apenas de /www/health dentro do container próprio provocou falha; Rancher recriou a instância com DockerID diferente e recuperou healthy. Stack/container exclusivos removidos e hashes das configurações, lista de containers e volumes anteriores preservados. Manifesto physical-healthcheck-fixture.json excluído somente após cleanup validado.

Não equivale ao aceite de todas as estratégias: quórum/múltiplos hosts, TCP indisponível e upgrade físico ainda têm gates próprios. Não alterado healthcheck de workload anterior nem estado dos hosts. Instabilidade intermitente do scheduler da doc51 continua em aberto mesmo após este teste bem-sucedido.
