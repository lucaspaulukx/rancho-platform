# Como contribuir com o Rancho Platform

[Português (Brasil)](contributing.md) | [English](../../CONTRIBUTING.md)

Rancho é uma iniciativa independente da comunidade para Rancher 1.6 Docker/Cattle. O repositório está privado e o roadmap não foi concluído. Preparar um PR não autoriza publicação pública, mudanças em produção ou merge.

## Comece pelo escopo vigente

Leia a task pertinente do [roadmap](roadmap.md), a [arquitetura](architecture.md) e o [guia de testes](testing.md). Defina um gatilho concreto e o resultado esperado; separe mudanças não relacionadas. Sem acesso de escrita, solicite acesso enquanto o repositório estiver privado ou use fork quando a contribuição pública estiver disponível.

Requisitos: Git, Python 3, Node 24 e Docker com containers Linux para trabalho de laboratório/backend. O bootstrap usa PowerShell 7. Instale somente as ferramentas pertinentes à mudança.

```sh
git clone https://github.com/lucaspaulukx/rancho-platform.git
cd rancho-platform
git fetch origin
git switch -c feat/my-change origin/main
git config core.hooksPath .githooks
python scripts/upstream.py apply
cd console
npm ci
```

Preserve alterações e credenciais existentes. Use outro checkout quando necessário; não resete ou exclua um laboratório para obter um teste aprovado. Antes de inicializar, confira `Start-Lab.ps1 -PlanOnly` e o guia de migração. Não conecte os testes a dados ou agentes de produção.

## Boas práticas de implementação

- Mantenha a UI nova em `console/`, sem alterar o Ember clássico. Reuse shell, navegação, tokens de tema, campos, tabelas, menus e drawers. Preserve o contexto environment/stack/serviço/container e a atribuição ao Rancher junto da identidade Rancho.
- Schemas/ações atuais dos recursos e permissões do backend são a fonte de verdade. Revalide escopo/contrato antes de mutações. Visibilidade de menu e flags não concedem autorização. Preserve rascunhos em erros e dados desconhecidos; snapshots clientes não são CAS atômico no servidor.
- Comportamento novo precisa de defaults, caminho off, dependências e documentação de rollback/compatibilidade. Flags aditivas ficam off quando ausentes. Não migre grants diretos, habilite acesso de novos usuários ou altere workloads existentes silenciosamente.
- Não exponha secrets no código, armazenamento do navegador, screenshots, logs ou PRs. Não versione `.env`, realms, dumps, manifestos de fixtures, capturas de sessão, dependências ou evidências geradas. Relatórios contêm checks/contagens sanitizados, sem payloads ou tokens.
- No backend, edite os checkouts oficiais pinados, execute os contratos pertinentes e depois `python scripts/upstream.py export` e `python scripts/upstream.py check`. Versione patches/testes/docs, não clones de consulta. Preserve licenças e NOTICE; revisão final de licenças/segurança permanece um gate de release.

## Validação e documentação

Dentro de `console/`, execute os checks pertinentes:

```sh
npm test
npm run build
npm run format:check
```

Durante a implementação, use testes direcionados relevantes; quando a mudança estiver pronta, execute o gate completo exigido. Evite testes que apenas repetem a implementação e repetições completas desnecessárias. Mock de UI, build aprovado ou CI de fontes não provam tráfego nativo, efeitos Docker, autorização real, HA ou recuperação. Para alegar efeitos de runtime, use fixtures próprias no sandbox, com marcadores explícitos, controles positivos/negativos e limpeza exata; confira a preservação das configurações/dados anteriores. Registre honestamente falhas e casos não testados.

Atualize juntos os documentos afetados em pt-BR e inglês quando ambos existirem. Preserve literalmente comandos, flags, identificadores de API e evidências registradas. Não chame resumo de tradução integral nem marque tradução desatualizada como revisada. O inventário e a revisão estão no [guia documental](documentation.md); todos os guias ativos precisam estar cobertos antes da publicação.

## Commits e revisão

Use branch focada `feat/`, `fix/`, `test/`, `docs/` ou `ci/` e commits descritivos. Selecione caminhos explicitamente e revise o diff. Preserve o histórico; não faça force-push em branch compartilhada nem squash de trabalhos sem relação.

Na raiz do repositório:

```sh
python scripts/check_repository.py
python scripts/check_public_history.py
git diff --cached --check
```

O primeiro scanner confere o índice; o segundo confere o histórico alcançável. Política privada/credenciais conhecidas existem somente no laboratório do mantenedor. Eles não substituem auditoria completa de secrets/licenças. Hooks podem ser ignorados pelo Git e não são limite de autorização.

Envie a branch/abra o PR dentro da autorização vigente. Normalmente use `main`; em trabalho encadeado, indique o PR pai e use sua branch como base até a revisão da integração. Use o template e explique:

1. Problema concreto e comportamento resultante.
2. Escopo, task do roadmap, flags/defaults e compatibilidade.
3. Comandos, resultados reais e limites da evidência: unitário/build/browser/nativo/CI remoto.
4. Documentos pt-BR/inglês alterados e traduções restantes.
5. Riscos, casos não testados, impacto de migração, recuperação/rollback e dependências de outros PRs.

Para texto multilinha, escreva um arquivo local e use `gh pr create --body-file`, sem montar escapes no shell. Não inclua dados privados nesse arquivo. A pessoa revisora deve avaliar o resultado sem ler o chat. Mantenha título/body alinhados à implementação final. Não faça merge automático, altere visibilidade ou publique release só porque os checks passaram.

Substitua caminho/branch do exemplo e preencha o body local com os resultados reais. O exemplo PowerShell usa a versão7. Se preferir a interface web do GitHub, crie o PR a partir da branch enviada, confira a base e preencha o mesmo template. Veja o [guia oficial de PRs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).

```sh
git status --short
git diff
git add -- path/to/changed-file
git diff --cached
python scripts/check_repository.py
python scripts/check_public_history.py
git diff --cached --check
git commit -m "Describe the actual change"
git push -u origin feat/my-change
```

```powershell
$prBodyPath = git rev-parse --git-path PR-body.md
@'
Describe the behavior, tests, limits and rollback.
'@ | Set-Content -LiteralPath $prBodyPath -Encoding utf8NoBOM
gh pr create --repo lucaspaulukx/rancho-platform --base main --head feat/my-change --title "Describe the actual change" --body-file $prBodyPath
```

## Contribuições assistidas por IA

Use [AGENTS.md](../../AGENTS.md) como orientação compartilhada. Adapters de Claude, Gemini, Copilot e Cursor apontam para esse arquivo. A [skill rancho-contribute](../../.agents/skills/rancho-contribute/SKILL.md) é opcional e ajuda a preparar mudanças no escopo e PRs revisáveis; não autentica contas nem autoriza ações externas. Quem contribui continua responsável por conferir código gerado, alegações, licenças e validação. Ferramentas de IA são opcionais; contribuições comuns por Git seguem o mesmo processo.

A integração varia conforme o cliente; consulte a documentação oficial de [Claude](https://code.claude.com/docs/en/memory), [Gemini CLI](https://geminicli.com/docs/cli/gemini-md/), [GitHub Copilot](https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions?tool=vscode) e [Cursor](https://prod.cursor.com/docs/rules). Confira se a ferramenta realmente leu as instruções do repositório; fornecer os arquivos não prova a configuração de todos os clientes.
