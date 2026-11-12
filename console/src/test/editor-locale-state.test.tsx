import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { I18nProvider, useI18n } from '../i18n/provider';
import { CapabilityEditor } from '../components/CapabilityEditor';
import { MemoryEditor } from '../components/MemoryEditor';
import { SchemaForm } from '../components/SchemaForm';
import { ComposeEditor } from '../components/ComposeEditor';
import { CpuResourceEditor } from '../components/CpuResourceEditor';
import { HealthCheckEditor } from '../components/HealthCheckEditor';
import { WorkloadBindingsEditor } from '../components/WorkloadBindingsEditor';
import { faIR } from '../i18n/catalogs/fa-IR';
import { frFR } from '../i18n/catalogs/fr-FR';

it('preserves legacy port bindings and their direction when switching to Persian', async () => {
  const change = vi.fn();
  const legacy = 'native-port-fixture';
  function Editor() {
    const { setLocale } = useI18n();
    return (
      <>
        <button onClick={() => setLocale('fa-IR')}>Persian</button>
        <WorkloadBindingsEditor
          kind="ports"
          value={[legacy, '[::1]:9000:80/udp']}
          onChange={change}
        />
      </>
    );
  }
  render(
    <I18nProvider
      policy={{
        enabled: true,
        defaultLocale: 'pt-BR',
        availableLocales: ['pt-BR', 'fa-IR'],
        selectable: true,
        detectBrowser: false,
        preview: true,
      }}
    >
      <Editor />
    </I18nProvider>,
  );
  const port = screen.getByRole('textbox', { name: 'Porta no host 2' });
  fireEvent.change(port, { target: { value: '9001' } });
  fireEvent.click(screen.getByRole('button', { name: 'Persian' }));
  await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
  const bindings = screen.getByRole('group', { name: faIR['bindingsEditor.portsTitle'] });
  const index = new Intl.NumberFormat('fa-IR').format(2);
  expect(bindings).toContainElement(port);
  expect(port).toHaveAccessibleName(faIR['bindingsEditor.hostPort'].replace('{index}', index));
  expect(port).toHaveAttribute('dir', 'ltr');
  expect(port).toHaveValue('9001');
  expect(screen.getByText(legacy)).toHaveAttribute('dir', 'ltr');
  expect(screen.getByRole('combobox')).toHaveValue('udp');
  expect(change).toHaveBeenCalledExactlyOnceWith([legacy, '[::1]:9001:80/udp']);
});

it('preserves the HTTP health check draft and native values when switching to French', async () => {
  const change = vi.fn();
  const initial = { port: '8080', requestLine: 'HEAD "/ready" "HTTP/1.1"' };
  function Editor() {
    const { setLocale } = useI18n();
    const [value, setValue] = useState<unknown>(initial);
    return (
      <>
        <button onClick={() => setLocale('fr-FR')}>Français</button>
        <HealthCheckEditor
          schema={{
            id: 'instanceHealthCheck',
            pluralName: 'instanceHealthChecks',
            links: {},
            resourceFields: { requestLine: { type: 'string', create: true } },
          }}
          value={value}
          onChange={(next) => {
            setValue(next);
            change(next);
          }}
        />
      </>
    );
  }
  render(
    <I18nProvider
      policy={{
        enabled: true,
        defaultLocale: 'pt-BR',
        availableLocales: ['pt-BR', 'fr-FR'],
        selectable: true,
        detectBrowser: false,
        preview: true,
      }}
    >
      <Editor />
    </I18nProvider>,
  );
  const path = screen.getByRole('textbox', { name: 'Caminho da verificação HTTP' });
  fireEvent.change(path, { target: { value: '/internal/status' } });
  fireEvent.click(screen.getByRole('button', { name: 'Français' }));
  expect(await screen.findByRole('textbox', { name: frFR['healthCheckEditor.path'] })).toBe(path);
  expect(path).toHaveValue('/internal/status');
  expect(screen.getByRole('combobox', { name: frFR['healthCheckEditor.type'] })).toHaveValue(
    'http',
  );
  expect(screen.getByRole('combobox', { name: frFR['healthCheckEditor.method'] })).toHaveValue(
    'HEAD',
  );
  expect(screen.getByRole('combobox', { name: frFR['healthCheckEditor.version'] })).toHaveValue(
    'HTTP/1.1',
  );
  expect(change).toHaveBeenCalledExactlyOnceWith({
    port: '8080',
    requestLine: 'HEAD "/internal/status" "HTTP/1.1"',
  });
});

