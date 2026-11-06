import { localeDirection, localeFormats, type Locale } from './locales';
import { enAuth, ptAuth } from './domains/auth';
import { enUi, ptUi } from './domains/ui';
import { enShell, ptShell } from './domains/shell';
import { enRecovery, ptRecovery } from './domains/recovery';
import { enDevices, ptDevices } from './domains/devices';
import { enDeviceUpgrade, ptDeviceUpgrade } from './domains/device-upgrade';
import { enDeviceUpgradeForm, ptDeviceUpgradeForm } from './domains/device-upgrade-form';
import { enResourceDetails, ptResourceDetails } from './domains/resource-details';
import { enWorkloadStreams, ptWorkloadStreams } from './domains/workload-streams';
import { enOperations, ptOperations } from './domains/operations';
import { enResourceCreator, ptResourceCreator } from './domains/resource-creator';
import { enBulkOperation, ptBulkOperation } from './domains/bulk-operation';
import { enTopology, ptTopology } from './domains/topology';
import { enSchemaForm, ptSchemaForm } from './domains/schema-form';
import { enWorkloadControls, ptWorkloadControls } from './domains/workload-controls';
import { enHealthCheckEditor, ptHealthCheckEditor } from './domains/health-check-editor';
import { enResourceLimits, ptResourceLimits } from './domains/resource-limits';
import { enResourceValidation, ptResourceValidation } from './domains/resource-validation';
import { enSchedulingEditor, ptSchedulingEditor } from './domains/scheduling-editor';
import { enBindingsEditor, ptBindingsEditor } from './domains/bindings-editor';
import { enUsers, ptUsers } from './domains/users';
import { enGroups, ptGroups } from './domains/groups';
import { enApiKeys, ptApiKeys } from './domains/api-keys';
import { enLocalAccountPanel, ptLocalAccountPanel } from './domains/local-account-panel';
import { enAccessDiagnostics, ptAccessDiagnostics } from './domains/access-diagnostics';
import { enSettings, ptSettings } from './domains/settings';
import { enAuditPage, ptAuditPage } from './domains/audit-page';
import { enProcesses, ptProcesses } from './domains/processes';
import { enEngineMonitoring, ptEngineMonitoring } from './domains/engine-monitoring';
import { enMachineDrivers, ptMachineDrivers } from './domains/machine-drivers';
import { enCatalogRepositories, ptCatalogRepositories } from './domains/catalog-repositories';

