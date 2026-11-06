import { describe, expect, it } from 'vitest';
import { moduleNames, validateConfig } from '../config';
import config from '../../public/console-config.json';

describe('Migração da configuração pública', () => {
  it('migra legado sem regravar nem habilitar módulos ausentes', () => {
    const { schemaVersion: _, ...base } = config;
    const legacy = { ...base, modules: { groups: true, workloads: false } };
    const before = JSON.stringify(legacy);
    const result = validateConfig(legacy);
    expect(result.schemaVersion).toBe(1);
    expect(result.modules.groups).toBe(true);
    expect(result.modules.workloads).toBe(false);
    for (const name of moduleNames.filter((n) => n !== 'groups'))
      expect(result.modules[name]).toBe(false);
    expect(result.customTheme).toEqual(legacy.customTheme);
    expect(result.classicUrl).toBe(legacy.classicUrl);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(validateConfig(result)).toEqual(result);
  });
  it('preserva configuração completa e flags desligadas no upgrade e rollback em memória', () => {
    const { schemaVersion: _, ...legacy } = config;
    const upgraded = validateConfig(legacy);
    expect(upgraded.modules).toEqual({
      serviceMetrics: false,
      workloadUlimitEditors: false,
      workloadUlimitUpgrades: false,
      workloadDeviceEditors: false,
      ...config.modules,
    });
    expect(upgraded.modules.admin).toBe(false);
    expect(validateConfig(config)).toEqual(upgraded);
    expect(validateConfig(legacy)).toEqual(upgraded);
  });
  it.each([0, 2, '1', null, false])('recusa versão não suportada %s', (schemaVersion) => {
    expect(() => validateConfig({ ...config, schemaVersion })).toThrow('Versão');
  });
  it('recusa flag faltante em arquivo versionado e erro de digitação no legado', () => {
    const { groups: _, ...modules } = config.modules;
    expect(() => validateConfig({ ...config, modules })).toThrow('groups');
    const { schemaVersion: __, ...legacy } = config;
    expect(() => validateConfig({ ...legacy, modules: { gruops: true } })).toThrow('desconhecida');
    expect(() => validateConfig({ ...legacy, modules: { groups: undefined } })).toThrow('groups');
    expect(() => validateConfig({ ...legacy, modules: [] })).toThrow('Módulos');
    expect(() => validateConfig([])).toThrow('inválida');
  });
});
