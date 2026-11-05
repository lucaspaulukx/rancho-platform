import { readFile, writeFile } from 'node:fs/promises';
const presets = JSON.parse(
  await readFile(new URL('../src/themes/presets.json', import.meta.url), 'utf8'),
);
const rules = Object.entries(presets).map(
  ([name, colors]) =>
    `${name === 'light' ? ':root' : ':root[data-theme="dark"]'} {\n${Object.entries(colors)
      .map(([key, value]) => `  --${key}: ${value};`)
      .join('\n')}\n  color-scheme: ${name};\n}`,
);
await writeFile(
  new URL('../src/themes/tokens.css', import.meta.url),
  '/* Generated from presets.json by scripts/themes.mjs. */\n' + rules.join('\n') + '\n',
);
