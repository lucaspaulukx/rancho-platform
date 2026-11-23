import type { Schema } from './api';
function validateFields(
  row: Record<string, unknown>,
  schema: Schema,
  schemas: Record<string, Schema>,
  depth = 0,
) {
  if (depth > 12) throw new Error('O sidecar possui níveis demais.');
  for (const [name, value] of Object.entries(row)) {
    const field = schema.resourceFields[name];
    if (!field?.create)
      throw new Error(`O campo ${name} do sidecar não está disponível. Reabra o painel.`);
    if (value && typeof value === 'object') {
      const nested = schemas[field.type];
      const itemType = /^array\[([^\]]+)\]$/.exec(field.type)?.[1];
      if (nested && !Array.isArray(value))
        validateFields(value as Record<string, unknown>, nested, schemas, depth + 1);
      else if (Array.isArray(value) && itemType && schemas[itemType])
        for (const item of value) {
          if (!item || typeof item !== 'object' || Array.isArray(item))
            throw new Error('Revise os itens de configuração do sidecar.');
          validateFields(item, schemas[itemType], schemas, depth + 1);
        }
      else if (
        !Array.isArray(value) &&
        !field.type.startsWith('map[') &&
        !['json', 'object'].includes(field.type) &&
        !nested
      )
        throw new Error(`Contrato de ${name} do sidecar indisponível.`);
    }
  }
}
export function validateSidecars(values: Record<string, unknown>, schemas: Record<string, Schema>) {
  const raw = values.secondaryLaunchConfigs;
  if (raw == null) return;
  if (!Array.isArray(raw) || raw.length > 50) throw new Error('Use uma lista de até 50 sidecars.');
  const schema = schemas.secondaryLaunchConfig;
  if (
    raw.length &&
    (!schema?.resourceFields.name?.create || !schema.resourceFields.imageUuid?.create)
  )
    throw new Error('Contrato dos sidecars indisponível.');
  const names = new Set<string>();
  const primary = String(values.name || '');
  if (primary) names.add(primary);
  const uniqueNames = new Set([...names].map((name) => name.toLowerCase()));
  const configs = raw.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Revise a configuração dos sidecars.');
    const row = value as Record<string, unknown>;
    validateFields(row, schema, schemas);
    const name = row.name;
    if (
      typeof name !== 'string' ||
      !/^[a-zA-Z0-9-]{1,63}$/.test(name) ||
      uniqueNames.has(name.toLowerCase())
    )
      throw new Error(
        'Use nomes únicos de sidecar, diferentes do serviço, com até 63 letras, números ou hífen.',
      );
    names.add(name);
    uniqueNames.add(name.toLowerCase());
    if (typeof row.imageUuid !== 'string' || !row.imageUuid.trim() || /\s/.test(row.imageUuid))
      throw new Error(`Informe uma imagem válida para o sidecar ${name}.`);
    if (row.imageUuid.replace(/^docker:/, '').toLowerCase() === 'rancher/none')
      throw new Error(
        'Esta imagem é reservada ao contrato de remoção do Rancher. Use Remover sidecar.',
      );
    return row;
  });
  const launch = values.launchConfig;
  const all = [
    ...(launch && typeof launch === 'object' && !Array.isArray(launch)
      ? [{ ...(launch as Record<string, unknown>), name: primary }]
      : []),
    ...configs,
  ];
  const graph = new Map<string, string[]>();
  for (const row of all) {
    if (row.networkLaunchConfig && row.networkMode !== 'container')
      throw new Error(
        'Para compartilhar a rede de outro container do serviço, use o modo de rede container.',
      );
    const combined: string[] = [];
    for (const field of ['networkLaunchConfig', 'dataVolumesFromLaunchConfigs']) {
      const value = row[field];
      const refs = field === 'networkLaunchConfig' ? (value ? [value] : []) : (value ?? []);
      if (
        !Array.isArray(refs) ||
        refs.some((v) => typeof v !== 'string' || !names.has(v) || v === row.name)
      )
        throw new Error('Revise os vínculos de rede/volumes entre os containers do serviço.');
      combined.push(...(refs as string[]));
    }
    graph.set(String(row.name), [...new Set(combined)]);
  }
  const done = new Set<string>(),
    active = new Set<string>();
  function visit(name: string) {
    if (active.has(name))
      throw new Error('Os vínculos de rede/volumes entre sidecars não podem formar ciclos.');
    if (done.has(name)) return;
    active.add(name);
    for (const next of graph.get(name) || []) visit(next);
    active.delete(name);
    done.add(name);
  }
  for (const name of graph.keys()) visit(name);
}
