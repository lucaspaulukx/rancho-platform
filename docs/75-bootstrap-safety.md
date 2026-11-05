# 75 — Bootstrap comunitário e preservação do laboratório

`Start-Lab.ps1 -PlanOnly` mostra apenas serviços e intenção de criar arquivos ausentes. Não lê/imprime credenciais, não executa Docker e não escreve arquivos. `-ClassicOnly` limita a composição inicial a Rancher/Keycloak; o padrão inclui a console moderna. Não é ferramenta de migração ou procedimento de reset.

Execução efetiva obtém/aplica o patch sobre fonte oficial fixa, valida a bridge dedicada e inicia a composição. `.env` só é criado se ausente; arquivo existente com variáveis obrigatórias ausentes causa erro, sem sobrescrita. `keycloak/realm.json` só é criado se ausente, copiando `realm.template.json`, cujos segredos são placeholders expandidos pelo Keycloak. Não rotaciona credenciais nem reimporta realm existente.

O template público registra callbacks18080 e18090 e exige PKCE S256; password grant permanece desativado. A assinatura comunitária e seus temas não dependem de arquivo visual externo. No primeiro laboratório, executar `python tests/integration.py` para inicializar/verificar autenticação e fixtures. O script não deve ser apontado a uma base de produção.

Validação atual:4 contratos de PowerShell/template passaram em diretórios temporários: plano moderno novo, preservação de bytes existentes, plano clássico e callbacks/PKCE/placeholders. Nenhum container, volume, realm ou `.env` do laboratório foi alterado por esses testes. Importação fresca completa em containers e instalação/upgrade/restore reproduzíveis continuam REL04; não contar PlanOnly como prova de instalação real.
