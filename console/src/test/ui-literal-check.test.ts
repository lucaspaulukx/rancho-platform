import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const { inlineInterfaceLiterals } = await import(
  /* @vite-ignore */ pathToFileURL(resolve('scripts/check-ui-literals.mjs')).href
);

describe('Inline interface literal check', () => {
  it('reports direct text, attributes and static branches without echoing the source strings', () => {
    const findings = inlineInterfaceLiterals(
      'Demo.tsx',
      [
        'const Demo = () => <section title="Heading">',
        '  Plain interface text',
        '  <input placeholder={ready ? t("field") : "Static hint"} />',
        '  <span>{`Title for ${name}`}</span>',
        '  <button aria-label={label || "Open"}>{t("open")}</button>',
        '</section>',
      ].join('\n'),
    );
    expect(
      findings.map(({ line, surface }: { line: number; surface: string }) => [line, surface]),
    ).toEqual([
      [1, 'title'],
      [1, 'text'],
      [3, 'placeholder'],
      [4, 'text'],
      [5, 'aria-label'],
    ]);
    expect(JSON.stringify(findings)).not.toContain('Static hint');
  });

  it('accepts translated labels, native values and scoped technical text', () => {
    const source = '<select aria-label={t("protocol")}><option value="tcp">TCP</option></select>';
    expect(inlineInterfaceLiterals('components/WorkloadBindingsEditor.tsx', source)).toEqual([]);
    expect(inlineInterfaceLiterals('Demo.tsx', source)).toHaveLength(1);
  });
});
