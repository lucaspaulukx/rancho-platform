import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Resource, Schema } from '../api';
import contract from './fixtures/upgrade-schema.json';
import {
  imageUpgradePayload,
  supportsImageUpgrade,
  configurationUpgradePayload,
  supportsConfigurationUpgrade,
  supportsHealthCheckUpgrade,
  supportsSidecarUpgrade,
  editableSidecars,
  supportsSchedulingUpgrade,
} from '../service-upgrade';
import { ServiceUpgradeForm } from '../components/ServiceUpgradeForm';
import { frFR } from '../i18n/catalogs/fr-FR';
import { I18nProvider, useI18n } from '../i18n/provider';

const launchFields = {
  imageUuid: { type: 'string', create: true },
  environment: { type: 'map[string]', create: true },
  ports: { type: 'array[string]', create: true },
  dataVolumes: { type: 'array[string]', create: true },
  name: { type: 'string', create: true },
  id: { type: 'string', create: false },
};
const schemas = {
  ...contract.schemas,
  launchConfig: { id: 'launchConfig', resourceFields: launchFields, links: {} },
  secondaryLaunchConfig: { id: 'secondaryLaunchConfig', resourceFields: launchFields, links: {} },
} as unknown as Record<string, Schema>;
const resource = {
  id: 's1',
  type: 'service',
  accountId: 'p1',
  links: {},
  launchConfig: {
    imageUuid: 'docker:app:1',
    environment: { MODE: 'test' },
    ports: ['8080:80'],
    dataVolumes: ['store:/data'],
    id: 'read-only',
  },
  secondaryLaunchConfigs: [{ name: 'worker', imageUuid: 'docker:worker:1', id: 'read-only' }],
} as Resource;
const values = { image: 'app:2', batchSize: '2', intervalMillis: '2000', startFirst: true };
const healthSchemas = {
  ...schemas,
  launchConfig: {
    ...schemas.launchConfig,
    resourceFields: {
      ...schemas.launchConfig.resourceFields,
      healthCheck: { type: 'instanceHealthCheck', create: true, nullable: true },
    },
  },
  instanceHealthCheck: {
    id: 'instanceHealthCheck',
    links: {},
    pluralName: 'instanceHealthChecks',
    resourceFields: {
      port: { type: 'int', create: true, required: true, min: 1, max: 65535 },
      requestLine: { type: 'string', create: true },
      strategy: { type: 'enum', create: true, options: ['none', 'recreate'] },
    },
  },
} as Record<string, Schema>;
describe('Atualização contextual do serviço', () => {
  it('reviews a port change in French while preserving the native upgrade draft', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const current: Resource = {
      ...resource,
      name: 'web',
      state: 'active',
      actions: { upgrade: '/upgrade' },
    };
    function Editor() {
      const { setLocale, t } = useI18n();
      return (
        <>
          <button onClick={() => setLocale('fr-FR')}>Français</button>
          <ServiceUpgradeForm
            bindingsEnabled
            resource={current}
            schemas={schemas}
            onSubmit={submit}
            onDirtyChange={vi.fn()}
            busy={false}
            error={null}
          />
          <button type="submit" form="workspace-resource-form">
            {t('serviceUpgradeForm.review')}
          </button>
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
    await user.click(screen.getByLabelText('Editar portas e volumes nesta atualização'));
    const port = screen.getByRole('textbox', { name: 'Porta no host 1' });
    await user.clear(port);
    await user.type(port, '8081');
    await user.click(screen.getByRole('button', { name: 'Français' }));
    await user.click(
      await screen.findByRole('button', { name: frFR['serviceUpgradeForm.review'] }),
    );
    const dialog = await screen.findByRole('dialog', { name: frFR['serviceUpgradeForm.confirm'] });
    expect(dialog).toHaveTextContent(frFR['serviceUpgradeForm.impact'].replace('{service}', 'web'));
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: frFR['ui.confirm'] }));
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        editBindings: true,
        ports: ['8081:80/tcp'],
        dataVolumes: ['store:/data'],
        image: 'app:1',
      }),
    );
  });

  it('upgrade de segurança preserva imagem/bindings e valida schema/valores/conflito/no-op', () => {
    const field = { type: 'array[enum]', create: true, options: ['ALL', 'NET_BIND_SERVICE'] };
    const native = {
      ...schemas,
      launchConfig: {
        ...schemas.launchConfig,
        resourceFields: {
          ...schemas.launchConfig.resourceFields,
          capAdd: field,
          capDrop: field,
          readOnly: { type: 'boolean', create: true },
          privileged: { type: 'boolean', create: true },
        },
      },
    };
    const current: Resource = { ...resource, state: 'active', actions: { upgrade: '/upgrade' } };
    const draft = {
      ...values,
      image: 'app:1',
      editSecurity: true,
      capAdd: ['NET_BIND_SERVICE'],
      capDrop: ['ALL'],
      readOnly: true,
      privileged: false,
    };
    expect(configurationUpgradePayload(current, current, draft, native)).toMatchObject({
      inServiceStrategy: {
        launchConfig: {
          capAdd: ['NET_BIND_SERVICE'],
          capDrop: ['ALL'],
          readOnly: true,
          privileged: false,
          imageUuid: 'docker:app:1',
          ports: ['8080:80'],
        },
      },
    });
    expect(() =>
      configurationUpgradePayload(current, current, { ...draft, capAdd: ['UNKNOWN'] }, native),
    ).toThrow();
    expect(() =>
      configurationUpgradePayload(current, current, { ...draft, readOnly: 'true' }, native),
    ).toThrow();
    expect(() =>
      configurationUpgradePayload(
        current,
        current,
        { ...draft, capAdd: [], capDrop: [], readOnly: false },
        native,
      ),
    ).toThrow('Altere');
    expect(() =>
      configurationUpgradePayload(
        current,
        { ...current, launchConfig: { ...(current.launchConfig as object), privileged: true } },
        draft,
        native,
      ),
    ).toThrow('outro cliente');
    expect(() => configurationUpgradePayload(current, current, draft, schemas)).toThrow();
  });

  it('upgrade de memória mantém imagem e bindings, valida reserva e conflito completo', () => {
    const native = {
      ...schemas,
      launchConfig: {
        ...schemas.launchConfig,
        resourceFields: {
          ...schemas.launchConfig.resourceFields,
          memory: { type: 'int', create: true },
          memoryReservation: { type: 'int', create: true },
        },
      },
    };
    const current: Resource = { ...resource, state: 'active', actions: { upgrade: '/upgrade' } };
    const draft = {
      ...values,
      image: 'app:1',
      editResources: true,
      memory: 134217728,
      memoryReservation: 67108864,
    };
    expect(configurationUpgradePayload(current, current, draft, native)).toMatchObject({
      inServiceStrategy: {
        launchConfig: {
          memory: 134217728,
          memoryReservation: 67108864,
          imageUuid: 'docker:app:1',
          ports: ['8080:80'],
          environment: { MODE: 'test' },
        },
      },
    });
    expect(() =>
      configurationUpgradePayload(current, current, { ...draft, memory: 1 }, native),
    ).toThrow('reserva');
    expect(() =>
      configurationUpgradePayload(
        current,
        current,
        { ...draft, memory: 0, memoryReservation: 0 },
        native,
      ),
    ).toThrow('Altere');
    expect(() =>
      configurationUpgradePayload(
        current,
        { ...current, launchConfig: { ...(current.launchConfig as object), memory: 10 } },
        draft,
        native,
      ),
    ).toThrow('outro cliente');
    expect(() => configurationUpgradePayload(current, current, draft, schemas)).toThrow();
  });

  const schedulingSchemas = {
    ...schemas,
    launchConfig: {
      ...schemas.launchConfig,
      resourceFields: {
        ...schemas.launchConfig.resourceFields,
        labels: { type: 'map[string]', create: true },
      },
    },
  };
  const scheduled: Resource = {
    ...resource,
    state: 'active',
    actions: { upgrade: '/upgrade' },
    launchConfig: { ...(resource.launchConfig as object), labels: { custom: 'kept' } },
  };
  const schedulingValues = {
    ...values,
    image: 'app:1',
    editScheduling: true,
    labels: { custom: 'kept', 'io.rancher.scheduler.affinity:host_label': 'disk=ssd' },
  };
  it('atualiza labels com mesma imagem e preserva bindings, variáveis e sidecars', () => {
    expect(
      configurationUpgradePayload(scheduled, scheduled, schedulingValues, schedulingSchemas),
    ).toMatchObject({
      inServiceStrategy: {
        launchConfig: {
          imageUuid: 'docker:app:1',
          labels: schedulingValues.labels,
          environment: { MODE: 'test' },
          ports: ['8080:80'],
          dataVolumes: ['store:/data'],
        },
        secondaryLaunchConfigs: [{ name: 'worker', imageUuid: 'docker:worker:1' }],
      },
    });
    expect(
      configurationUpgradePayload(
        scheduled,
        scheduled,
        { ...schedulingValues, labels: {} },
        schedulingSchemas,
      ),
    ).toMatchObject({ inServiceStrategy: { launchConfig: { labels: {} } } });
  });
  it('recusa afinidade malformada, schema indisponível, no-op e mudança concorrente de labels', () => {
    expect(supportsSchedulingUpgrade(scheduled, schemas)).toBe(false);
    expect(() =>
      configurationUpgradePayload(
        scheduled,
        scheduled,
        {
          ...schedulingValues,
          labels: { 'io.rancher.scheduler.affinity:host_label': 'incomplete' },
        },
        schedulingSchemas,
      ),
    ).toThrow();
    expect(() =>
      configurationUpgradePayload(
        scheduled,
        scheduled,
        { ...schedulingValues, labels: { custom: 'kept' } },
        schedulingSchemas,
      ),
    ).toThrow('Altere');
    expect(() =>
      configurationUpgradePayload(
        scheduled,
        {
          ...scheduled,
          launchConfig: { ...(scheduled.launchConfig as object), labels: { custom: 'changed' } },
        },
        schedulingValues,
        schedulingSchemas,
      ),
    ).toThrow('outro cliente');
  });
  it('não oferece upgrade estruturado para regras legadas não interpretáveis', () => {
    expect(
      supportsSchedulingUpgrade(
        {
          ...scheduled,
          launchConfig: {
            ...(scheduled.launchConfig as object),
            labels: { 'io.rancher.scheduler.affinity:host_label': 'incomplete' },
          },
        },
        schedulingSchemas,
      ),
    ).toBe(false);
  });
  it('flag de upgrade de afinidades desligada não oferece opt-in', () => {
    render(
      <ServiceUpgradeForm
        resource={scheduled}
        schemas={schedulingSchemas}
        schedulingEnabled={false}
        onSubmit={vi.fn()}
        onDirtyChange={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    expect(screen.queryByLabelText('Editar afinidades nesta atualização')).not.toBeInTheDocument();
  });
  it('rename envia marcador de remoção apenas para nome anterior e rejeita imagem reservada', () => {
    const current: Resource = {
      ...resource,
      name: 'web',
      state: 'active',
      actions: { upgrade: '/upgrade' },
    };
    expect(
      configurationUpgradePayload(
        current,
        current,
        {
          ...values,
          image: 'app:1',
          editSidecars: true,
          secondaryLaunchConfigs: [{ name: 'renamed', imageUuid: 'busybox:1' }],
        },
        schemas,
      ),
    ).toMatchObject({
      inServiceStrategy: {
        secondaryLaunchConfigs: [
          { name: 'renamed', imageUuid: 'docker:busybox:1' },
          { name: 'worker', imageUuid: 'rancher/none' },
        ],
      },
    });
    expect(() =>
      configurationUpgradePayload(
        current,
        current,
        {
          ...values,
          image: 'app:1',
          editSidecars: true,
          secondaryLaunchConfigs: [{ name: 'worker', imageUuid: 'docker:rancher/none' }],
        },
        schemas,
      ),
    ).toThrow('reservada');
    expect(supportsSidecarUpgrade({ ...current, selectorContainer: 'label=value' }, schemas)).toBe(
      false,
    );
  });
  it('adiciona, edita e remove sidecars pelo upgrade mantendo o container primário', () => {
    const current: Resource = {
      ...resource,
      name: 'web',
      state: 'active',
      actions: { upgrade: '/upgrade' },
    };
    const input = {
      ...values,
      image: 'app:1',
      editSidecars: true,
      secondaryLaunchConfigs: [
        { name: 'worker', imageUuid: 'docker:worker:2' },
        { name: 'cache', imageUuid: 'docker:cache:1' },
      ],
    };
    expect(supportsSidecarUpgrade(current, schemas)).toBe(true);
    expect(configurationUpgradePayload(current, current, input, schemas)).toMatchObject({
      inServiceStrategy: {
        launchConfig: {
          imageUuid: 'docker:app:1',
          ports: ['8080:80'],
          dataVolumes: ['store:/data'],
          environment: { MODE: 'test' },
        },
        secondaryLaunchConfigs: input.secondaryLaunchConfigs,
      },
    });
    expect(
      configurationUpgradePayload(
        current,
        current,
        { ...input, secondaryLaunchConfigs: [] },
        schemas,
      ),
    ).toMatchObject({
      inServiceStrategy: {
        secondaryLaunchConfigs: [{ name: 'worker', imageUuid: 'rancher/none' }],
      },
    });
  });
  it('recusa sidecar sem mudança e mudança concorrente de parâmetros ou sidecars', () => {
    const current: Resource = {
      ...resource,
      name: 'web',
      state: 'active',
      actions: { upgrade: '/upgrade' },
    };
    const input = {
      ...values,
      image: 'app:1',
      editSidecars: true,
      secondaryLaunchConfigs: editableSidecars(current, schemas),
    };
    expect(() => configurationUpgradePayload(current, current, input, schemas)).toThrow('Altere');
    for (const fresh of [
      {
        ...current,
        launchConfig: { ...(current.launchConfig as object), environment: { MODE: 'changed' } },
      },
      { ...current, secondaryLaunchConfigs: [] },
    ])
      expect(() =>
        configurationUpgradePayload(
          current,
          fresh,
          { ...input, secondaryLaunchConfigs: [] },
          schemas,
        ),
      ).toThrow('outro cliente');
  });
  it('rejeita campo do sidecar revogado no schema fresco', () => {
    const current: Resource = {
      ...resource,
      name: 'web',
      state: 'active',
      actions: { upgrade: '/upgrade' },
    };
    expect(() =>
      configurationUpgradePayload(
        current,
        current,
        {
          ...values,
          image: 'app:1',
          editSidecars: true,
          secondaryLaunchConfigs: [{ name: 'worker', imageUuid: 'worker:2', revoked: true }],
        },
        schemas,
      ),
    ).toThrow('revoked');
  });
  it('opt-in de sidecars exige revisão e flag off retira o editor', async () => {
    const current: Resource = {
      ...resource,
      name: 'web',
      state: 'active',
      actions: { upgrade: '/upgrade' },
    };
    const user = userEvent.setup(),
      submit = vi.fn();
    const view = render(
      <>
        <ServiceUpgradeForm
          sidecarsEnabled
          resource={current}
          schemas={schemas}
          onSubmit={submit}
          onDirtyChange={vi.fn()}
          busy={false}
          error={null}
        />
        <button type="submit" form="workspace-resource-form">
          Revisar sidecars
        </button>
      </>,
    );
    await user.click(screen.getByLabelText('Editar sidecars nesta atualização'));
    await user.click(screen.getByRole('button', { name: 'Remover sidecar 1' }));
    await user.click(screen.getByRole('button', { name: 'Revisar sidecars' }));
    expect(submit).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ editSidecars: true, secondaryLaunchConfigs: [], image: 'app:1' }),
    );
    view.unmount();
    render(
      <ServiceUpgradeForm
        resource={current}
        schemas={schemas}
        onSubmit={submit}
        onDirtyChange={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    expect(screen.queryByLabelText('Editar sidecars nesta atualização')).not.toBeInTheDocument();
  });
  it('atualiza apenas saúde mantendo imagem, portas, variáveis e sidecars', () => {
    const current = {
      ...resource,
      state: 'active',
      actions: { upgrade: '/upgrade' },
      launchConfig: {
        ...(resource.launchConfig as object),
        healthCheck: { type: 'instanceHealthCheck', port: 80, strategy: 'none' },
      },
    };
    const result = configurationUpgradePayload(
      current,
      current,
      {
        ...values,
        image: 'app:1',
        editHealthCheck: true,
        healthCheck: { port: 81, strategy: 'none' },
      },
      healthSchemas,
    );
    expect(result).toMatchObject({
      inServiceStrategy: {
        launchConfig: {
          imageUuid: 'docker:app:1',
          ports: ['8080:80'],
          environment: { MODE: 'test' },
          dataVolumes: ['store:/data'],
          healthCheck: { port: 81, strategy: 'none' },
        },
        secondaryLaunchConfigs: [{ name: 'worker', imageUuid: 'docker:worker:1' }],
      },
    });
  });
  it('remove saúde por null e recusa alteração ausente/sem mudança', () => {
    const current = {
      ...resource,
      state: 'active',
      actions: { upgrade: '/upgrade' },
      launchConfig: { ...(resource.launchConfig as object), healthCheck: { port: 80 } },
    };
    const input = { ...values, image: 'app:1', editHealthCheck: true, healthCheck: null };
    expect(configurationUpgradePayload(current, current, input, healthSchemas)).toMatchObject({
      inServiceStrategy: { launchConfig: { healthCheck: null } },
    });
    expect(() =>
      configurationUpgradePayload(
        current,
        current,
        { ...input, healthCheck: undefined },
        healthSchemas,
      ),
    ).toThrow('Revise');
    expect(() =>
      configurationUpgradePayload(
        current,
        current,
        { ...input, healthCheck: { port: 80 } },
        healthSchemas,
      ),
    ).toThrow('Altere');
  });
  it('bloqueia mudança concorrente de saúde ou variáveis e contrato revogado', () => {
    const current: Resource = { ...resource, state: 'active', actions: { upgrade: '/upgrade' } };
    const input = { ...values, image: 'app:1', editHealthCheck: true, healthCheck: { port: 81 } };
    for (const patch of [{ healthCheck: { port: 90 } }, { environment: { OTHER: 'new' } }])
      expect(() =>
        configurationUpgradePayload(
          current,
          { ...current, launchConfig: { ...(current.launchConfig as object), ...patch } },
          input,
          healthSchemas,
        ),
      ).toThrow('outro cliente');
    expect(supportsHealthCheckUpgrade(current, schemas)).toBe(false);
    expect(() => configurationUpgradePayload(current, current, input, schemas)).toThrow(
      'disponível',
    );
  });
  it('não converte silenciosamente requestLine legado desconhecido', () => {
    const current = {
      ...resource,
      launchConfig: {
        ...(resource.launchConfig as object),
        healthCheck: { port: 80, requestLine: 'GET /legacy HTTP/1.0' },
      },
    };
    expect(supportsHealthCheckUpgrade(current, healthSchemas)).toBe(false);
  });
  it('exige revisão ao editar saúde sem trocar imagem e flag off retira editor', async () => {
    const current: Resource = { ...resource, state: 'active', actions: { upgrade: '/upgrade' } };
    const submit = vi.fn(),
      user = userEvent.setup();
    const view = render(
      <>
        <ServiceUpgradeForm
          healthChecksEnabled
          resource={current}
          schemas={healthSchemas}
          onSubmit={submit}
          onDirtyChange={vi.fn()}
          busy={false}
          error={null}
        />
        <button type="submit" form="workspace-resource-form">
          Revisar saúde
        </button>
      </>,
    );
    await user.click(screen.getByLabelText('Editar verificação de saúde nesta atualização'));
    await user.selectOptions(screen.getByLabelText('Tipo de verificação'), 'tcp');
    await user.type(screen.getByLabelText('Porta da verificação'), '8080');
    await user.click(screen.getByRole('button', { name: 'Revisar saúde' }));
    expect(submit).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'app:1',
        editHealthCheck: true,
        healthCheck: { port: '8080', requestLine: '', strategy: 'recreate' },
      }),
    );
    view.unmount();
    render(
      <ServiceUpgradeForm
        resource={current}
        schemas={healthSchemas}
        onSubmit={submit}
        onDirtyChange={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    expect(
      screen.queryByLabelText('Editar verificação de saúde nesta atualização'),
    ).not.toBeInTheDocument();
  });
  it('usa o contrato nativo e preserva portas, variáveis, volumes e sidecars sem campos readonly', () => {
    const original = JSON.stringify(resource);
    expect(imageUpgradePayload(resource, values, schemas)).toEqual({
      inServiceStrategy: {
        batchSize: 2,
        intervalMillis: 2000,
        startFirst: true,
        launchConfig: {
          imageUuid: 'docker:app:2',
          environment: { MODE: 'test' },
          ports: ['8080:80'],
          dataVolumes: ['store:/data'],
        },
        secondaryLaunchConfigs: [{ name: 'worker', imageUuid: 'docker:worker:1' }],
      },
    });
    expect(JSON.stringify(resource)).toBe(original);
  });
  it('preserva uma configuração atualizada por outro cliente quando relida antes do envio', () => {
    const fresh = {
      ...resource,
      launchConfig: { ...(resource.launchConfig as object), ports: ['9090:80'] },
    };
    expect(imageUpgradePayload(fresh, values, schemas)).toMatchObject({
      inServiceStrategy: { launchConfig: { ports: ['9090:80'] } },
    });
  });
  it.each([
    { image: '' },
    { image: 'app bad:2' },
    { image: 'app:1' },
    { batchSize: '' },
    { batchSize: '1.5' },
    { batchSize: '0' },
    { intervalMillis: '99' },
    { intervalMillis: '' },
    { startFirst: 'true' },
  ])('recusa estratégia inválida %j', (change) => {
    expect(() => imageUpgradePayload(resource, { ...values, ...change }, schemas)).toThrow();
  });
  it('não inventa contratos para outro tipo ou sidecars desconhecidos', () => {
    expect(supportsImageUpgrade({ ...resource, type: 'loadBalancerService' }, schemas)).toBe(false);
    expect(() =>
      imageUpgradePayload(resource, values, { ...schemas, secondaryLaunchConfig: undefined! }),
    ).toThrow('sidecars');
  });
  it('edita estratégia no mesmo formulário e envia apenas as opções explícitas', async () => {
    const submit = vi.fn(),
      dirty = vi.fn();
    render(
      <>
        <ServiceUpgradeForm
          resource={resource}
          schemas={schemas}
          onSubmit={submit}
          onDirtyChange={dirty}
          busy={false}
          error={null}
        />
        <button type="submit" form="workspace-resource-form">
          Confirmar
        </button>
      </>,
    );
    await userEvent.clear(screen.getByLabelText('Nova imagem'));
    await userEvent.type(screen.getByLabelText('Nova imagem'), 'app:2');
    await userEvent.click(
      screen.getByLabelText('Iniciar novos containers antes de parar os atuais'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(submit).toHaveBeenCalledExactlyOnceWith({
      image: 'app:2',
      batchSize: '1',
      intervalMillis: '2000',
      startFirst: true,
    });
    expect(dirty).toHaveBeenCalledWith(true);
  });
});

