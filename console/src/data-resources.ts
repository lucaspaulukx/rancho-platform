import type { Resource, Schema } from './api';
import { encodeUtf8Base64 } from './encoding';
import { sensitiveField } from './components/SchemaForm';
export type DataKind = 'volume' | 'registry' | 'certificate' | 'secret';
export const isDataKind = (kind?: string): kind is DataKind =>
  ['volume', 'registry', 'certificate', 'secret'].includes(kind || '');
export const isNamedVolume = (resource: Resource) =>
  !!resource.name && !resource.instanceId && !resource.name.startsWith('/');
export function dataResourceMetadata(resource: Resource): Resource {
  function clean(value: unknown, depth = 0): unknown {
    if (depth > 12) return null;
    if (Array.isArray(value)) return value.map((item) => clean(item, depth + 1));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !sensitiveField(key))
          .map(([key, item]) => [key, clean(item, depth + 1)]),
      );
    return value;
  }
  return clean(resource) as Resource;
}
export function dataEditorSchema(
  schema: Schema,
  updating: boolean,
  replaceCertificate = false,
): Schema {
  const allowed: Record<string, string[]> = {
    secret: updating ? ['description'] : ['name', 'description', 'value'],
    certificate:
      updating && !replaceCertificate
        ? ['name', 'description']
        : ['name', 'description', 'cert', 'key', 'certChain'],
    registry: updating ? ['name', 'description'] : ['name', 'description', 'serverAddress'],
    volume: updating
      ? ['description']
      : [
          'name',
          'description',
          'hostId',
          'driver',
          'driverOpts',
          'sizeMb',
          'stackId',
          'storageDriverId',
        ],
  };
  return {
    ...schema,
    resourceFields: Object.fromEntries(
      Object.entries(schema.resourceFields)
        .filter(([name]) => allowed[schema.id]?.includes(name))
        .map(([name, field]) => [
          name,
          name === 'value' && schema.id === 'secret'
            ? {
                ...field,
                type: 'multiline',
                label: 'Conteúdo do secret',
                description:
                  'Texto codificado em UTF-8 no envio. O valor não será recuperado após salvar.',
              }
            : name === 'driver' && schema.id === 'volume'
              ? { ...field, default: field.default || 'local' }
              : field,
        ]),
    ),
  };
}
export function normalizeRegistryAddress(value: string) {
  const address = value.trim();
  if (!address) throw new Error('Informe o endereço do registry.');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(address) && !/^https?:\/\//i.test(address))
    throw new Error('Informe um endereço HTTP ou HTTPS para o registry.');
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(address) ? address : `https://${address}`);
  } catch {
    throw new Error('Informe um endereço de registry válido.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname)
    throw new Error('Informe somente o servidor e a porta, sem credenciais no endereço.');
  return url.host.toLowerCase();
}
export function prepareDataPayload(
  kind: DataKind,
  payload: Record<string, unknown>,
  schema: Schema,
  updating: boolean,
  replaceCertificate = false,
) {
  const output = { ...payload };
  if (kind === 'secret' && !updating) {
    const encoded = encodeUtf8Base64(String(payload.value ?? ''));
    if (
      schema.resourceFields.value?.maxLength !== undefined &&
      encoded.length > schema.resourceFields.value.maxLength
    )
      throw new Error('O conteúdo excede o tamanho permitido pelo servidor.');
    output.value = encoded;
  }
  if (kind === 'secret' && updating) {
    delete output.value;
    delete output.name;
  }
  if (kind === 'registry' && !updating) {
    output.serverAddress = normalizeRegistryAddress(String(payload.serverAddress || ''));
    if (!output.name) output.name = output.serverAddress;
  }
  if (kind === 'certificate' && (!updating || replaceCertificate)) {
    if (
      typeof payload.cert !== 'string' ||
      !/-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(payload.cert)
    )
      throw new Error('Informe um certificado PEM válido.');
    if (
      typeof payload.key !== 'string' ||
      !/-----BEGIN ((?:RSA |EC )?PRIVATE KEY)-----[\s\S]+-----END \1-----/.test(payload.key)
    )
      throw new Error('Informe a chave privada PEM sem senha correspondente ao certificado.');
    output.cert = payload.cert.trim();
    output.key = payload.key.trim();
    if (updating)
      output.certChain =
        typeof payload.certChain === 'string' && payload.certChain.trim()
          ? payload.certChain.trim()
          : null;
  }
  if (kind === 'certificate' && updating && !replaceCertificate) {
    delete output.cert;
    delete output.key;
    delete output.certChain;
  }
  return output;
}
