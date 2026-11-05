import { describe, expect, it } from 'vitest';
import type { Resource } from '../api';
import { lifecyclePayload } from '../lifecycle-actions';
import contract from './fixtures/upgrade-schema.json';

describe('Contrato nativo de reinício', () => {
  it.each(['service', 'loadBalancerService'])('inclui estratégia obrigatória para %s', (type) => {
    expect(contract.schemas.serviceRestart.resourceFields.rollingRestartStrategy.required).toBe(
      true,
    );
    expect(lifecyclePayload({ type } as Resource, 'restart')).toEqual({
      rollingRestartStrategy: { batchSize: 1, intervalMillis: 2000 },
    });
  });
  it('não envia estratégia de serviço para containers ou outras ações', () => {
    expect(lifecyclePayload({ type: 'container' } as Resource, 'restart')).toEqual({});
    expect(lifecyclePayload({ type: 'service' } as Resource, 'stop')).toEqual({});
  });
  it('preserva uma estratégia explicitamente informada sem mutar o payload', () => {
    const payload = { rollingRestartStrategy: { batchSize: 2, intervalMillis: 5000 } };
    expect(lifecyclePayload({ type: 'service' } as Resource, 'restart', payload)).toBe(payload);
  });
});