// Initial shared domain only. These catalogs do not represent full interface coverage.
export const englishMessages = {
  ...enAuth,
  ...enUi,
  ...enShell,
  ...enRecovery,
  ...enDevices,
  ...enDeviceUpgrade,
  ...enDeviceUpgradeForm,
  ...enResourceDetails,
  ...enWorkloadStreams,
  ...enOperations,
  ...enResourceCreator,
  ...enBulkOperation,
  ...enTopology,
  ...enSchemaForm,
  ...enWorkloadControls,
  ...enHealthCheckEditor,
  ...enResourceLimits,
  ...enResourceValidation,
  ...enSchedulingEditor,
  ...enBindingsEditor,
  ...enUsers,
  ...enGroups,
  ...enApiKeys,
  ...enLocalAccountPanel,
  ...enAccessDiagnostics,
  ...enSettings,
  ...enAuditPage,
  ...enProcesses,
  ...enEngineMonitoring,
  ...enMachineDrivers,
  ...enCatalogRepositories,
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.retry': 'Try again',
  'common.loading': 'Loading…',
  'language.label': 'Language',
  'language.preview': 'Preview · translations incomplete',
  'runtime.disabledTitle': 'Console disabled',
  'runtime.disabledDescription': 'This console is disabled in the instance configuration.',
  'runtime.classic': 'Open classic Rancher',
  'environment.selected': 'Environment: {name}',
  'selection.count': { one: '{count} selected item', other: '{count} selected items' },
} as const;
export type MessageKey = keyof typeof englishMessages;
type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer Rest}`
  ? P | Placeholders<Rest>
  : never;
type MessageTemplate<M> = M extends string
  ? M
  : M extends { other: infer S extends string }
    ? S
    : never;
type Template<K extends MessageKey> = MessageTemplate<(typeof englishMessages)[K]>;
type ParametersFor<K extends MessageKey> = {
  [P in Placeholders<Template<K>>]: P extends 'count' ? number : string | number;
};
type Arguments<K extends MessageKey> = keyof ParametersFor<K> extends never
  ? []
  : [params: ParametersFor<K>];
type PluralMessage = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;
export type MessageCatalog = Partial<{
  [K in MessageKey]: (typeof englishMessages)[K] extends string ? string : PluralMessage;
}>;
export const portugueseMessages = {
  ...ptAuth,
  ...ptUi,
  ...ptShell,
  ...ptRecovery,
  ...ptDevices,
  ...ptDeviceUpgrade,
  ...ptDeviceUpgradeForm,
  ...ptResourceDetails,
  ...ptWorkloadStreams,
  ...ptOperations,
  ...ptResourceCreator,
  ...ptBulkOperation,
  ...ptTopology,
  ...ptSchemaForm,
  ...ptWorkloadControls,
  ...ptHealthCheckEditor,
  ...ptResourceLimits,
  ...ptResourceValidation,
  ...ptSchedulingEditor,
  ...ptBindingsEditor,
  ...ptUsers,
  ...ptGroups,
  ...ptApiKeys,
  ...ptLocalAccountPanel,
  ...ptAccessDiagnostics,
  ...ptSettings,
  ...ptAuditPage,
  ...ptProcesses,
  ...ptEngineMonitoring,
  ...ptMachineDrivers,
  ...ptCatalogRepositories,
  'common.cancel': 'Cancelar',
  'common.close': 'Fechar',
  'common.save': 'Salvar',
  'common.retry': 'Tentar novamente',
  'common.loading': 'Carregando…',
  'language.label': 'Idioma',
  'language.preview': 'Prévia · traduções incompletas',
  'runtime.disabledTitle': 'Console desativada',
  'runtime.disabledDescription': 'Esta console está desativada na configuração da instância.',
  'runtime.classic': 'Abrir Rancher clássico',
  'environment.selected': 'Environment: {name}',
  'selection.count': { one: '{count} item selecionado', other: '{count} itens selecionados' },
} satisfies MessageCatalog;

function record(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [null, Object.prototype].includes(Object.getPrototypeOf(value))
  );
}
function placeholders(template: string) {
  if (/[{}]/.test(template.replace(/\{[a-zA-Z][a-zA-Z0-9]*\}/g, '')))
    throw new Error('Invalid message placeholder syntax.');
  return [
    ...new Set([...template.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map((match) => match[1])),
  ].sort();
}

/** Validate and copy loaded data; never evaluate messages or accept executable translations. */
export function validateCatalog(value: unknown): MessageCatalog {
  if (!record(value)) throw new Error('Invalid message catalog.');
  const catalog: Record<string, string | PluralMessage> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!Object.hasOwn(englishMessages, key)) throw new Error('Unknown message key.');
    const original = englishMessages[key as MessageKey];
    const expected = placeholders(typeof original === 'string' ? original : original.other);
    const check = (text: unknown): string => {
      if (
        typeof text !== 'string' ||
        !text.trim() ||
        text.length > 8192 ||
        JSON.stringify(placeholders(text)) !== JSON.stringify(expected)
      )
        throw new Error('Invalid message or mismatched placeholders.');
      return text;
    };
    if (typeof original === 'string') catalog[key] = check(entry);
    else {
      if (
        !record(entry) ||
        !Object.hasOwn(entry, 'other') ||
        Object.keys(entry).some(
          (category) => !['zero', 'one', 'two', 'few', 'many', 'other'].includes(category),
        )
      )
        throw new Error('Invalid plural message.');
      catalog[key] = Object.fromEntries(
        Object.entries(entry).map(([category, text]) => [category, check(text)]),
      ) as PluralMessage;
    }
  }
  return catalog as MessageCatalog;
}

export function createTranslator(locale: Locale, translation?: unknown) {
  localeDirection(locale);
  const catalog = validateCatalog(
    translation ??
      (locale === 'pt-BR' ? portugueseMessages : locale === 'en-US' ? englishMessages : {}),
  );
  function source(key: MessageKey): { message: string | PluralMessage; locale: Locale } {
    if (!Object.hasOwn(englishMessages, key)) throw new Error('Unknown message key.');
    const translated = Object.hasOwn(catalog, key);
    return {
      message: translated ? catalog[key]! : englishMessages[key],
      locale: translated ? locale : ('en-US' as Locale),
    };
  }
  return {
    locale,
    // Coverage is for this initial shared domain, not for the whole application.
    translatedKeys: Object.keys(catalog) as MessageKey[],
    resolvedLocale: (key: MessageKey) => source(key).locale,
    t<K extends MessageKey>(key: K, ...args: Arguments<K>): string {
      const selected = source(key);
      const params: unknown = args[0] ?? {};
      const original = englishMessages[key];
      const expected = placeholders(typeof original === 'string' ? original : original.other);
      if (
        !record(params) ||
        JSON.stringify(Object.keys(params).sort()) !== JSON.stringify(expected) ||
        Object.entries(params).some(
          ([name, value]) =>
            (typeof value !== 'string' && typeof value !== 'number') ||
            (typeof value === 'number' && !Number.isFinite(value)) ||
            (name === 'count' && typeof value !== 'number'),
        )
      )
        throw new Error('Invalid message parameters.');
      const formats = localeFormats(selected.locale);
      const message = selected.message;
      const template =
        typeof message === 'string'
          ? message
          : (message[formats.plural(params.count as number)] ?? message.other);
      return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, name: string) => {
        const value = params[name];
        return typeof value === 'number' ? formats.number(value) : String(value);
      });
    },
  };
}
