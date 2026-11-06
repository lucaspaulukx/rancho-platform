export const enWorkloadPolicyValidation = {
  'workloadPolicyValidation.limit': 'Use no more than 100 affinity rules.',
  'workloadPolicyValidation.rule':
    'Enter valid keys and values in affinity rules, without commas or line breaks.',
  'workloadPolicyValidation.map': 'Invalid scheduling labels.',
  'workloadPolicyValidation.text': 'Labels must contain text.',
  'workloadPolicyValidation.global':
    'Global scheduling only accepts host labels with required or negative rules.',
  'workloadPolicyValidation.depth': 'The configuration has too many nested levels.',
  'workloadPolicyValidation.capabilities':
    'Review the security capabilities against the current contract.',
} as const;

export const ptWorkloadPolicyValidation = {
  'workloadPolicyValidation.limit': 'Use no máximo 100 regras de afinidade.',
  'workloadPolicyValidation.rule':
    'Preencha chave e valor válidos nas regras de afinidade, sem vírgulas ou quebras de linha.',
  'workloadPolicyValidation.map': 'Labels de agendamento inválidas.',
  'workloadPolicyValidation.text': 'Labels precisam conter texto.',
  'workloadPolicyValidation.global':
    'Agendamento global aceita somente label de host com regra obrigatória ou de negação.',
  'workloadPolicyValidation.depth': 'A configuração tem níveis demais.',
  'workloadPolicyValidation.capabilities':
    'Revise as capabilities de segurança conforme o contrato atual.',
} as const;
