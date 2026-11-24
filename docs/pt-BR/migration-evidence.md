# Ensaio de migração com capturas de tela

<!-- rancho-language-navigation:start -->
[Português (Brasil)](migration-evidence.md) | [English](../en/migration-evidence.md)
<!-- rancho-language-navigation:end -->


As duas capturas mostram o mesmo environment sintético `Acme Production` antes e depois da restauração automática. A origem era Rancher 1.6.30 com MySQL 5.5. O destino usou o backend moderno do Rancho, MariaDB 10.11 e a nova Console.

## Antes no Rancher 1.6.30

[Veja a captura original do Rancher clássico com as stacks observability e storefront (English)](../images/migration-before.png).

## Depois no Rancho

![Console Rancho mostrando as stacks restauradas](../images/migration-after.png)

| Verificação | Antes | Depois |
|---|---|---|
| Environment | Acme Production | Acme Production, mesmo ID |
| Stacks de aplicação | observability, storefront | As mesmas duas stacks |
| Serviços | dashboard, metrics, database, web, worker | Os mesmos cinco serviços |
| Banco de dados | MySQL 5.5 original | Backup selado importado no MariaDB 10.11 |

As capturas mostram o inventário de aplicações. O ensaio visual usou apenas o servidor. No [ensaio separado com volume persistente](migration.md#ensaio-com-volume-persistente), o agente original reconectou após a migração do servidor. Depois de atualizar a VM para Docker 29 e substituir o agente, o Rancho recriou um container removido e o substituto leu os mesmos dados do volume.

A restauração automática também foi executada duas vezes com outro backup sintético. Na segunda inicialização, a imagem registrou `already-applied`, e o ID do environment e a data da migração de schema permaneceram iguais. [Passos da inicialização automática](migration.md#restauração-automática-no-primeiro-início)
