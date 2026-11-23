# Criação de serviços e containers por seções

## Resultado posterior — 22/10/2026

Implementado e conferido no recorte abaixo. modules.workloadCreationSections=true no laboratório. SchemaForm/EditorField reutilizados: identificação e container abertos; rede/recursos/armazenamento/agendamento/segurança recolhíveis, salvo campos obrigatórios. Opções desconhecidas permanecem no bloco avançado. LaunchConfig de service usa a mesma organização, sem repetir stack/startOnCreate já controlados pela raiz. Rótulos comuns traduzidos; valores de environment mascarados também no adaptador genérico, como correção de privacidade independente do layout.

Cinco regressões novas: particionamento sem perda/duplicação de campos, zero/false/arrays/mapas, campos revogados e schema aninhado ausente, objetos em arrays e fluxo de formulário com valores privados. Build Linux aprovado: **271 testes/32 arquivos + TypeScript/Vite**. Schema completo é relido antes de criar; campo não criável, schema ausente ou revogado bloqueiam o POST em vez de serem descartados silenciosamente.

Aceite CUA em stack console-form-ec538c24 (1st83): serviço 1s109 e container 1i912 criados com Alpine 3.20, command [sleep,3600], variável MESSAGE UTF-8, memória 33554432 bytes, networkMode host e privileged false. Serviço permaneceu inativo/escala zero/sem instâncias; container com start desmarcado ficou stopped. Conta sem environment teve ambas as criações negadas. Isso prova configuração/estado nativos, sem ensaio de execução dessas duas fixtures.

Sete checks de browser em console/workload-creation-browser-test-results.json; readbacks em console/workload-creation-test-results.json. Capturas console-workload-create-{service-dark,container-dark,mobile,light}.png em evidence/. Claro/escuro, 390px sem overflow, fallback de flag e proteção de descarte conferidos. Ao finalizar, o cleanup encontrou o laboratório inteiro parado (exit 255); retomados apenas os containers existentes e reposta a configuração privada já autorizada na VM original. O cleanup final deve ser confirmado no relatório/manifest antes de encerrar o aceite.

O planejamento original abaixo foi superado pela implementação deste recorte. Formulários específicos de LB, editores visuais de portas/volumes e todas as opções de segurança continuam pendentes.

## Plano — 22/10/2026

1. Introduzir modules.workloadCreationSections, inicialmente false. Usar somente na criação de service/container pelo drawer da operação; desligar recupera a apresentação genérica. Não alterar edição/upgrade existentes ou frontend clássico.
2. Reutilizar SchemaForm/EditorField e o contrato nativo, organizando campos em identificação, container, rede, recursos, armazenamento, agendamento e segurança. launchConfig recebe a mesma organização. Campos desconhecidos ficam disponíveis em opções avançadas; campos obrigatórios permanecem visíveis.
3. Preservar defaults/tipos, números zero, booleanos false, argumentos de comando como arrays, mapas e referências. Variáveis de ambiente devem ter seus valores mascarados no editor. Nenhuma conversão de shell, MiB/bytes ou redes será feita implicitamente.
4. Revalidar schemas criáveis, incluindo campos aninhados, antes de POST; recusar campo removido/revogado, troca de contexto e stack indisponível. Não guardar credenciais em query cache ou preferências.
5. Testar particionamento sem perda de campos, payload nativo/valores extremos e revogação aninhada; build Linux; aceite no navegador com fixture exclusiva, readback real de service/container, flags, temas/mobile e cleanup.

## Limites

Esta entrega reorganiza criação baseada nos schemas e melhora a navegação dos campos. Não representa formulário específico completo de LB, editor visual de portas/volumes, configuração de todos os drivers, ou aceite de todas as opções de segurança. Recursos privilegiados não serão criados para conferir aparência. Edição de workloads existentes continua no adaptador já entregue, com seus limites documentados.

## Situação

Planejado; sem implementação ou gate deste fluxo neste checkpoint.


## Cleanup confirmado

Após retomar os containers existentes, o helper removeu exatamente stack 1st83, serviço 1s109 e container 1i912. Manifest ausente; 7 checks nativos passed. Não houve remoção de volumes nem recursos de outros projetos.
