# Edição de portas/volumes via upgrade de serviço — plano

- Completar a experiência contextual existente: no drawer de upgrade, permitir opcionalmente editar portas e volumes do launchConfig principal reutilizando WorkloadBindingsEditor. Não alterar campos imutáveis por PUT nem exigir outra tela. Nova flag independente workloadConfigUpgrades, inicialmente false; desligada conserva o upgrade somente de imagem.
- Serviço Cattle comum, ativo/inativo, mesmo environment/stack. Sidecars seguem preservados, sem editor nesta etapa. Entradas avançadas opacas retidas exatamente, somente remoção explícita; regras e validação de duplicatas iguais à criação.
- Nova configuração pode manter a imagem se portas/volumes mudarem. Estratégia por lotes/intervalo/startFirst permanece nativa. Revisão explica publicação de portas, substituição de containers e risco de perda de dados por mudança de montagem. Nenhum autosave.
- Antes do POST upgrade: reler recurso e contratos atuais, validar escopo/ação e snapshot de imagem/ports/dataVolumes/sidecars; detectar edição externa nesses campos. Outros campos frescos devem ser preservados pelo domínio. Não prometer CAS atômico nem preservação de conteúdo de volumes após reconfiguração.
- Gates: domínio/validação/entrada opaca/concorrência, formulário/revisão/flags, build; fixture exclusiva escala zero sem portas físicas e fluxo nativo upgrade/finish/rollback/readback; browser teclado/temas/mobile/flag e negação readonly. Tráfego, montagem física e disponibilidade real exigem prova separada.

## Aceite implementado — 22/10/2026

`modules.workloadConfigUpgrades=true`. Upgrade de portas/volumes no mesmo drawer de stacks, com reutilização de linhas da criação e confirmação de impacto. Pode manter a imagem quando bindings mudam. Cinco contratos frescos, recurso relido e snapshot de imagem/portas/volumes/sidecars antes do POST. Demais campos frescos são preservados pelo payload nativo; não há PUT de launchConfig imutável.

11 casos adicionais de domínio/formulário aprovados: imagem mantida, ambiente fresco preservado, conflitos de imagem/ports/volumes, troca de escopo/estado/contrato, duplicatas, entrada opaca retida, no-op recusado, revisão e flag. Um caso adicional corrigiu o parser compartilhado para volume anônimo `/data:ro`/`rw`, sintaxe reconhecida no fonte InstanceVolumeLookupPreCreate; duplicatas continuam detectadas. Total do build: **395 testes/46 arquivos + TypeScript/Vite**.

11 checks de navegador real aprovados: quatro combinações claro/escuro ×1440/390 sem axe/overflow e descarte; upgrade/readback mantendo imagem; variáveis/comando/networkMode/sidecars/escala preservados; busca/environment/rota preservados; rollback restaurou ports/dataVolumes; segundo upgrade e finish mantiveram configuração final; flag off mantém upgrade só de imagem; usuário sem environment recusado em POST com CSRF e payload válidos.

Fixtures descartáveis 1st88/1s118 e repetição 1st89/1s119 removidas. Hashes das configurações dos serviços anteriores e inventário de volumes preservados. Zero containers agendados, escala zero. Relatórios `console/config-upgrade-e2e-results.json`, `config-upgrade-a11y-results.json`, `config-upgrade-cleanup-results.json`; manifest ausente. **Não houve prova de tráfego físico, montagem real, disponibilidade durante rollout nem conteúdo persistente de volumes.**
