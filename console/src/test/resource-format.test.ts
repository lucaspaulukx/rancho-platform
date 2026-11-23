import { describe, expect, it } from 'vitest';
import { certificateValidity, formatResourceDate, resourceDate } from '../resource-format';
describe('Datas nativas e validade de certificados', () => {
  it('interpreta a data UTC do Cattle sem depender do parser do navegador', () => {
    expect(resourceDate('Wed Oct 28 11:34:51 UTC 2026')).toBe(Date.UTC(2026, 9, 28, 11, 34, 51));
    expect(resourceDate('2026-10-28T11:34:51Z')).toBe(Date.UTC(2026, 9, 28, 11, 34, 51));
  });
  it('distingue expirado, vencimento próximo e válido', () => {
    const now = Date.UTC(2026, 9, 21);
    expect(certificateValidity('2026-10-21T00:00:00Z', now).label).toBe('Expirado');
    expect(certificateValidity('2026-10-22T00:00:00Z', now).label).toBe('Expira em 1 dia');
    expect(certificateValidity('2026-12-21T00:00:00Z', now).label).toBe('Válido');
  });
  it('não anuncia certificado válido quando a data é ausente ou inválida', () => {
    expect(certificateValidity(undefined).state).toBe('unknown');
    expect(certificateValidity('invalid').state).toBe('unknown');
    expect(formatResourceDate('invalid')).toBe('—');
  });
});
