# Auditoria administrativa — plano e contrato

## Plano (22/10/2026)

- Módulo independente `modules.audit`, inicialmente desligado; acesso administrativo e AppShell comum. Consulta global nativa, com página limitada a 100 registros e avanço/retorno explícitos. Não carregar todo o histórico na memória.
- Filtros por tipo de recurso, evento e conta autenticada, aplicados no servidor. Busca da tabela limitada à página carregada e identificada como tal.
- Converter respostas em DTO por allowlist antes de entrar no query cache: id, data, tipo/evento, IDs de recurso/conta/identidade e código HTTP. Não manter requestObject, responseObject, description livre, links ou actions; podem conter credenciais e payloads arbitrários. Detalhe usa o mesmo DTO, sem endpoint genérico nem edição.
- Estados de carregamento/erro/vazio, atualização manual, cancelamento de requests na troca de filtro/identidade, teclado, temas e móvel. Desligar flag remove navegação e bloqueia URL direta. Original Ember preservado.
- Gates: testes de minimização, paginação/contrato, filtros e componente; build; browser real admin/leitor e matriz axe/layout; nenhuma escrita de negócio no aceite.

Contrato nativo conferido: `auditLog`, coleção auditlogs, somente GET; accountId/authType/authenticatedAsAccountId/authenticatedAsIdentityId/clientIp/created/description/eventType/resourceId/resourceType/responseCode/requestObject/responseObject. Descrição, IP e objetos brutos não fazem parte desta visualização. Não é a auditoria de revisões de grupos já existente, e não se alega completude de eventos que o servidor não registra.

Status: implementado e habilitado (`modules.audit=true`) após gates abaixo.

Contrato de filtros conferido em execução: responseCode não está anunciado em collectionFilters e é ignorado pelo servidor. HTTP permanece como coluna; o filtro de conta autenticada usa authenticatedAsAccountId, anunciado com eq.

## Aceite executado

8 testes de domínio/componente; DTO antes do cache, cursor restrito, filtros válidos, gate admin/flag. 15 checks E2E: dados reais, cursor, filtro nativo de conta, metadados no modal, quatro cenários de tema/tamanho sem violações axe/overflow, flag off e autorização. O usuário comum tem leitura nativa apenas de sua própria auditoria (HTTP 200 com accountId próprio); filtro accountId do admin retorna vazio. A tela administrativa continua restrita a admin e a URL direta é negada. Não alegar que o endpoint inteiro responde 403 para usuários comuns.

Relatórios `console/audit-e2e-results.json`, `audit-a11y-results.json`. Nenhuma escrita de negócio no aceite; somente login. Correção compartilhada: corpo rolável de Modal recebe tabIndex=0, permitindo teclado em detalhes longos sem campos interativos. Audit/Processes remontam por identidade e queries usam prefixo data para cancelamento/limpeza padrão da sessão.
