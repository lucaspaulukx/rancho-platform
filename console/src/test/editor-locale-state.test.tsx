import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { I18nProvider, useI18n } from '../i18n/provider';
import { CapabilityEditor } from '../components/CapabilityEditor';
import { MemoryEditor } from '../components/MemoryEditor';
import { SchemaForm } from '../components/SchemaForm';

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

it('retranslates an existing schema validation error without sending the draft', () => {
  const submit = vi.fn();
  function Form() {
    const { setLocale } = useI18n();
    return (
      <>
        <button onClick={() => setLocale('en-US')}>English</button>
        <SchemaForm
          id="localized-validation"
          schema={{
            id: 'fixture',
            pluralName: 'fixtures',
            links: {},
            resourceFields: { name: { type: 'string', create: true, minLength: 5 } },
          }}
          schemas={{}}
          onSubmit={submit}
        />
      </>
    );
  }
  const { container } = render(
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
      <Form />
    </I18nProvider>,
  );
  const name = screen.getByRole('textbox', { name: 'Nome' });
  fireEvent.change(name, { target: { value: 'abc' } });
  fireEvent.submit(container.querySelector('form')!);
  expect(screen.getByText(/Nome precisa ter pelo menos 5 caracteres/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByText(/Name.*at least 5 characters/)).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Name' })).toBe(name);
  expect(name).toHaveValue('abc');
  expect(submit).not.toHaveBeenCalled();
});

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
