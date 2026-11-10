export const enBindingsEditor = {
  'bindingsEditor.portsTitle': 'Published ports',
  'bindingsEditor.volumesTitle': 'Volumes',
  'bindingsEditor.portsHint':
    'Set the container port and, optionally, the host port and IP. Rancher will apply the publication.',
  'bindingsEditor.volumesHint':
    'Mount a named volume, host path or anonymous volume at an absolute container target.',
  'bindingsEditor.unsupported':
    'Unsupported format received. Use the native form to preserve the configuration.',
  'bindingsEditor.native': 'Native entry preserved. Edits to other rows do not convert this value.',
  'bindingsEditor.readWrite': 'Read and write',
  'bindingsEditor.readOnly': 'Read only',
  'bindingsEditor.hostPortHint': 'Optional; follows native Rancher assignment.',
  'bindingsEditor.ipHint': 'Optional. Requires a host port; accepts IPv4 or IPv6 without brackets.',
  'bindingsEditor.sourceHint': 'Volume name, absolute host path or empty for an anonymous volume.',
  'bindingsEditor.targetHint': 'Absolute path in the container, such as /data.',
  'bindingsEditor.containerPort': 'Container port {index}',
  'bindingsEditor.hostPort': 'Host port {index}',
  'bindingsEditor.protocol': 'Port protocol {index}',
  'bindingsEditor.ip': 'Published IP {index}',
  'bindingsEditor.source': 'Volume source {index}',
  'bindingsEditor.target': 'Volume target {index}',
  'bindingsEditor.access': 'Volume access {index}',
  'bindingsEditor.portRow': 'Port {index}',
  'bindingsEditor.volumeRow': 'Volume {index}',
  'bindingsEditor.removePort': 'Remove port {index}',
  'bindingsEditor.removeVolume': 'Remove volume {index}',
  'bindingsEditor.addPort': 'Add port',
  'bindingsEditor.addVolume': 'Add volume',
  'bindingsEditor.validation.limit': 'Keep up to 100 native entries per field.',
  'bindingsEditor.validation.ports':
    'Check that ports are whole numbers from 1 to 65535 and that the protocol and published IP are valid.',
  'bindingsEditor.validation.volumes':
    'Check the source, absolute target path and access mode of each volume.',
  'bindingsEditor.validation.ipNeedsHostPort': 'A published IP requires a host port.',
  'bindingsEditor.validation.portConflict':
    'There are conflicting bindings on the same host port and protocol.',
  'bindingsEditor.validation.duplicateTarget': 'Use a different mount target for each volume.',
  'bindingsEditor.validation.depth': 'The configuration is nested too deeply.',
} as const;

export const ptBindingsEditor = {
  'bindingsEditor.portsTitle': 'Portas publicadas',
  'bindingsEditor.volumesTitle': 'Volumes',
  'bindingsEditor.portsHint':
    'Defina porta do container e, opcionalmente, porta e IP no host. A publicação será aplicada pelo Rancher.',
  'bindingsEditor.volumesHint':
    'Monte um volume nomeado, caminho do host ou volume anônimo em um destino absoluto do container.',
  'bindingsEditor.unsupported':
    'Formato recebido não suportado. Use o formulário nativo para preservar a configuração.',
  'bindingsEditor.native':
    'Entrada nativa preservada. Edições nas outras linhas não convertem este valor.',
  'bindingsEditor.readWrite': 'Leitura e escrita',
  'bindingsEditor.readOnly': 'Somente leitura',
  'bindingsEditor.hostPortHint': 'Opcional; segue a atribuição nativa do Rancher.',
  'bindingsEditor.ipHint': 'Opcional. Exige porta no host; aceita IPv4 ou IPv6 sem colchetes.',
  'bindingsEditor.sourceHint':
    'Nome do volume, caminho absoluto no host ou vazio para volume anônimo.',
  'bindingsEditor.targetHint': 'Caminho absoluto no container, como /data.',
  'bindingsEditor.containerPort': 'Porta do container {index}',
  'bindingsEditor.hostPort': 'Porta no host {index}',
  'bindingsEditor.protocol': 'Protocolo da porta {index}',
  'bindingsEditor.ip': 'IP de publicação {index}',
  'bindingsEditor.source': 'Origem do volume {index}',
  'bindingsEditor.target': 'Destino do volume {index}',
  'bindingsEditor.access': 'Acesso do volume {index}',
  'bindingsEditor.portRow': 'Porta {index}',
  'bindingsEditor.volumeRow': 'Volume {index}',
  'bindingsEditor.removePort': 'Remover porta {index}',
  'bindingsEditor.removeVolume': 'Remover volume {index}',
  'bindingsEditor.addPort': 'Adicionar porta',
  'bindingsEditor.addVolume': 'Adicionar volume',
  'bindingsEditor.validation.limit': 'Mantenha até 100 entradas nativas por campo.',
  'bindingsEditor.validation.ports':
    'Revise portas inteiras de 1 a 65535, protocolo e IP de publicação.',
  'bindingsEditor.validation.volumes': 'Revise origem, destino absoluto e acesso de cada volume.',
  'bindingsEditor.validation.ipNeedsHostPort': 'Um IP de publicação exige porta no host.',
  'bindingsEditor.validation.portConflict':
    'Há publicações conflitantes na mesma porta e protocolo.',
  'bindingsEditor.validation.duplicateTarget': 'Não repita o destino de montagem de um volume.',
  'bindingsEditor.validation.depth': 'A configuração tem níveis demais.',
} as const satisfies Record<keyof typeof enBindingsEditor, string>;
