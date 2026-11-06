import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { I18nProvider, useI18n } from '../i18n/provider';
import { CapabilityEditor } from '../components/CapabilityEditor';
import { MemoryEditor } from '../components/MemoryEditor';

function Editor() {
  const { setLocale } = useI18n();
  const [value, setValue] = useState<string[]>(['NET_RAW']);
  return (
    <>
      <button onClick={() => setLocale('en-US')}>English</button>
      <CapabilityEditor
        label="Capabilities"
        value={value}
        options={['NET_RAW', 'ALL']}
        onChange={setValue}
      />
      <MemoryEditor label="Memory" value={0} onChange={() => {}} />
      <output data-testid="native">{JSON.stringify(value)}</output>
    </>
  );
}

it('preserves a selected native capability and its control when switching locale', async () => {
  const user = userEvent.setup();
  render(
    <I18nProvider
      policy={{
        enabled: true,
        defaultLocale: 'pt-BR',
        availableLocales: ['pt-BR', 'en-US'],
        selectable: true,
        detectBrowser: false,
        preview: true,
      }}
    >
      <Editor />
    </I18nProvider>,
  );
  const control = screen.getByLabelText('Capabilities: capability 1');
  const memory = screen.getByLabelText('Memory: valor');
  await user.type(memory, 'invalid');
  expect((memory as HTMLInputElement).validationMessage).toContain('Informe memória');
  await user.selectOptions(control, 'ALL');
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByLabelText('Capabilities: capability 1')).toBe(control);
  expect(screen.getByLabelText('Memory: value')).toBe(memory);
  expect(memory).toHaveValue('0invalid');
  expect((memory as HTMLInputElement).validationMessage).toContain('Enter nonnegative memory');
  expect(control).toHaveValue('ALL');
  expect(screen.getByTestId('native')).toHaveTextContent('["ALL"]');
});
