import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Resource, Schema } from '../api';
import {
  canScaleService,
  prepareServiceScale,
  scaleValue,
  ServiceScaleValidationError,
} from '../service-scaling';
import { ServiceScaleForm } from '../components/ServiceScaleForm';
import type { Locale } from '../i18n/locales';
import { I18nProvider } from '../i18n/provider';
import { operationCommands } from '../operation-actions';
const resource = {
  id: 's1',
  type: 'service',
  name: 'web',
  accountId: 'p1',
  state: 'active',
  scale: 2,
  links: {},
} as Resource;
const schema = {
  id: 'service',
  pluralName: 'services',
  links: {},
  resourceFields: { scale: { type: 'int', update: true, min: 0, max: 10 } },
  resourceMethods: ['GET', 'PUT'],
} as Schema;
describe('Escala efetiva de serviços', () => {
  it('oferece o comando somente com flag e contrato atualizável, sem serviço global ou em upgrade', () => {
    expect(canScaleService(resource, schema, true)).toBe(true);
    expect(canScaleService(resource, schema, false)).toBe(false);
    expect(canScaleService(resource, { ...schema, resourceMethods: ['GET'] }, true)).toBe(false);
    expect(canScaleService({ ...resource, state: 'upgrading' }, schema, true)).toBe(false);
    expect(
      canScaleService(
        { ...resource, launchConfig: { labels: { 'io.rancher.scheduler.global': 'true' } } },
        schema,
        true,
      ),
    ).toBe(false);
  });
  it.each(['', ' ', '-1', '1.5', '1e2', '0x10', '9007199254740992', '11', null, false])(
    'recusa escala inválida %j',
    (value) => {
      expect(() => scaleValue(value, schema.resourceFields.scale)).toThrow();
    },
  );
  it('envia somente scale e recusa no-op, conflito ou outro environment', () => {
    expect(prepareServiceScale(resource, resource, schema, '0')).toEqual({ scale: 0 });
    expect(() => prepareServiceScale(resource, resource, schema, '2')).toThrow('diferente');
    expect(() => prepareServiceScale(resource, { ...resource, scale: 3 }, schema, '1')).toThrow(
      'outro cliente',
    );
    expect(() =>
      prepareServiceScale(resource, { ...resource, accountId: 'p2' }, schema, '1'),
    ).toThrow('não está disponível');
  });
  it('insere a escala no menu sem expor comando a readonly ou flag desativada', () => {
    const options = {
      environment: 'p1',
      observability: false,
      metrics: false,
      containers: [],
      containerWritable: false,
      createService: false,
      restartServices: 0,
      scaling: true,
    };
    expect(operationCommands(resource, schema, options)).toContainEqual({
      id: 'scale',
      label: 'Escalar serviço',
      kind: 'scale',
    });
    expect(
      operationCommands(resource, { ...schema, resourceMethods: ['GET'] }, options).some(
        (v) => v.kind === 'scale',
      ),
    ).toBe(false);
    expect(
      operationCommands(resource, schema, { ...options, scaling: false }).some(
        (v) => v.kind === 'scale',
      ),
    ).toBe(false);
  });
  it('reduz a escala a zero somente depois da confirmação explícita do produto', async () => {
    const submit = vi.fn(),
      dirty = vi.fn();
    render(
      <>
        <ServiceScaleForm
          resource={resource}
          schema={schema}
          onSubmit={submit}
          onDirtyChange={dirty}
          busy={false}
          error={null}
        />
        <button form="workspace-resource-form">Aplicar</button>
      </>,
    );
    const input = screen.getByLabelText('Quantidade desejada de containers');
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(submit).not.toHaveBeenCalled();
    await screen.findByText(/Confirme o encerramento/);
    await userEvent.click(screen.getByRole('checkbox', { name: /Entendo que escala zero/ }));
    expect(screen.queryByText(/Confirme o encerramento/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(submit).toHaveBeenCalledExactlyOnceWith({ scale: 0 });
    expect(dirty).toHaveBeenCalledWith(true);
  });
  it('retira o aceite de zero ao editar a quantidade novamente', async () => {
    render(
      <ServiceScaleForm
        resource={resource}
        schema={schema}
        onSubmit={vi.fn()}
        onDirtyChange={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    const input = screen.getByLabelText('Quantidade desejada de containers');
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    await userEvent.click(screen.getByRole('checkbox', { name: /Entendo que escala zero/ }));
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    expect(screen.getByRole('checkbox', { name: /Entendo que escala zero/ })).not.toBeChecked();
  });

  it('translates form and submission validation without resetting the draft', async () => {
    const submit = vi.fn();
    const dirty = vi.fn();
    const form = (locale: Locale, error: Error | null = null) => (
      <I18nProvider
        policy={{
          enabled: true,
          defaultLocale: locale,
          availableLocales: ['pt-BR', 'en-US'],
          selectable: false,
          detectBrowser: false,
          preview: true,
        }}
      >
        <ServiceScaleForm
          resource={resource}
          schema={schema}
          onSubmit={submit}
          onDirtyChange={dirty}
          busy={false}
          error={error}
        />
        <button form="workspace-resource-form">Apply fixture</button>
      </I18nProvider>
    );
    const { rerender } = render(form('pt-BR'));
    await userEvent.click(screen.getByRole('button', { name: 'Apply fixture' }));
    expect(screen.getByText('Informe uma escala diferente da atual.')).toBeInTheDocument();

    rerender(form('en-US'));
    expect(screen.getByText('Enter a scale different from the current scale.')).toBeInTheDocument();
    const input = screen.getByRole('spinbutton', { name: 'Desired container count' });
    await userEvent.clear(input);
    await userEvent.type(input, '3');
    expect(submit).not.toHaveBeenCalled();

    rerender(form('en-US', new ServiceScaleValidationError('serviceEditors.scaleError.changed')));
    expect(
      screen.getByText('Another client changed the scale. Reopen the panel to refresh it.'),
    ).toBeInTheDocument();
    expect(input).toHaveValue(3);

    rerender(form('en-US', new Error('Native Rancher error')));
    expect(screen.getByText('Native Rancher error')).toBeInTheDocument();
  });
});
