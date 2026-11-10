export const enRequestErrors = {
  'requestError.scopeChanged': 'The context changed. Reopen the panel before continuing.',
  'requestError.resourceOutOfScope': 'The resource is unavailable in this environment.',
  'requestError.unsafeUrl': 'The server returned a disallowed API address.',
  'requestError.paginationCycle': 'The API returned a pagination cycle.',
  'requestError.paginationLimit': 'The collection is too large. Narrow the filters.',
  'requestError.invalidCollection': 'The API returned an invalid collection.',
} as const;

export const ptRequestErrors = {
  'requestError.scopeChanged': 'O contexto mudou. Reabra o painel antes de continuar.',
  'requestError.resourceOutOfScope': 'O recurso não está disponível neste environment.',
  'requestError.unsafeUrl': 'O servidor retornou um endereço de API não permitido.',
  'requestError.paginationCycle': 'A paginação retornou um ciclo.',
  'requestError.paginationLimit': 'A coleção é muito grande. Refine os filtros.',
  'requestError.invalidCollection': 'Resposta de coleção inválida.',
} as const;
