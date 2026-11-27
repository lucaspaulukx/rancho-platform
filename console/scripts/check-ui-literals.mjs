import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsers } from 'prettier/plugins/typescript';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const visibleAttributes = new Set([
  'alt',
  'aria-label',
  'aria-roledescription',
  'aria-valuetext',
  'ariaLabel',
  'cancelLabel',
  'description',
  'emptyText',
  'error',
  'hint',
  'label',
  'message',
  'placeholder',
  'submitLabel',
  'title',
]);

const visibleProperties = new Set(['ariaLabel', 'description', 'hint', 'label', 'title']);
const visibleCalls = new Set(['alert', 'confirm', 'setCustomValidity', 'toast']);

// Product names, technical units, version markers, protocol tokens and typed catalog keys.
const technicalText = new Map(
  Object.entries({
    'components/About.tsx': ['Rancher 1.6.30'],
    'components/BalancerRulesPanel.tsx': ['HTTP', 'TCP'],
    'components/Brand.tsx': ['Rancho Platform', 'Rancher'],
    'components/EnvironmentSwitcher.tsx': ['Cattle', 'Esc'],
    'components/HealthCheckEditor.tsx': ['HTTP/1.0', 'HTTP/1.1'],
    'components/LocalAccountPanel.tsx': ['localAccountPanel.description'],
    'components/WorkloadBindingsEditor.tsx': ['TCP', 'UDP'],
    'layouts.tsx': [
      'Rancher 1.6.30',
      'Rancher Console',
      'Rancho Platform',
      'Rancho Platform · Rancher 1.6.30',
      'Rancher',
      'v',
    ],
    'pages/Hosts.tsx': ['GiB'],
    'pages/Resources.tsx': ['Rancher'],
  }),
);

function* directStrings(node) {
  if (!node) return;
  if (node.type === 'Literal' && typeof node.value === 'string') {
    yield { node, text: node.value };
  } else if (node.type === 'TemplateLiteral') {
    for (const quasi of node.quasis) yield { node: quasi, text: quasi.value.cooked };
  } else if (
    ['TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression'].includes(node.type)
  ) {
    yield* directStrings(node.expression);
  } else if (node.type === 'ConditionalExpression') {
    yield* directStrings(node.consequent);
    yield* directStrings(node.alternate);
  } else if (node.type === 'LogicalExpression') {
    if (node.operator !== '&&') yield* directStrings(node.left);
    yield* directStrings(node.right);
  }
}

export function inlineInterfaceLiterals(filename, contents) {
  const ast = parsers.typescript.parse(contents, { filepath: filename });
  const exceptions = technicalText.get(filename) ?? [];
  const findings = [];

  function record(node, text, surface) {
    if (typeof text !== 'string' || !/\p{L}/u.test(text)) return;
    if (exceptions.includes(text.replace(/\s+/g, ' ').trim())) return;
    const { line, column } = node.loc.start;
    findings.push({ line, column: column + 1, surface });
  }

  function visit(node, parent) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'JSXText') record(node, node.value, 'text');
    if (node.type === 'JSXExpressionContainer' && parent.type !== 'JSXAttribute')
      for (const literal of directStrings(node.expression))
        record(literal.node, literal.text, 'text');
    if (node.type === 'JSXAttribute' && visibleAttributes.has(node.name.name))
      for (const literal of directStrings(node.value?.expression ?? node.value))
        record(literal.node, literal.text, node.name.name);
    if (node.type === 'Property' && !node.computed) {
      const key = node.key.name ?? node.key.value;
      if (visibleProperties.has(key))
        for (const literal of directStrings(node.value))
          record(literal.node, literal.text, `property ${key}`);
    }
    if (node.type === 'CallExpression') {
      const call = node.callee.name ?? node.callee.property?.name;
      if (visibleCalls.has(call))
        for (const literal of directStrings(node.arguments[0]))
          record(literal.node, literal.text, `argument to ${call}`);
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === 'comments' || key === 'tokens') continue;
      if (Array.isArray(child)) child.forEach((item) => visit(item, node));
      else if (child && typeof child === 'object') visit(child, node);
    }
  }

  visit(ast);
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

function main() {
  const files = readdirSync(source, { recursive: true })
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => file.endsWith('.tsx') && !file.startsWith('test/'))
    .sort();
  if (!files.length) throw new Error('No interface sources were found.');
  let failingFiles = 0;
  for (const file of files) {
    const findings = inlineInterfaceLiterals(file, readFileSync(resolve(source, file), 'utf8'));
    if (findings.length) failingFiles++;
    for (const { line, column, surface } of findings)
      console.error(
        `src/${file}:${line}:${column} has inline interface ${surface}. Use a locale catalog message.`,
      );
  }
  if (failingFiles) return 1;
  console.log(`Checked JSX and selected interface literals in ${files.length} files.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch {
    console.error('Could not inspect the console JSX sources.');
    process.exitCode = 1;
  }
}
