export const enComposeEditor = {
  'composeEditor.hideLabel': 'Hide {label}',
  'composeEditor.showLabel': 'Show {label}',
  'composeEditor.size': '{lines} lines · {bytes} bytes',
  'composeEditor.hide': 'Hide',
  'composeEditor.show': 'Show',
  'composeEditor.hint': 'Content is sent to Rancher without conversion. Up to 512 KiB UTF-8.',
  'composeEditor.hidden': 'Content is hidden. Select Show to edit.',
  'composeEditor.stackName': 'Stack name',
  'composeEditor.nameHint': 'Letters, numbers and hyphens. Up to 63 characters.',
  'composeEditor.description': 'Description',
  'composeEditor.creationMode': 'How to create the stack',
  'composeEditor.docker': 'Docker Compose',
  'composeEditor.rancher': 'Rancher Compose (optional)',
  'composeEditor.start': 'Start services after importing',
  'composeEditor.startDescription':
    'Creates containers in the selected environment. Leave unchecked to review the services before starting.',
  'composeEditor.startWarning':
    'Importing can create containers and consume resources in the selected environment.',
  'composeEditor.startManually':
    'Services will be imported without starting automatically. You can start them using the start action.',
  'composeEditor.empty': 'Empty stack',
  'composeEditor.import': 'Import Compose',
  'composeEditor.compatibility':
    'Use a format compatible with Rancher 1.6. The server validates the files and processes the import. Follow the result in the stack.',
  'composeEditor.variables': 'Interpolation variables',
  'composeEditor.variablesNote':
    'Rancher uses these values when importing the files. They are kept out of console preferences.',
  'composeEditor.addVariable': 'Add variable',
  'composeEditor.emptyHint': 'Create the stack and add services from its row menu.',
  'composeEditor.variableName': 'Variable name {index}',
  'composeEditor.variableValue': 'Variable value {index}',
  'composeEditor.removeVariable': 'Remove variable {index}',
  'composeEditor.review': 'Review the stack.',
} as const;

export const ptComposeEditor = {
  'composeEditor.hideLabel': 'Ocultar {label}',
  'composeEditor.showLabel': 'Mostrar {label}',
  'composeEditor.size': '{lines} linhas · {bytes} bytes',
  'composeEditor.hide': 'Ocultar',
  'composeEditor.show': 'Mostrar',
  'composeEditor.hint': 'Conteúdo enviado ao Rancher sem conversão. Até 512 KiB UTF-8.',
  'composeEditor.hidden': 'Conteúdo oculto. Use Mostrar para editar.',
  'composeEditor.stackName': 'Nome da stack',
  'composeEditor.nameHint': 'Letras, números e hífen. Até 63 caracteres.',
  'composeEditor.description': 'Descrição',
  'composeEditor.creationMode': 'Como criar a stack',
  'composeEditor.docker': 'Docker Compose',
  'composeEditor.rancher': 'Rancher Compose (opcional)',
  'composeEditor.start': 'Iniciar os serviços após importar',
  'composeEditor.startDescription':
    'Cria containers no environment selecionado. Deixe desmarcado para revisar os serviços antes de iniciar.',
  'composeEditor.startWarning':
    'A importação pode criar containers e consumir recursos no environment selecionado.',
  'composeEditor.startManually':
    'Os serviços serão importados sem início automático. Você poderá iniciá-los pela operação.',
  'composeEditor.empty': 'Stack vazia',
  'composeEditor.import': 'Importar Compose',
  'composeEditor.compatibility':
    'Use o formato compatível com Rancher 1.6. O servidor valida os arquivos e processa a importação; acompanhe o resultado na stack.',
  'composeEditor.variables': 'Variáveis de interpolação',
  'composeEditor.variablesNote':
    'Valores usados pelo Rancher ao importar os arquivos. Não são guardados nas preferências da console.',
  'composeEditor.addVariable': 'Adicionar variável',
  'composeEditor.emptyHint': 'Crie a stack e adicione serviços pelo menu da própria linha.',
  'composeEditor.variableName': 'Nome da variável {index}',
  'composeEditor.variableValue': 'Valor da variável {index}',
  'composeEditor.removeVariable': 'Remover variável {index}',
  'composeEditor.review': 'Revise a stack.',
} as const;
