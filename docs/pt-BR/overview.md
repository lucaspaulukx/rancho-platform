# Rancho Platform

[Português (Brasil)](overview.md) | [English](../../README.md)

Console moderna independente e extensões opcionais de grupos locais/OIDC para Rancher1.6 Docker/Cattle. Preserve identidade Rancher e autorização do backend, operando stacks, serviços e containers no mesmo workspace contextual.

O projeto está em desenvolvimento e o repositório permanece privado na preparação. Não é release oficial do Rancher nem certificação produtiva. Veja capacidades e aceites restantes no [roadmap](roadmap.md).

## Documentação

Escolha idioma por guia: [English](../en/README.md) · [Português (Brasil)](README.md).

Comece por [arquitetura](architecture.md), [contribuição](contributing.md), [configuração](configuration.md), [testes](testing.md) e [migração](migration.md). O reporte está em [segurança](security.md).

## Build

Requisitos: Git, Python3.10+, Node24 e Docker Linux para backend/laboratório. O bootstrap opcional usa PowerShell7.

```sh
git clone https://github.com/lucaspaulukx/rancho-platform.git
cd rancho-platform
python scripts/upstream.py apply
cd console
npm ci
npm test
npm run build
```

Fontes oficiais são pinados em `upstream.json`; mudanças ficam em `patches/`. Checkouts ignorados são entradas geradas de build, não repositórios de consulta incorporados. Ember original não é necessário ao build do frontend.

## Laboratório local opcional

```powershell
./Start-Lab.ps1 -PlanOnly
./Start-Lab.ps1
```

Revise o plano e as [fronteiras de migração/recuperação](migration.md). Credenciais/realm existentes são preservados; credenciais geradas ficam no `.env` ignorado. Não conecte laboratório descartável a dados ou agentes produtivos.

- Console moderna: http://localhost:18090/console/
- Rancher clássico: http://localhost:18080/
- Keycloak local: http://localhost:18081/

Veja o [guia da console](console.md) para desenvolvimento e [recuperação](recovery.md) para manutenção. Build do frontend não prova efeitos físicos ou migração completa.

## Contribuição e licença

Use branches focadas, validação pertinente e PRs revisáveis. [AGENTS.md](../../AGENTS.md) e a skill opcional oferecem orientação comum para IA; essas ferramentas não são obrigatórias. Atualize os dois idiomas ao mudar comportamento.

Apache-2.0; preserve [LICENSE](../../LICENSE), [NOTICE](../../NOTICE), atribuição Rancher e avisos de dependências. Revisão de dependências/licenças/segurança e publicação são [gates de release](release.md) separados. Não versione secrets, dumps, realms privados, estado de fixtures ou evidências de sessão.
