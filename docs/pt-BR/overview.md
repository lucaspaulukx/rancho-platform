# Rancho Platform

<p align="center"><img src="../../console/public/brand/rancho-platform.png" width="420" alt="Rancho Platform"></p>

**Um console moderno para Docker/Cattle, baseado no Rancher 1.6.30.** Gerencie containers no contexto da stack e do ambiente, com logs, terminal, métricas e ações ao alcance.

**Escolha o idioma da documentação** · [🇧🇷 Português (Brasil)](overview.md) · [🇺🇸 English](../../README.md)

[![Pré-release](https://img.shields.io/github/v/release/lucaspaulukx/rancho-platform?include_prereleases)](https://github.com/lucaspaulukx/rancho-platform/releases)
[![CI do console](https://github.com/lucaspaulukx/rancho-platform/actions/workflows/console-validation.yml/badge.svg?branch=main)](https://github.com/lucaspaulukx/rancho-platform/actions/workflows/console-validation.yml)
[![Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-2563eb)](../../LICENSE)

## Sumário

- [O que você pode fazer](#o-que-você-pode-fazer)
- [Instale com Docker Compose](#instale-com-docker-compose)
- [Verifique o primeiro login](#verifique-o-primeiro-login)
- [Compatibilidade e segurança](#compatibilidade-e-segurança)
- [Documentação](#documentação)

![Console do Rancho em português mostrando ambientes, stacks e ações de serviços](../images/guide-workloads-pt-BR.png)

*O console em português mostra o ambiente sintético `UI-OPS-LAB` com o seletor de idiomas distribuído. A stack `documentation-demo` está expandida e seu serviço `web` está em escala 0. [Veja o ensaio separado de migração](migration-evidence.md).*

## O que você pode fazer

- **Operar workloads.** Navegue por ambientes, stacks, serviços e containers. Abra logs, terminal e métricas ou execute as ações disponíveis na mesma tela.
- **Controlar o acesso.** Gerencie grupos locais e conceda permissões por ambiente. Conecte um provedor OIDC existente para o login. Novos usuários sem permissões veem uma mensagem de acesso.
- **Ensaiar uma migração.** Verifique o banco de origem, faça um backup criptografado e teste a restauração e o rollback em uma cópia isolada.

## Instale com Docker Compose

Escolha uma [release publicada](https://github.com/lucaspaulukx/rancho-platform/releases) que liste os digests das imagens no registry. O início rápido usa Linux amd64, um servidor Rancho, MariaDB 10.11, Docker Compose v2 e Python 3.10+ para criar o primeiro administrador. A [prévia v0.1.0](https://github.com/lucaspaulukx/rancho-platform-archive/releases/tag/v0.1.0) permanece disponível no repositório arquivado.

1. Defina `RANCHO_TAG` com a tag publicada que você escolheu e faça checkout dessa tag.

   ```sh
   git clone --branch "$RANCHO_TAG" --depth 1 https://github.com/lucaspaulukx/rancho-platform.git rancho-platform
   cd rancho-platform
   ```

2. Na raiz do repositório, crie um arquivo `.env` privado. Defina `RANCHO_VERSION` com a versão escolhida sem o `v` inicial e `RANCHO_DB_PASSWORD` com uma senha forte e exclusiva. Confira as imagens resolvidas antes de baixá-las e subir os serviços.

   ```sh
   docker compose -f compose.modern.yaml -f compose.registry.yaml config --images
   docker compose -f compose.modern.yaml -f compose.registry.yaml pull
   docker compose -f compose.modern.yaml -f compose.registry.yaml up -d --wait --no-build
   ```

3. Em um **banco novo**, crie o primeiro administrador local. O script pede a senha. Depois, abra o [console local](http://localhost:18090/console/).

   ```sh
   python3 scripts/bootstrap_admin.py --origin http://localhost:18090 --username admin
   ```

[Fixe as imagens por digest](release.md#instalar-imagens-prontas-de-uma-release) ou [configure um provedor OIDC](configuration.md#provedor-openid-connect-externo). Se você já usa Rancher 1.6, comece pelo [guia de migração](migration.md) e use o administrador do banco restaurado.

## Verifique o primeiro login

1. Execute `docker compose -f compose.modern.yaml -f compose.registry.yaml ps` no clone. Confira se `db` e `rancho` estão saudáveis e se `console` está em execução com a porta 18090 no endereço de loopback.
2. Entre com o administrador local que você acabou de configurar. Abra **Ambientes** e selecione um ao qual tenha acesso. Abra **Stacks** e confirme se o cabeçalho ainda mostra o ambiente selecionado.
3. Se o ambiente estiver vazio, a tela não mostra workloads. Se houver uma stack, expanda um serviço e abra seu menu **…** para ver as ações disponíveis para aquele recurso. Compare a hierarquia com a captura de demonstração acima.

Use o [guia de configuração](configuration.md) para ajustar o console e o [guia de testes](testing.md) para montar um laboratório com workloads sintéticos.

## Compatibilidade e segurança

O perfil validado usa Linux amd64, um servidor e hosts Cattle com Docker 29. O [roadmap](roadmap.md) acompanha o aceite de alta disponibilidade e da atualização direta de stacks IPsec existentes.

A varredura da candidata à v0.1.0 reportou **zero achados altos ou críticos e zero segredos detectados** nas 13 imagens publicadas com a base Trivy usada no teste. O [roadmap de segurança](roadmap.md#segurança-das-imagens-para-a-beta) registra as varreduras anteriores, incluindo 30 achados críticos e 88 altos na base legada do backend. Para reportar uma vulnerabilidade, siga a [política de segurança](security.md).

## Documentação

| Quero… | Consulte |
|---|---|
| Instalar e verificar imagens de uma release | [Guia de release](release.md) · [Imagens no GHCR](https://github.com/users/lucaspaulukx/packages/container/package/rancho-platform) |
| Migrar uma instalação existente do Rancher | [Migração](migration.md) · [Recuperação](recovery.md) |
| Configurar OIDC, permissões ou o console | [Configuração](configuration.md) |
| Verificar a tela de workloads e a navegação por teclado | [Boas práticas de frontend](ui-guidelines.md#ensaie-uma-mudança-na-tela-de-workloads) |
| Conhecer o projeto ou contribuir | [Arquitetura](architecture.md) · [Contribuição](contributing.md) · [Testes](testing.md) |

[Índice em português](README.md) · [English documentation index](../en/README.md)

<details>
<summary>Compilar e testar o frontend</summary>

Com Node 24 instalado, execute:

```sh
cd console
npm ci
npm test
npm run build
```

Para testar o backend ou comparar com o Rancher clássico, consulte o [guia de testes em ambiente isolado](testing.md).

</details>

O Rancho Platform é um projeto comunitário independente. O Rancher e seus contribuidores recebem o crédito pela plataforma original. [Licença Apache-2.0](../../LICENSE) · [Avisos de licença](../../NOTICE)
