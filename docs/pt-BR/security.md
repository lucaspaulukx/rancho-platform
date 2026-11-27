# Segurança e estado de release

[Português (Brasil)](security.md) | [English](../../SECURITY.md)

O projeto estende um runtime legado Rancher1.6. Não há certificação para produção. Gates abertos de segurança e recuperação estão em [roadmap](roadmap.md).

Reporte suspeitas de vulnerabilidade pelo [formulário privado do GitHub](https://github.com/lucaspaulukx/rancho-platform/security/advisories/new). Mantenha credenciais, dumps, certificados, tokens e dados de clientes fora de issues e pull requests públicos.

Credenciais locais são geradas em arquivos ignorados. Mantenha backups criptografados fora do Git, teste a restauração e retenha imagem/configuração originais antes de qualquer migração. Nunca execute dois engines Rancher sobre o mesmo banco.

O compose moderno habilita redação opcional de credenciais da auditoria após aceite físico local. Registros existentes podem conter capacidades válidas ou expiradas: a projeção da API é redigida enquanto a flag está ligada, mas histórico armazenado e backups não são reescritos. Desligar a flag ou voltar para artefato anterior pode expor os valores novamente. Revise retenção e um plano de saneamento no escopo antes de distribuir banco restaurado. Veja [modelo de segurança](security-model.md); vida útil de streams de API keys e aceite final de segurança continuam abertos.

## O que incluir em um relato privado

Informe a revisão ou o digest da imagem do Rancho Platform, o perfil de implantação, o horário aproximado em UTC, o papel do usuário, os passos e os resultados esperados e observados. Inclua apenas as evidências sanitizadas essenciais para reproduzir o problema. Se a reprodução com dados descartáveis for inviável, descreva as condições e compartilhe qualquer material adicional somente no relato privado.

Por exemplo, relate que um usuário de leitura restrito ao ambiente sintético RBAC-DEV tentou listar as stacks em RBAC-PROD. O resultado esperado era HTTP 403 ou 404. Registre o código real e se houve exposição, omitindo os dados expostos. [Matriz de testes de autorização](security-model.md#exercite-as-permissões-em-laboratório)
