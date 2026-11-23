---
name: rancho-contribute
description: Prepare scoped Rancho Platform changes, validation and reviewable pull requests. Use for contributions to this repository, including frontend, backend patches, tests and bilingual docs; not for unrelated repositories or production operations.
---

# Contribute to Rancho

[English](#english) | [Português](#português)

## English

Read [AGENTS.md](../../../AGENTS.md) and the relevant [contribution guide](../../../CONTRIBUTING.md). Use the relevant current roadmap task, preserve the user's scope and continuing sandbox authorization, and inspect local changes before editing.

Implement a focused change using current native contracts and shared UI components. Keep new behavior gated with explicit off/compatibility behavior. Update affected pt-BR/English docs; record baseline translation gaps honestly. Choose checks that establish the actual claim: unit/build does not prove physical effects, live RBAC, migration or recovery. Use owned fixtures and exact cleanup for native tests; preserve failures and limits.

Review/stage explicit paths. Run staged-content and reachable-history checks from the repository root; backend changes also require patch export/check. Commit a coherent change with meaningful validation. When the user's task authorizes sending a PR, push the scoped branch and prepare its title/body using the template and a local body file. State behavior, tests, flags, limits, rollback and stacked dependencies. Verify the remote branch/PR; distinguish a running CI job from success. Do not infer merge, release, visibility change or production authorization.

Do not install global agent configuration, transmit credentials or require a particular AI provider. This skill is guidance for this repository, not additional access permission.

## Português

Leia [AGENTS.md](../../../AGENTS.md) e o [guia de contribuição](../../../docs/pt-BR/contributing.md). Use a task vigente do roadmap, preserve escopo e autorização sandbox contínua do usuário e confira alterações locais antes de editar.

Implemente uma mudança focada com contratos nativos atuais e UI compartilhada. Comportamento novo exige flag e caminho off/compatibilidade. Atualize documentos pt-BR/inglês afetados; registre lacunas da linha de base honestamente. Escolha checks que comprovem a alegação: unitário/build não prova efeitos físicos, RBAC real, migração ou recuperação. Use fixtures próprias e limpeza exata nos testes nativos; preserve falhas e limites.

Revise/selecione caminhos explicitamente. Execute checks de índice/histórico na raiz; mudanças backend também exigem export/check dos patches. Faça commit coerente com validação relevante. Quando a tarefa autorizar envio de PR, envie a branch no escopo e prepare título/body pelo template e arquivo local. Informe comportamento, testes, flags, limites, rollback e dependências. Confira branch/PR remoto; CI em execução não é sucesso. Não presuma autorização de merge, release, mudança de visibilidade ou produção.

Não instale configuração global de agentes, transmita credenciais ou exija um fornecedor de IA. A skill orienta contribuição neste repositório e não concede permissões adicionais.
