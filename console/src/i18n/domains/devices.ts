export const enDevices = {
  'devices.title': 'Device mappings',
  'devices.description':
    'Map devices already present on the selected host. Permissions apply to new containers; this does not create a device on the host or enable privileged mode.',
  'devices.effectivePermissions':
    'Requested r/w/m permissions do not replace the runtime’s default device permissions. Verify effective access on the target host; a read-only mapping of an already permitted device may still allow writes.',
  'devices.row': 'Device {index}',
  'devices.host': 'Host path {index}',
  'devices.container': 'Container path {index}',
  'devices.pathHint': 'Use an explicit absolute path. The host must contain a compatible device.',
  'devices.read': 'Device {index}: read (r)',
  'devices.write': 'Device {index}: write (w)',
  'devices.mknod': 'Device {index}: create nodes (m)',
  'devices.add': 'Add device',
  'devices.remove': 'Remove device {index}',
  'devices.rawValue': 'Native value of device {index}',
  'devices.legacy':
    'This native value is preserved unchanged in the draft, but this editor cannot submit it. Reopen the native form to submit this format, or explicitly remove this row.',
  'devices.incompatible':
    'This device list has an incompatible legacy format or exceeds this editor’s limit. Use the native editor to preserve it.',
  'devices.error.list': 'Configure a list of at most 32 device mappings.',
  'devices.error.format':
    'Use an explicit host path, container path and permissions for each device mapping.',
  'devices.error.path':
    'Device paths must be absolute, contain no control characters and fit within this editor’s limit.',
  'devices.error.permissions': 'Select at least one distinct device permission: r, w or m.',
  'devices.error.duplicate': 'Each device mapping must have a different container path.',
  'devices.error.contract': 'The current contract does not allow device mappings during creation.',
  'devices.error.depth': 'The configuration has too many nested levels.',
} as const;

export const ptDevices = {
  'devices.title': 'Mapeamentos de dispositivos',
  'devices.description':
    'Mapeie dispositivos já presentes no host selecionado. As permissões valem para novos containers; isto não cria um dispositivo no host nem ativa o modo privilegiado.',
  'devices.effectivePermissions':
    'As permissões r/w/m solicitadas não substituem as permissões padrão de dispositivos do runtime. Confira o acesso efetivo no host de destino; mapear somente leitura de um dispositivo já permitido ainda pode permitir escrita.',
  'devices.row': 'Dispositivo {index}',
  'devices.host': 'Caminho no host {index}',
  'devices.container': 'Caminho no container {index}',
  'devices.pathHint':
    'Use um caminho absoluto explícito. O host precisa conter um dispositivo compatível.',
  'devices.read': 'Dispositivo {index}: leitura (r)',
  'devices.write': 'Dispositivo {index}: escrita (w)',
  'devices.mknod': 'Dispositivo {index}: criar nós (m)',
  'devices.add': 'Adicionar dispositivo',
  'devices.remove': 'Remover dispositivo {index}',
  'devices.rawValue': 'Valor nativo do dispositivo {index}',
  'devices.legacy':
    'Este valor nativo é preservado sem alterações no rascunho, mas este editor não pode enviá-lo. Reabra o formulário nativo para enviar esse formato ou remova esta linha explicitamente.',
  'devices.incompatible':
    'Esta lista de dispositivos tem formato legado incompatível ou excede o limite deste editor. Use o editor nativo para preservá-la.',
  'devices.error.list': 'Configure uma lista de até 32 mapeamentos de dispositivos.',
  'devices.error.format':
    'Informe host, container e permissões explícitos para cada mapeamento de dispositivo.',
  'devices.error.path':
    'Caminhos de dispositivos precisam ser absolutos, não conter caracteres de controle e respeitar o limite deste editor.',
  'devices.error.permissions':
    'Selecione pelo menos uma permissão de dispositivo, sem repetições: r, w ou m.',
  'devices.error.duplicate':
    'Cada mapeamento de dispositivo precisa ter um caminho de container diferente.',
  'devices.error.contract': 'O contrato atual não permite mapear dispositivos na criação.',
  'devices.error.depth': 'A configuração tem níveis demais.',
} as const satisfies Record<keyof typeof enDevices, string>;