const activeResource: Resource = { ...resource, state: 'active', actions: { upgrade: '/upgrade' } };
const bindingsValues = {
  ...values,
  image: 'app:1',
  editBindings: true,
  ports: ['8081:81/tcp'],
  dataVolumes: ['store:/data:ro'],
};
describe('Upgrade contextual de portas e volumes', () => {
  it('permite manter imagem e altera apenas bindings preservando ambiente e sidecars', () => {
    const payload = configurationUpgradePayload(
      activeResource,
      activeResource,
      bindingsValues,
      schemas,
    );
    expect(payload).toMatchObject({
      inServiceStrategy: {
        launchConfig: {
          imageUuid: 'docker:app:1',
          ports: ['8081:81/tcp'],
          dataVolumes: ['store:/data:ro'],
          environment: { MODE: 'test' },
        },
        secondaryLaunchConfigs: [{ name: 'worker', imageUuid: 'docker:worker:1' }],
      },
    });
    expect(resource.launchConfig).toMatchObject({ ports: ['8080:80'] });
  });
  it('preserva campos frescos fora do snapshot em vez de reenviar versão antiga', () => {
    const fresh = {
      ...activeResource,
      launchConfig: {
        ...(activeResource.launchConfig as object),
        environment: { MODE: 'external' },
      },
    };
    expect(
      configurationUpgradePayload(activeResource, fresh, bindingsValues, schemas),
    ).toMatchObject({ inServiceStrategy: { launchConfig: { environment: { MODE: 'external' } } } });
  });
  it.each([
    { ports: ['9090:80'] },
    { imageUuid: 'docker:external:1' },
    { dataVolumes: ['other:/data'] },
  ])('recusa mudança externa nos campos editados %j', (change) => {
    expect(() =>
      configurationUpgradePayload(
        activeResource,
        {
          ...activeResource,
          launchConfig: { ...(activeResource.launchConfig as object), ...change },
        },
        bindingsValues,
        schemas,
      ),
    ).toThrow('outro cliente');
  });
  it('recusa mudança de titular/stack/estado e contrato revogado', () => {
    for (const change of [
      { accountId: 'other' },
      { stackId: 'other' },
      { state: 'upgrading' },
      { actions: {} },
    ])
      expect(() =>
        configurationUpgradePayload(
          activeResource,
          { ...activeResource, ...change },
          bindingsValues,
          schemas,
        ),
      ).toThrow('disponível');
    expect(
      supportsConfigurationUpgrade(activeResource, {
        ...schemas,
        launchConfig: {
          ...schemas.launchConfig,
          resourceFields: { imageUuid: { type: 'string', create: true } },
        },
      }),
    ).toBe(false);
  });
  it('valida conflito de publicação e alvo de montagem duplicado', () => {
    expect(() =>
      configurationUpgradePayload(
        activeResource,
        activeResource,
        { ...bindingsValues, ports: ['8080:80', '8080:81'] },
        schemas,
      ),
    ).toThrow('conflitantes');
    expect(() =>
      configurationUpgradePayload(
        activeResource,
        activeResource,
        { ...bindingsValues, dataVolumes: ['a:/data', 'b:/data/'] },
        schemas,
      ),
    ).toThrow('destino');
  });
  it('retém binding avançado exato sem aceitar novo formato opaco', () => {
    const advanced = {
      ...activeResource,
      launchConfig: { ...(activeResource.launchConfig as object), ports: ['8000-8010:80-90/tcp'] },
    };
    expect(
      configurationUpgradePayload(
        advanced,
        advanced,
        { ...bindingsValues, ports: ['8000-8010:80-90/tcp'] },
        schemas,
      ),
    ).toMatchObject({ inServiceStrategy: { launchConfig: { ports: ['8000-8010:80-90/tcp'] } } });
    expect(() =>
      configurationUpgradePayload(
        activeResource,
        activeResource,
        { ...bindingsValues, ports: ['8000-8010:80-90/tcp'] },
        schemas,
      ),
    ).toThrow('Revise portas');
  });
  it('recusa upgrade sem alteração de imagem/portas/volumes', () => {
    expect(() =>
      configurationUpgradePayload(
        activeResource,
        activeResource,
        { ...bindingsValues, ports: ['8080:80'], dataVolumes: ['store:/data'] },
        schemas,
      ),
    ).toThrow('Altere');
  });
  it('formulário reutiliza linhas e exige revisão antes de enviar a alteração mantendo imagem', async () => {
    const submit = vi.fn(),
      user = userEvent.setup();
    render(
      <>
        <ServiceUpgradeForm
          bindingsEnabled
          resource={activeResource}
          schemas={schemas}
          onSubmit={submit}
          onDirtyChange={vi.fn()}
          busy={false}
          error={null}
        />
        <button type="submit" form="workspace-resource-form">
          Revisar
        </button>
      </>,
    );
    await user.click(screen.getByLabelText('Editar portas e volumes nesta atualização'));
    await user.clear(screen.getByLabelText('Porta do container 1'));
    await user.type(screen.getByLabelText('Porta do container 1'), '81');
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(submit).not.toHaveBeenCalled();
    await screen.findByRole('dialog', { name: 'Atualizar configuração do serviço?' });
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'app:1',
        editBindings: true,
        ports: ['8080:81/tcp'],
        dataVolumes: ['store:/data'],
      }),
    );
  });
  it('flag desligada mantém formulário somente de imagem', () => {
    render(
      <ServiceUpgradeForm
        resource={activeResource}
        schemas={schemas}
        onSubmit={vi.fn()}
        onDirtyChange={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    expect(
      screen.queryByLabelText('Editar portas e volumes nesta atualização'),
    ).not.toBeInTheDocument();
  });
});
