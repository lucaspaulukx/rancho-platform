// Node 24 loads the same typed domain used by the UI; no browser or external dependencies.
const fs = require('node:fs');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
(async () => {
  const d = await import(
    require('node:url').pathToFileURL(
      require('node:path').join(__dirname, '../src/balancer-rules.ts'),
    ).href
  );
  try {
    if (input.baseline) d.assertBalancerUnchanged(input.baseline, input.source);
    const rows = d.editableBalancerRules(input.source);
    if (input.mode === 'update') {
      rows[0].targetPort = '8081';
      rows[0].hostname = 'fixture.example';
      rows[0].path = '/api';
      rows[0].access = 'internal';
    }
    if (input.mode === 'tcp') {
      rows[0].protocol = 'tcp';
      rows[0].hostname = '';
      rows[0].path = '';
      rows[0].targetPort = '9090';
      rows[0].sourcePort = '8099';
      rows[0].access = 'public';
    }
    process.stdout.write(
      JSON.stringify(
        d.prepareBalancerRules(
          input.source,
          rows,
          input.schemas,
          input.services,
          input.stacks,
          input.environment,
        ),
      ),
    );
  } catch (error) {
    process.stderr.write(error.message);
    process.exitCode = 2;
  }
})().catch((error) => {
  process.stderr.write(error.message);
  process.exitCode = 2;
});
