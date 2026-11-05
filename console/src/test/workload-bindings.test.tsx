import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  decodeBinding,
  encodeBinding,
  validateBindings,
  validateBindingFields,
} from '../workload-bindings';
import { SchemaForm } from '../components/SchemaForm';
import type { Schema } from '../api';
const schema: Schema = {
  id: 'container',
  pluralName: 'containers',
  links: {},
  collectionMethods: ['POST'],
  resourceFields: {
    name: { type: 'string', create: true },
    ports: { type: 'array[string]', create: true },
    dataVolumes: { type: 'array[string]', create: true },
  },
};
function mount(initialValues: Record<string, unknown> = {}, enabled = true) {
  const submit = vi.fn();
  render(
    <SchemaForm
      schema={schema}
      schemas={{}}
      initialValues={initialValues}
      bindingEditors={enabled}
      onSubmit={submit}
    />,
  );
  return submit;
}
const submitForm = () => fireEvent.submit(document.querySelector('form')!);
describe('Bindings estruturados de workloads', () => {
  it.each(['80', '80/tcp', '8080:80', '8080:80/udp', '127.0.0.1:8080:80/tcp', '[::1]:8080:80/tcp'])(
    'preserva literalmente a porta recebida %s',
    (value) => {
      const row = decodeBinding('ports', value, 0);
      expect(row.kind).toBe('ports');
      expect(encodeBinding(row)).toBe(value);
      expect(() => validateBindings('ports', [value])).not.toThrow();
    },
  );
  it.each(['/data', 'cache:/data', 'cache:/data:ro', '/var/lib/app:/data:rw'])(
    'preserva literalmente o volume recebido %s',
    (value) => {
      const row = decodeBinding('dataVolumes', value, 0);
      expect(row.kind).toBe('dataVolumes');
      expect(encodeBinding(row)).toBe(value);
      expect(() => validateBindings('dataVolumes', [value])).not.toThrow();
    },
  );
  it('preserva volume anônimo com permissão nativa e valida seu destino', () => {
    for (const mode of ['ro', 'rw']) {
      const row = decodeBinding('dataVolumes', `/data:${mode}`, 1);
      expect(row).toMatchObject({ kind: 'dataVolumes', source: '', target: '/data', mode });
      expect(encodeBinding(row)).toBe(`/data:${mode}`);
      expect(() => validateBindings('dataVolumes', [`/data:${mode}`])).not.toThrow();
      expect(() => validateBindings('dataVolumes', [`/data:${mode}`, 'cache:/data'])).toThrow(
        'destino',
      );
    }
  });
  it('mantém strings avançadas somente quando já pertencem à configuração inicial', () => {
    for (const [kind, value] of [
      ['ports', '8000-8010:80-90/tcp'],
      ['dataVolumes', 'C:\\data:/data:ro'],
      ['dataVolumes', 'cache:/data:ro,z'],
    ] as const) {
      expect(decodeBinding(kind, value, 0).kind).toBe('native');
      expect(() => validateBindings(kind, [value], [value])).not.toThrow();
      expect(() => validateBindings(kind, [value, value], [value])).toThrow();
      expect(() => validateBindings(kind, [value])).toThrow();
    }
  });
  it('recusa portas vazias, IP inválido, protocolos desconhecidos e faixas recém-introduzidas', () => {
    for (const value of [
      '',
      ':80/tcp',
      '8080:/tcp',
      '65536:80/tcp',
      '1e3:80/tcp',
      '127.0.0.999:80:80/tcp',
      'host.example:8080:80/tcp',
      '[bad::g]:80:80/tcp',
      '80/sctp',
    ])
      expect(() => validateBindings('ports', [value])).toThrow();
  });
  it('serializa uma edição sem interpretar comandos, inclusive IPv6', () => {
    expect(
      encodeBinding({
        kind: 'ports',
        key: 0,
        host: '8080',
        container: '80',
        ip: '::1',
        protocol: 'tcp',
        changed: true,
      }),
    ).toBe('[::1]:8080:80/tcp');
    expect(
      encodeBinding({
        kind: 'dataVolumes',
        key: 0,
        source: '/srv/app',
        target: '/data',
        mode: 'ro',
        changed: true,
      }),
    ).toBe('/srv/app:/data:ro');
  });
  it('recusa colisões de publicação, incluindo IP curinga, zeros e aliases IPv6', () => {
    for (const values of [
      ['8080:80/tcp', '8080:81/tcp'],
      ['08080:80/tcp', '8080:81/tcp'],
      ['0.0.0.0:8080:80/tcp', '127.0.0.1:8080:81/tcp'],
      ['[::1]:8080:80/tcp', '[0:0:0:0:0:0:0:1]:8080:81/tcp'],
    ])
      expect(() => validateBindings('ports', values)).toThrow('conflitantes');
    expect(() => validateBindings('ports', ['8080:80/tcp', '8080:80/udp'])).not.toThrow();
  });
  it('recusa destino duplicado e volumes incompletos/relativos', () => {
    for (const values of [
      ['cache:/data', 'other:/data/'],
      ['cache:/data', 'other:/tmp/../data'],
      ['cache:relative'],
      ['/data:unsupported'],
      [':/data:rw'],
      [''],
    ])
      expect(() => validateBindings('dataVolumes', values)).toThrow();
  });
  it('limita linhas e não permite controles em entrada avançada preservada', () => {
    expect(() =>
      validateBindings(
        'ports',
        Array.from({ length: 101 }, () => '80/tcp'),
      ),
    ).toThrow('100');
    expect(() =>
      validateBindings('dataVolumes', ['unsafe\n:/data:z'], ['unsafe\n:/data:z']),
    ).toThrow();
  });
  it('valida só campos tipados de bindings, sem confundir variáveis de ambiente', () => {
    const launch: Schema = {
      ...schema,
      id: 'launchConfig',
      resourceFields: {
        ...schema.resourceFields,
        environment: { type: 'map[string]', create: true },
      },
    };
    const service: Schema = {
      ...schema,
      id: 'service',
      resourceFields: { launchConfig: { type: 'launchConfig', create: true } },
    };
    expect(() =>
      validateBindingFields(
        service,
        { launchConfig: { ports: ['8080:80/tcp'], environment: { ports: 'not a binding' } } },
        { launchConfig: launch },
      ),
    ).not.toThrow();
    expect(() =>
      validateBindingFields(
        service,
        { launchConfig: { ports: ['8080:/tcp'] } },
        { launchConfig: launch },
      ),
    ).toThrow();
  });
  it('cria porta pelo formulário real e não envia linha incompleta silenciosamente', async () => {
    const submit = mount(),
      user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Adicionar porta' }));
    submitForm();
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Revise portas');
    await user.type(screen.getByLabelText('Porta do container 1'), '80');
    await user.type(screen.getByLabelText('Porta no host 1'), '8080');
    submitForm();
    expect(submit).toHaveBeenCalledWith({ ports: ['8080:80/tcp'] });
  });
  it('cria volume nomeado readonly e remove linha sem trocar os valores seguintes', async () => {
    const submit = mount(),
      user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Adicionar volume' }));
    await user.type(screen.getByLabelText('Origem do volume 1'), 'cache');
    await user.type(screen.getByLabelText('Destino do volume 1'), '/data');
    await user.selectOptions(screen.getByLabelText('Acesso do volume 1'), 'ro');
    await user.click(screen.getByRole('button', { name: 'Adicionar volume' }));
    await user.type(screen.getByLabelText('Destino do volume 2'), '/tmp');
    await user.click(screen.getByRole('button', { name: 'Remover volume 1' }));
    expect(screen.getByLabelText('Destino do volume 1')).toHaveValue('/tmp');
    submitForm();
    expect(submit).toHaveBeenCalledWith({ dataVolumes: ['/tmp'] });
  });
  it('preserva entrada opaca ao editar outra linha e só remove mediante ação explícita', async () => {
    const submit = mount({ ports: ['8000-8010:80-90/tcp', '8080:80/tcp'] }),
      user = userEvent.setup();
    expect(screen.getByText('8000-8010:80-90/tcp')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Porta do container 2'));
    await user.type(screen.getByLabelText('Porta do container 2'), '81');
    submitForm();
    expect(submit).toHaveBeenLastCalledWith({ ports: ['8000-8010:80-90/tcp', '8080:81/tcp'] });
    await user.click(screen.getByRole('button', { name: 'Remover porta 1' }));
    submitForm();
    expect(submit).toHaveBeenLastCalledWith({ ports: ['8080:81/tcp'] });
  });
  it('aplica o mesmo editor dentro do launchConfig de serviço', async () => {
    const service: Schema = {
      ...schema,
      id: 'service',
      resourceFields: { launchConfig: { type: 'launchConfig', create: true, required: true } },
    };
    const submit = vi.fn(),
      user = userEvent.setup();
    render(
      <SchemaForm
        schema={service}
        schemas={{ launchConfig: { ...schema, id: 'launchConfig' } }}
        layout="workload"
        bindingEditors
        onSubmit={submit}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Adicionar porta' }));
    await user.type(screen.getByLabelText('Porta do container 1'), '9090');
    submitForm();
    expect(submit).toHaveBeenCalledWith({ launchConfig: { ports: ['9090/tcp'] } });
  });
  it('flag desligada mantém textarea nativa e valores avançados sem conversão', () => {
    const submit = mount({ ports: ['8000-8010:80-90/tcp'] }, false);
    expect(screen.queryByRole('button', { name: 'Adicionar porta' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Portas publicadas' })).toHaveValue(
      '8000-8010:80-90/tcp',
    );
    submitForm();
    expect(submit).toHaveBeenCalledWith({ ports: ['8000-8010:80-90/tcp'] });
  });
});
