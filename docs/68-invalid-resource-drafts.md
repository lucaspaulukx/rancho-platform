# 68 — Primeira entrada inválida também é rascunho

UX02: ao digitar um valor inválido como primeira alteração em memória/CPU, o editor guardava o texto localmente, mas não atualizava o rascunho do formulário. O guard de descarte podia considerar que nada mudou. A correção conserva o texto inválido somente no rascunho em memória, mantém customValidity/aria-invalid e a validação do payload, sem arredondar nem enviar para API/caches/storage.

CpuResourceEditor e MemoryEditor usam a mesma regra sob workloadResourceEditors; no upgrade o opt-in/guard existente permanece. Dois testes no SchemaForm real comprovam primeira entrada inválida, dirty=true e bloqueio de submit. Build595 testes/70 arquivos + TypeScript/Vite passou. Prova de navegador deve confirmar cancelamento do descarte mantém texto e confirmação descarta, em serviço/container e nos dois editores; nenhuma criação de recurso real necessária. Não alterar aparência dos modais compartilhados ou inserir outra tela.

Aceite navegador: quatro fluxos servico/container x CPU/memoria passaram. Primeira edicao x invalida dispara Descartar rascunho; cancelar descarte conserva x e confirmar remove o formulario. Nenhuma escrita de negocio nem erro JS; resource-draft-preview-results.json. Imagem595/70 implantada.