it('retranslates the native CPU validation message without changing the draft', async () => {
  const change = vi.fn();
  function CpuEditor() {
    const { setLocale } = useI18n();
    return (
      <>
        <button onClick={() => setLocale('fr-FR')}>Français</button>
        <CpuResourceEditor name="cpuShares" value={null} onChange={change} />
      </>
    );
  }
  render(
    <I18nProvider
      policy={{
        enabled: true,
        defaultLocale: 'pt-BR',
        availableLocales: ['pt-BR', 'fr-FR'],
        selectable: true,
        detectBrowser: false,
        preview: true,
      }}
    >
      <CpuEditor />
    </I18nProvider>,
  );
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Peso de CPU' });
  fireEvent.change(input, { target: { value: '1e3' } });
  expect(input).toBeInvalid();
  fireEvent.click(screen.getByRole('button', { name: 'Français' }));
  expect(await screen.findByRole('textbox', { name: 'Poids du CPU' })).toBe(input);
  expect(input).toHaveValue('1e3');
  expect(input.validationMessage).toBe(
    'Saisissez un entier sans fraction ni notation exponentielle.',
  );
  expect(change).toHaveBeenCalledExactlyOnceWith('1e3');
  fireEvent.change(input, { target: { value: '256' } });
  expect(input).toBeValid();
  expect(change).toHaveBeenLastCalledWith(256);
});

function Editor() {
  const { setLocale } = useI18n();
  const [value, setValue] = useState<string[]>(['NET_RAW']);
  return (
    <>
      <button onClick={() => setLocale('en-US')}>English</button>
      <button onClick={() => setLocale('fr-FR')}>Français</button>
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

it('keeps Compose source left to right and preserves the draft when switching to Persian', async () => {
  const initial = 'services:\n  web:\n    image: alpine:3.20\n';
  function Composer() {
    const { setLocale } = useI18n();
    const [source, setSource] = useState(initial);
    return (
      <>
        <button onClick={() => setLocale('fa-IR')}>Persian</button>
        <ComposeEditor label="Docker Compose" value={source} onChange={setSource} />
      </>
    );
  }
  render(
    <I18nProvider
      policy={{
        enabled: true,
        defaultLocale: 'pt-BR',
        availableLocales: ['pt-BR', 'fa-IR'],
        selectable: true,
        detectBrowser: false,
        preview: true,
      }}
    >
      <Composer />
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar Docker Compose' }));
  const source = screen.getByRole('textbox', { name: 'Docker Compose' });
  const draft = initial + '# fixture\n';
  fireEvent.change(source, { target: { value: draft } });
  fireEvent.click(screen.getByRole('button', { name: 'Persian' }));
  await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
  expect(screen.getByRole('textbox', { name: 'Docker Compose' })).toBe(source);
  expect(source).toHaveAttribute('dir', 'ltr');
  expect(source).toHaveValue(draft);
});

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

it('preserves invalid JSON and retranslates its browser validation in place', () => {
  function JsonEditor() {
    const { setLocale } = useI18n();
    return (
      <>
        <button onClick={() => setLocale('en-US')}>English</button>
        <SchemaForm
          schemas={{}}
          onSubmit={vi.fn()}
          schema={{
            id: 'fixture',
            pluralName: 'fixtures',
            links: {},
            resourceFields: { payload: { type: 'map[int]', create: true, required: true } },
          }}
        />
      </>
    );
  }
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
      <JsonEditor />
    </I18nProvider>,
  );
  const json = screen.getByRole('textbox', { name: 'Payload *' }) as HTMLTextAreaElement;
  fireEvent.change(json, { target: { value: '{ invalid' } });
  expect(json.validationMessage).toBe('Informe JSON válido.');
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByRole('textbox', { name: 'Payload *' })).toBe(json);
  expect(json).toHaveValue('{ invalid');
  expect(json).toHaveAttribute('dir', 'ltr');
  expect(json.validationMessage).toBe('Enter valid JSON.');
  fireEvent.change(json, { target: { value: '{"count":1}' } });
  expect(json.validationMessage).toBe('');
});

it('preserves a selected native capability and its control when switching locale', async () => {
  const user = userEvent.setup();
  render(
    <I18nProvider
      policy={{
        enabled: true,
        defaultLocale: 'pt-BR',
        availableLocales: ['pt-BR', 'en-US', 'fr-FR'],
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
  await user.click(screen.getByRole('button', { name: 'Français' }));
  expect(await screen.findByLabelText('Memory : valeur')).toBe(memory);
  expect(memory).toHaveValue('0invalid');
  expect((memory as HTMLInputElement).validationMessage).toBe(
    'Saisissez une valeur de mémoire positive ou nulle, sans notation exponentielle.',
  );
  expect(control).toHaveValue('ALL');
});
