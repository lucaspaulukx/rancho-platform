# 70 — Retirar overrides de CPU/I/O fisicamente

OPS11 após66: testar o reset que já passou no formulário/contrato. Uma stack e serviço próprios no host original, sem rede gerenciada, preservando memória128MiB/readOnly=true/privileged=false. Configuração inicial com reserva250/peso derivado256, período100000/quota50000, CPU0 e IO100. Reset explícito para reserva0/peso0/período0/quota-1/cpuset vazio/IO0.

Conferir HostConfig e controllers: agente Cattle aplica peso mínimo2; período volta a100000µs, quota a-1, CPUs herdadas do cpuset do host e peso de I/O ao default500. [Docker documenta período100ms e peso padrão500](https://docs.docker.com/engine/containers/run/); conferir o efeito real no guest, sem afirmar valores portáveis a outros kernels. Memória/segurança/imagem não editadas devem permanecer iguais. Rollback restaura overrides originais e novo reset/finish mantém defaults.

API nativa direta18080 para não depender de reinício da console. Guardar somente IDs, hashes e campos numéricos/cgroup selecionados; remover stack/container próprios e comparar baseline. Opcionalmente repetir probe69 enquanto fixture estiver ativa, registrando sobreposição e sem capturar frames. Isso não substitui teste do scheduler dentro do guest, soak, carga de CPU ou throughput de I/O. Gate pendente até execução e cleanup concluídos.

Aceite:7 checks passaram. Reset efetivo para shares2, periodo do HostConfig0/controller100000, quota-1, cpuset vazio no HostConfig/CPUs herdadas no controller e IO0/controller500; rollback restaurou valores iniciais, novo reset/finish manteve defaults. Memoria/seguranca preservadas; stack/container removidos, baseline intacto e manifesto ausente. physical-cpu-reset-results.json.
