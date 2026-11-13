# Rancho Platform

[🇧🇷 Português (Brasil)](overview.md) · [🇺🇸 English](../../README.md)

[![Validação do console](https://github.com/lucaspaulukx/rancho-platform/actions/workflows/console-validation.yml/badge.svg?branch=main)](https://github.com/lucaspaulukx/rancho-platform/actions/workflows/console-validation.yml)
[![Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-2563eb)](../../LICENSE)
[![Alfa comunitária](https://img.shields.io/badge/status-alfa%20comunit%C3%A1ria-9a5b00)](https://github.com/lucaspaulukx/rancho-platform/releases)

Opere stacks, serviços e containers do Rancher 1.6 Docker/Cattle em uma só tela, com logs, terminal e métricas no contexto do workload.

[Releases](https://github.com/lucaspaulukx/rancho-platform/releases) · [Migração](migration.md) · [Roadmap](roadmap.md) · [Contribuição](contributing.md) · [Segurança](security.md)

> [!IMPORTANT]
> O Rancho é um projeto comunitário independente que usa o engine legado do Rancher 1.6. Use a versão alfa em laboratório isolado, com dados sintéticos ou uma cópia isolada. O aceite de produção segue em aberto.

## Evolução da segurança das imagens

Em 13 de novembro de 2026, o Trivy 0.74.0 encontrou as seguintes ocorrências críticas e altas em pacotes das imagens iniciais do laboratório e das candidatas posteriores.

| Imagem | Inicial críticas / altas | Candidata críticas / altas |
|---|---:|---:|
| Backend com base legada | 30 / 88 | 5 / 22 |
| Gateway da console | 3 / 73 | 0 / 0 |
| Keycloak opcional | 8 / 101 | 0 / 6 |

As contagens valem para as imagens analisadas e dependem da base de avisos. A base legada do backend chegou ao fim do suporte. O backend experimental de nó único com Ubuntu 24.04 apresenta **0 críticas / 3 altas** no scan. O [roadmap](roadmap.md) acompanha os achados restantes, o backend experimental e os critérios de aceite da beta.

## Funcionalidades

- **Operação de workloads** · Inspecione stacks e containers, abra streams e execute as ações disponíveis no Rancher sem sair da tela.
- **Gestão de acesso** · Conceda permissões por ambiente com grupos locais e, opcionalmente, entre com um provedor OIDC como o Keycloak.
- **Ensaio de migração** · Verifique o banco de origem, faça backup e ensaie restauração e rollback em isolamento. [Guia de migração](migration.md)

## Documentação

Escolha idioma por guia: [English](../en/README.md) · [Português (Brasil)](README.md).

Comece por [arquitetura](architecture.md), [contribuição](contributing.md), [configuração](configuration.md), [testes](testing.md) e [migração](migration.md). O reporte está em [segurança](security.md).

## Início rápido

```sh
git clone https://github.com/lucaspaulukx/rancho-platform.git
cd rancho-platform
git switch --detach v0.1.0-alpha.1
```

<details>
<summary>Compilar e testar o frontend</summary>

Para verificar o frontend, instale Git e Node 24. O laboratório de backend também requer Python 3.10+, Docker em modo Linux e PowerShell 7.

```sh
cd console
npm ci
npm test
npm run build
```

Fontes oficiais são pinados em `upstream.json`; mudanças ficam em `patches/`. Checkouts ignorados são entradas geradas de build, não repositórios de consulta incorporados. Ember original não é necessário ao build do frontend.

</details>

## Execute o laboratório local

```powershell
./Start-Lab.ps1 -PlanOnly
./Start-Lab.ps1
```

Revise o plano e as [fronteiras de migração/recuperação](migration.md). Credenciais/realm existentes são preservados; credenciais geradas ficam no `.env` ignorado. Não conecte laboratório descartável a dados ou agentes produtivos.

Em um laboratório descartável recém-criado, execute `python tests/integration.py` para inicializar a autenticação local e criar os exemplos de RBAC. Entre no console como `labadmin` com a senha `RANCHER_ADMIN_PASSWORD` do seu `.env` local.

- Console moderna: http://localhost:18090/console/
- Rancher clássico: http://localhost:18080/
- Keycloak local: http://localhost:18081/

Veja o [guia da console](console.md) para desenvolvimento e [recuperação](recovery.md) para manutenção. Build do frontend não prova efeitos físicos ou migração completa.

## Contribuição e licença

Use branches focadas, validação pertinente e PRs revisáveis. [AGENTS.md](../../AGENTS.md) e a skill opcional oferecem orientação comum para IA; essas ferramentas não são obrigatórias. Atualize os dois idiomas ao mudar comportamento.

Apache-2.0; preserve [LICENSE](../../LICENSE), [NOTICE](../../NOTICE), atribuição Rancher e avisos de dependências. Revisão de dependências/licenças/segurança e publicação são [gates de release](release.md) separados. Não versione secrets, dumps, realms privados, estado de fixtures ou evidências de sessão.
