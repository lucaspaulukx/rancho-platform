export const enComposeValidation = {
  'composeValidation.createUnavailable': 'Stack creation is unavailable.',
  'composeValidation.nameRequired': 'Enter the stack name.',
  'composeValidation.dockerRequired': 'Fill in Docker Compose.',
  'composeValidation.fileTooLarge': '{label} accepts up to 512 KiB in UTF-8.',
  'composeValidation.nullCharacter': '{label} contains a null character.',
  'composeValidation.variableName': 'Each variable needs a valid name, such as APP_PORT.',
  'composeValidation.duplicateVariable': 'Duplicate variable: {name}.',
  'composeValidation.createChanged': 'Stack creation is no longer available.',
  'composeValidation.fieldChanged': 'Rancher no longer allows filling in {name}. Reopen the panel.',
} as const;

export const ptComposeValidation = {
  'composeValidation.createUnavailable': 'A criação de stacks não está disponível.',
  'composeValidation.nameRequired': 'Preencha o nome da stack.',
  'composeValidation.dockerRequired': 'Preencha Docker Compose.',
  'composeValidation.fileTooLarge': '{label} aceita até 512 KiB em UTF-8.',
  'composeValidation.nullCharacter': '{label} contém um caractere nulo.',
  'composeValidation.variableName': 'Cada variável precisa de um nome válido, como APP_PORT.',
  'composeValidation.duplicateVariable': 'Variável duplicada: {name}.',
  'composeValidation.createChanged': 'A criação de stacks não está mais disponível.',
  'composeValidation.fieldChanged': 'O Rancher não permite mais preencher {name}. Reabra o painel.',
} as const;
