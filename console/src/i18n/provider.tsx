import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createTranslator } from './messages';
import { isPreviewLocale, previewLoaders } from './preview-loaders';
import {
  defaultLocale,
  localeDirection,
  localeFormats,
  negotiateLocale,
  type Locale,
} from './locales';
import { normalizeLocalizationPolicy, type LocalizationPolicy } from './policy';

const prefix = 'rancho.console.locale.';
const preferenceKey = (identity: string) => prefix + encodeURIComponent(identity);
function storedLocale(key: string): unknown {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value?.version === 1 ? value.locale : undefined;
  } catch {
    return undefined;
  }
}

export function preferredLocale(policy: LocalizationPolicy, identity: string): Locale {
  if (!policy.enabled) return defaultLocale;
  if (!policy.selectable) return policy.defaultLocale;
  const browser =
    policy.detectBrowser && typeof navigator !== 'undefined' ? navigator.languages : [];
  const choices = [
    storedLocale(preferenceKey(identity)),
    ...(identity !== 'anonymous' ? [storedLocale(preferenceKey('anonymous'))] : []),
    ...browser,
  ];
  return negotiateLocale(choices, policy.availableLocales, policy.defaultLocale);
}

const defaultPolicy = normalizeLocalizationPolicy();
const builtIn = {
  'pt-BR': createTranslator('pt-BR'),
  'en-US': createTranslator('en-US'),
};
const defaultState = {
  ...builtIn[defaultLocale],
  policy: defaultPolicy,
  preview: false,
  catalogFailed: false,
  direction: localeDirection(defaultLocale),
  formats: localeFormats(defaultLocale),
  setLocale: (_locale: Locale) => {},
};
const I18nContext = createContext(defaultState);
export function I18nProvider({
  policy: input,
  identity = 'anonymous',
  children,
}: {
  policy?: LocalizationPolicy;
  identity?: string;
  children: ReactNode;
}) {
  const policy = useMemo(() => normalizeLocalizationPolicy(input), [input]);
  const key = preferenceKey(identity);
  const [choice, setChoice] = useState(() => ({
    key,
    locale: preferredLocale(policy, identity),
    explicit: false,
    policy,
  }));
  const initial = useMemo(() => preferredLocale(policy, identity), [policy, identity]);
  const requestedLocale = !policy.enabled
    ? defaultLocale
    : !policy.selectable
      ? policy.defaultLocale
      : choice.key === key &&
          (choice.explicit || choice.policy === policy) &&
          policy.availableLocales.includes(choice.locale)
        ? choice.locale
        : initial;
  useEffect(() => {
    setChoice((previous) =>
      previous.explicit &&
      previous.key === key &&
      policy.enabled &&
      policy.selectable &&
      policy.availableLocales.includes(previous.locale)
        ? previous
        : { key, locale: initial, explicit: false, policy },
    );
  }, [key, initial, policy]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (
        event.key === key ||
        event.key === null ||
        (identity !== 'anonymous' && event.key === preferenceKey('anonymous'))
      )
        setChoice({ key, locale: preferredLocale(policy, identity), explicit: false, policy });
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [key, identity, policy]);
  const [applied, setApplied] = useState(() => builtIn[defaultLocale]);
  const [attempt, retryCatalog] = useState(0);
  const [failedCatalog, setFailedCatalog] = useState<Locale | null>(null);
  useEffect(() => {
    setFailedCatalog(null);
    if (!isPreviewLocale(requestedLocale)) {
      setApplied(builtIn[requestedLocale]);
      return;
    }
    let current = true;
    void previewLoaders[requestedLocale]()
      .then((messages) => createTranslator(requestedLocale, messages))
      .then(
        (translator) => {
          if (current) setApplied(translator);
        },
        () => {
          if (current) setFailedCatalog(requestedLocale);
        },
      );
    return () => {
      current = false;
    };
  }, [requestedLocale, attempt]);
  const translator = !isPreviewLocale(requestedLocale)
    ? builtIn[requestedLocale]
    : policy.availableLocales.includes(applied.locale)
      ? applied
      : builtIn[defaultLocale];
  const { locale } = translator;
  const direction = localeDirection(locale);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const old = { lang: root.getAttribute('lang'), dir: root.getAttribute('dir') };
    root.lang = locale;
    root.dir = direction;
    return () => {
      for (const [name, value] of Object.entries(old))
        if (value === null) root.removeAttribute(name);
        else root.setAttribute(name, value);
    };
  }, [locale, direction]);
  const value = useMemo(
    () => ({
      ...translator,
      policy,
      preview: policy.enabled && policy.preview,
      catalogFailed: failedCatalog === requestedLocale && locale !== requestedLocale,
      direction,
      formats: localeFormats(locale),
      setLocale(next: Locale) {
        if (!policy.enabled || !policy.selectable || !policy.availableLocales.includes(next))
          return;
        if (next === requestedLocale && locale !== next) retryCatalog((previous) => previous + 1);
        setChoice({ key, locale: next, explicit: true, policy });
        try {
          localStorage.setItem(key, JSON.stringify({ version: 1, locale: next }));
        } catch {
          /* Preference remains usable when storage is unavailable. */
        }
      },
    }),
    [translator, locale, policy, direction, key, requestedLocale, failedCatalog],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}
export const useI18n = () => useContext(I18nContext);
