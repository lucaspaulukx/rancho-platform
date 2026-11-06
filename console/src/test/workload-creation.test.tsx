import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Schema, SchemaField } from '../api';
import { validateWorkloadCreation, workloadSections } from '../workload-creation';
import { SchemaForm } from '../components/SchemaForm';
import { I18nProvider, useI18n } from '../i18n/provider';
import type { LocalizationPolicy } from '../i18n/policy';
const field: SchemaField = { type: 'string', create: true };
const launch: Schema = {
  id: 'launchConfig',
  pluralName: 'launchConfigs',
  links: {},
  resourceFields: {
    imageUuid: { ...field, required: true },
    command: { type: 'array[string]', create: true },
    environment: { type: 'map[string]', create: true },
    privileged: { type: 'boolean', create: true, default: false },
    memory: { type: 'long', create: true, min: 0 },
  },
};
const service: Schema = {
  id: 'service',
  pluralName: 'services',
  links: {},
  collectionMethods: ['POST'],
  resourceFields: {
    name: { ...field, required: true },
    scale: { type: 'int', create: true, min: 0, default: 0 },
    launchConfig: { type: 'launchConfig', create: true, required: true },
  },
};
describe('Criação de workloads organizada', () => {
  it('preserves schema fields and native payload while changing the form language', async () => {
    const policy: LocalizationPolicy = {
      enabled: true,
      defaultLocale: 'pt-BR',
      availableLocales: ['pt-BR', 'en-US'],
      selectable: true,
      detectBrowser: false,
      preview: true,
    };
    function LanguageButton() {
      const { setLocale } = useI18n();
      return <button onClick={() => setLocale('en-US')}>English</button>;
    }
    const onSubmit = vi.fn();
    const schema = {
      ...service,
      resourceFields: {
        name: field,
        description: { ...field, label: 'Native label' },
      },
    };
    const user = userEvent.setup();
    render(
      <I18nProvider policy={policy}>
        <LanguageButton />
        <SchemaForm id="locale-test-form" schema={schema} schemas={{}} onSubmit={onSubmit} />
      </I18nProvider>,
    );
    await user.type(screen.getByLabelText('Nome'), 'fixture');
    await user.type(screen.getByLabelText('Native label'), 'Conteúdo original');
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByLabelText('Name')).toHaveValue('fixture');
    expect(screen.getByLabelText('Native label')).toHaveValue('Conteúdo original');
    fireEvent.submit(document.getElementById('locale-test-form')!);
    expect(onSubmit).toHaveBeenCalledWith({ name: 'fixture', description: 'Conteúdo original' });
  });
  it('cada campo aparece exatamente uma vez; desconhecidos obrigatórios ficam visíveis e opcionais avançados', () => {
    const entries: [string, SchemaField][] = [
      ['name', field],
      ['ports', field],
      ['privileged', field],
      ['futureOption', field],
      ['futureRequired', { ...field, required: true }],
    ];
    const result = workloadSections(entries);
    expect(result.groups.flatMap((v) => v.entries).map(([name]) => name)).toEqual([
      'name',
      'ports',
      'privileged',
      'futureRequired',
    ]);
    expect(result.advanced.map(([name]) => name)).toEqual(['futureOption']);
    expect(
      new Set(
        [...result.groups.flatMap((v) => v.entries), ...result.advanced].map(([name]) => name),
      ).size,
    ).toBe(entries.length);
  });
  it('preserva zero, false, argumentos com espaços e variáveis sem interpretar shell', () => {
    expect(
      validateWorkloadCreation(
        service,
        {
          name: 'web',
          scale: 0,
          launchConfig: {
            imageUuid: 'alpine:3.20',
            privileged: false,
            command: ['echo', 'hello world'],
            environment: { MESSAGE: 'á ${OTHER}' },
          },
        },
        { launchConfig: launch },
      ),
    ).toEqual({
      name: 'web',
      scale: 0,
      launchConfig: {
        imageUuid: 'docker:alpine:3.20',
        privileged: false,
        command: ['echo', 'hello world'],
        environment: { MESSAGE: 'á ${OTHER}' },
      },
    });
  });
  it('recusa campo raiz/aninhado revogado em vez de filtrar silenciosamente o rascunho', () => {
    expect(() =>
      validateWorkloadCreation(service, { name: 'web', launchConfig: { imageUuid: 'x' } }, {}),
    ).toThrow('schema');
    expect(() =>
      validateWorkloadCreation(service, { name: 'web', unknown: 'x' }, { launchConfig: launch }),
    ).toThrow('unknown');
    expect(() =>
      validateWorkloadCreation(
        service,
        { name: 'web', launchConfig: { imageUuid: 'x', privileged: true } },
        {
          launchConfig: {
            ...launch,
            resourceFields: { imageUuid: launch.resourceFields.imageUuid },
          },
        },
      ),
    ).toThrow('privileged');
    expect(() =>
      validateWorkloadCreation(
        { ...service, collectionMethods: ['GET'] },
        { name: 'web' },
        { launchConfig: launch },
      ),
    ).toThrow('disponível');
  });
  it('valida também objetos em arrays antes de preparar o payload', () => {
    const schema = {
      ...service,
      resourceFields: { name: field, sidekicks: { type: 'array[launchConfig]', create: true } },
    };
    expect(() =>
      validateWorkloadCreation(
        schema,
        { name: 'web', sidekicks: [{ imageUuid: 'alpine', revoked: 'x' }] },
        { launchConfig: launch },
      ),
    ).toThrow('revoked');
  });
  it('organiza launchConfig com seções e mantém payload tipado e valores privados mascarados', async () => {
    const submit = vi.fn();
    render(
      <SchemaForm
        id="create-workload"
        schema={service}
        schemas={{ launchConfig: launch }}
        layout="workload"
        onSubmit={submit}
      />,
    );
    await userEvent.click(screen.getByText('Segurança', { exact: true }));
    expect(screen.getByRole('checkbox', { name: 'Modo privilegiado' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'fixture' } });
    fireEvent.change(screen.getByLabelText('Imagem *'), { target: { value: 'alpine:3.20' } });
    fireEvent.change(screen.getByLabelText('Comando'), { target: { value: 'echo\nhello world' } });
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    fireEvent.change(screen.getByLabelText('Variáveis de ambiente: chave 1'), {
      target: { value: 'MESSAGE' },
    });
    fireEvent.change(screen.getByLabelText('Variáveis de ambiente: valor 1'), {
      target: { value: 'private-value' },
    });
    expect(screen.getByLabelText('Variáveis de ambiente: valor 1')).toHaveAttribute(
      'type',
      'password',
    );
    fireEvent.submit(document.getElementById('create-workload')!);
    expect(submit).toHaveBeenCalledWith({
      name: 'fixture',
      scale: 0,
      launchConfig: {
        imageUuid: 'docker:alpine:3.20',
        command: ['echo', 'hello world'],
        environment: { MESSAGE: 'private-value' },
        privileged: false,
      },
    });
  });
});
