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
} as const satisfies Record<keyof typeof enBindingsEditor, string>;
