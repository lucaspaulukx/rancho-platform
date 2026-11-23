# Editores de portas e volumes de workloads

## Plano — 22/10/2026

1. `modules.workloadBindingEditors`, inicialmente false, somente na criação service/container do novo frontend. Depende de workloadCreationSections. False mantém os arrays nativos existentes; não modifica workloads ou dados.
2. Componentes compartilhados por lançamento de serviço e container avulso. Portas: porta do container, porta opcional do host, TCP/UDP, IP opcional com porta de host. Volumes Linux: destino absoluto, origem opcional (nome de volume ou caminho absoluto), acesso leitura/escrita ou somente leitura. Nenhuma navegação adicional.
3. Seguir os formatos nativos extraídos do frontend clássico (`form-ports`, parse-port): `80/tcp`, `8080:80/tcp`, `127.0.0.1:8080:80/tcp`, `[::1]:8080:80/tcp`; volumes `nome:/destino:ro`, `/origem:/destino:rw` e anônimo `/destino`. Não inferir publicação física ou disponibilidade de armazenamento pelo preenchimento.
4. Preservar literalmente entradas recebidas que não foram alteradas. Faixas, formatos Windows, modos de volume avançados e demais strings não suportadas aparecem como entradas nativas preservadas; não converter automaticamente. Remoção exige ação explícita na linha. Alterar uma linha simples não apaga as avançadas.
5. IDs estáveis por linha, labels acessíveis, layout compartilhado/responsivo, botões de adicionar/remover, validação no envio do formulário e indicação das entradas preservadas. Valores incompletos não podem ser descartados silenciosamente nem permitir um POST inválido. Limite 100 linhas por campo.
6. Validar porta inteira 1–65535, IP literal IPv4/IPv6, colisões de publicação e destinos de volume duplicados, caminhos sem controles e formatos suportados. Readonly de volume anônimo permanece fora do primeiro recorte; preservar configuração nativa recebida.
7. Testes de parser/serialização/preservação/erros e integração real com SchemaForm para service/container e flag desligada. Build Linux, readback nativo de fixture inativa/escala zero e cleanup exclusivo. Gates visuais e montagem/publicação física separados; não ativar antes do aceite visual.

## Situação

Implementado e `modules.workloadBindingEditors=true` após 22 unitários/integrações de formulário, 10 checks de API e E2E real. O formulário produz os mesmos formatos nativos; entradas opacas recebidas permanecem literais até remoção explícita, e linhas incompletas bloqueiam o envio.

Native fixture `console-bindings-74b6d3a0`: stack 1st85/service 1s112/container 1i914; configuração TCP/UDP/IPv4 e volumes de serviço/container read back, ambos inativos/escala zero ou stopped. Negativas sem environment passaram. Recursos removidos, manifest ausente e inventário de volumes anterior preservado. Não comprova publicação ou montagem física.

E2E criou 1s117 através da UI em stack exclusiva 1st87: `127.0.0.1:18089:8080/tcp` e `/tmp:/fixture:ro`, serviço inativo/escala zero, readback nativo e cleanup. Flag off restaurou textarea. Matriz de preview testou quatro combinações claro/escuro × desktop/390 px com zero writes de negócio, axe sem violações automatizadas, descarte e foco sem recorte pelo footer. Gate global: 319 testes/36 arquivos + TypeScript/Vite.

Relatórios `workload-bindings-test-results.json`, `context-editors-e2e-results.json`, `binding-form-themes-results.json`. Suítes em `console/tests/e2e/` usam contexto isolado. Controle dinâmico de mounts, edição/upgrade de volumes existentes, publicação física e todos os formatos avançados continuam fora deste recorte.
