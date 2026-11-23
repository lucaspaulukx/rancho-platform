export const enHealthCheckValidation = {
  'healthCheckValidation.request': 'Review the health check HTTP request.',
  'healthCheckValidation.requestFormat':
    'Use an HTTP path starting with /, without spaces, quotes, or line breaks, and a valid Host.',
  'healthCheckValidation.contract': 'The health check contract is unavailable.',
  'healthCheckValidation.field': 'Health check field {name} is unavailable. Reopen the panel.',
  'healthCheckValidation.integer': '{label} must be an integer between {min} and {max}.',
  'healthCheckValidation.strategy': 'The health check strategy is unavailable.',
  'healthCheckValidation.quorum': 'The quorum contract is unavailable.',
  'healthCheckValidation.depth': 'The health check configuration is nested too deeply.',
} as const;
export const ptHealthCheckValidation = {
  'healthCheckValidation.request': 'Revise a requisição HTTP da verificação de saúde.',
  'healthCheckValidation.requestFormat':
    'Use um caminho HTTP iniciado por /, sem espaços, aspas ou quebras de linha, e um Host válido.',
  'healthCheckValidation.contract': 'Contrato da verificação de saúde indisponível.',
  'healthCheckValidation.field': 'O campo de saúde {name} não está disponível. Reabra o painel.',
  'healthCheckValidation.integer': '{label} precisa ser um inteiro entre {min} e {max}.',
  'healthCheckValidation.strategy': 'Estratégia de saúde indisponível.',
  'healthCheckValidation.quorum': 'Contrato de quórum indisponível.',
  'healthCheckValidation.depth': 'A configuração de saúde tem níveis demais.',
} as const satisfies Record<keyof typeof enHealthCheckValidation, string>;
