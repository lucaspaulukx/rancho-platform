# 49 — Upgrade de memória/reserva

Plano: flag workloadResourceUpgrades independente da criação. Opt-in no drawer existente, MemoryEditor comum, schema/snapshot completo atuais, imagem igual permitida quando memória muda, preservar todo restante. Enviar zero explícito para retirar limite/reserva (omissão não comprova remoção). Revisão/rollback/finish nativos, sem PUT de launchConfig ativo. Testar limites/conflito/no-op/flag e persistência com serviço escala0; efeito físico do upgrade separado do aceite de criação47.

Estado: habilitado após aceite integrado.


Implementação: MemoryEditor reutilizado no opt-in, DTO editResources explícito e flag verificada novamente em ResourcePanel. Payload atualiza apenas memory/memoryReservation e permite imagem igual; snapshot de launchConfig e sidecars completo. Contrato exige campos create int/long no schema fresco. Vazio não significa remover; usar zero, preservando configuração anterior até confirmar. Teste de domínio cobre payload/preservação/limite-reserva/no-op/schema ausente e conflito.

Gate de fonte566 testes/65 arquivos + TypeScript/Vite. Aceite integrado usa config_upgrade_fixture.py e e2e/run.py resource-upgrade; quatro cenários de tema/tamanho com axe/layout, imagem/bindings/env/comando/rede/escala preservados, rollback, finish e zero persistido. Aceite final14 checks/quatro cenários de tema-tamanho e cleanup aprovado: fixture1st119/1s151 removida, configurações e volumes anteriores preservados, sem instâncias. Flag workloadResourceUpgrades=true. Relatórios resource-upgrade-*-results.json e config-upgrade-cleanup-results.json. Memória do Docker em criação já tem prova47; upgrade físico permanece distinto.
