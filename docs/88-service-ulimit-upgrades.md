# 88 — Upgrade contextual de limites de processo

Plano de05/11/2026, antes da implementação; complementa87. Nenhum aceite de upgrade é inferido da criação.

## Contrato e experiência

Ulimits é imutável no container original: a edição de um serviço usa o serviceUpgrade nativo, preservando imagem/configuração/sidecars e substituindo instâncias conforme a estratégia revisada. Não expor PUT impossível para um container avulso. Usar o editor87 no drawer atual, com checkbox explícito de inclusão nesta atualização e revisão compartilhada.

Flag aditiva modules.workloadUlimitUpgrades=false quando ausente, independente da criação. A flag é revalidada no submit e na ação. Reconsultar schema ulimit, launchConfig, serviço e upgrade; snapshot completo before/fresh bloqueia alterações concorrentes antes do POST, sem alegar CAS atômico no servidor. Nenhum valor é enviado quando a edição não está selecionada. Arrays vazios só representam reset depois de comprovação nativa; não converter dado legado desconhecido em vazio.

Metadado nativo type=ulimit pode ser removido explicitamente da projeção editável; outras propriedades/formatos desconhecidos bloqueiam edição para não haver perda silenciosa. Limites mantêm inteiro de32 bits, nomes conhecidos, unicidade e relação soft/hard de87. Rejeitar no-op e conservar rascunho após erro de schema/conflito. Configuração de sidecars só muda por seu editor específico.

## Tasks e gates

1. Projeção editável, validação e payload nativo com testes de flags, snapshot concorrente, valores legados, limites, no-op, preservação de sidecars/configuração e reset.
2. Checkbox/editor/revisão no drawer compartilhado; contrato off sem operação nova, keyboard/dirty state e revalidação de permissões.
3. Linux unitários/TypeScript/Vite; serviço próprio escala0 para upgrade, rollback, finish e reset persistidos, sem instâncias inesperadas.
4. Fixture física própria confirma novos limites em Docker/processo; rollback/finish/reset e preservação de dados, controle de acesso e cleanup. Alocação90s com desvio temporário85 é evidência separada de estabilidade CNI nativa. Não ampliar timeouts nem tocar workloads anteriores.
5. Documentar limites, atualizar roadmap e PR da entrega. Manter flag pública off até os gates respectivos; demais opções de recursos/dispositivos e multi-host continuam separados.
