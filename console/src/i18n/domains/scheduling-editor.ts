export const enSchedulingEditor = {
  'schedulingEditor.title': 'Scheduling affinities',
  'schedulingEditor.description':
    'Combine rules to place the workload. Preferences may not be met; required rules may prevent scheduling.',
  'schedulingEditor.global':
    'Global service: use only host labels with required or exclusion rules. Global scale is preserved.',
  'schedulingEditor.legacy':
    'Some legacy rules cannot be interpreted by this editor. Edit the native labels or disable the structured editor; nothing has been converted.',
  'schedulingEditor.rule': 'Affinity {index}',
  'schedulingEditor.target': 'Affinity target',
  'schedulingEditor.condition': 'Affinity condition',
  'schedulingEditor.kind.host_label': 'Host label',
  'schedulingEditor.kind.container_label': 'Container label',
  'schedulingEditor.kind.container': 'Container name',
  'schedulingEditor.mode.required': 'Must match',
  'schedulingEditor.mode.exclude': 'Must not match',
  'schedulingEditor.mode.prefer': 'Prefer matching',
  'schedulingEditor.mode.avoid': 'Prefer avoiding',
  'schedulingEditor.key': 'Label key',
  'schedulingEditor.serviceHint':
    'For a service: io.rancher.stack_service.name; value: stack/service.',
  'schedulingEditor.container': 'Reference container name',
  'schedulingEditor.value': 'Label value',
  'schedulingEditor.remove': 'Remove affinity {index}',
  'schedulingEditor.removeRule': 'Remove rule',
  'schedulingEditor.add': 'Add affinity',
  'schedulingEditor.native': 'Other labels and native rules',
} as const;

export const ptSchedulingEditor = {
  'schedulingEditor.title': 'Afinidades de agendamento',
  'schedulingEditor.description':
    'Combine regras para posicionar o workload. Preferências podem não ser atendidas; regras obrigatórias podem impedir o agendamento.',
  'schedulingEditor.global':
    'Serviço global: use somente labels de host com regras obrigatórias ou de negação. A escala global é preservada.',
  'schedulingEditor.legacy':
    'Há regras legadas que este editor não consegue interpretar. Edite as labels nativas ou desative o editor estruturado; nada foi convertido.',
  'schedulingEditor.rule': 'Afinidade {index}',
  'schedulingEditor.target': 'Alvo da afinidade',
  'schedulingEditor.condition': 'Condição da afinidade',
  'schedulingEditor.kind.host_label': 'Label de host',
  'schedulingEditor.kind.container_label': 'Label de container',
  'schedulingEditor.kind.container': 'Nome de container',
  'schedulingEditor.mode.required': 'Deve corresponder',
  'schedulingEditor.mode.exclude': 'Não pode corresponder',
  'schedulingEditor.mode.prefer': 'Preferir correspondência',
  'schedulingEditor.mode.avoid': 'Preferir evitar',
  'schedulingEditor.key': 'Chave da label',
  'schedulingEditor.serviceHint':
    'Para um serviço: io.rancher.stack_service.name; valor: stack/serviço.',
  'schedulingEditor.container': 'Nome do container de referência',
  'schedulingEditor.value': 'Valor da label',
  'schedulingEditor.remove': 'Remover afinidade {index}',
  'schedulingEditor.removeRule': 'Remover regra',
  'schedulingEditor.add': 'Adicionar afinidade',
  'schedulingEditor.native': 'Outras labels e regras nativas',
} as const satisfies Record<keyof typeof enSchedulingEditor, string>;
