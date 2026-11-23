import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let server;
try {
  const [mode, source, target, ...extra] = process.argv.slice(2);
  if (
    extra.length ||
    !source ||
    !['--check', '--write'].includes(mode) ||
    (mode === '--write' ? !target : !!target)
  )
    throw new Error('Use --check origem.json ou --write origem.json destino-novo.json.');
  const input = resolve(source),
    output = target && resolve(target);
  if (input === output) throw new Error('Origem e destino precisam ser diferentes.');
  const bytes = await readFile(input);
  const original = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  server = await createServer({
    root,
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    logLevel: 'silent',
  });
  const { validateConfig, moduleNames } = await server.ssrLoadModule('/src/config.ts');
  const converted = validateConfig(original);
  const disabledDefaults = moduleNames.filter((name) => !Object.hasOwn(original.modules, name));
  const report = {
    status: 'valid',
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    schemaVersion: converted.schemaVersion,
    disabledDefaults,
  };
  if (mode === '--write') {
    const serialized = JSON.stringify(converted, null, 2) + '\n';
    await writeFile(output, serialized, { flag: 'wx', mode: 0o600 });
    report.outputSha256 = createHash('sha256').update(serialized).digest('hex');
  }
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(
    error?.code === 'EEXIST'
      ? 'Destino existente: nenhum arquivo foi sobrescrito.'
      : 'Configuração não migrada; confira contrato, versão, origem e destino.',
  );
  process.exitCode = 1;
} finally {
  await server?.close();
}
