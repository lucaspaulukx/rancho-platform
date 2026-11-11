import { Languages } from 'lucide-react';
import { useId } from 'react';
import { useI18n } from '../i18n/provider';
import { localeInventory, type Locale } from '../i18n/locales';

export function LanguageSelector() {
  const id = useId();
  const { policy, locale, setLocale, preview, catalogFailed, t } = useI18n();
  if (!policy.enabled) return null;
  const selectable = policy.selectable && policy.availableLocales.length > 1;
  if (!selectable && !preview) return null;
  return (
    <div className="language-selector">
      {selectable && (
        <>
          <label htmlFor={id}>
            <Languages size={16} aria-hidden="true" />
            {t('language.label')}
          </label>
          <select
            id={id}
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            aria-describedby={preview ? `${id}-preview` : undefined}
          >
            {localeInventory
              .filter((entry) => policy.availableLocales.includes(entry.code))
              .map((entry) => (
                <option key={entry.code} value={entry.code} lang={entry.code}>
                  {entry.name}
                </option>
              ))}
          </select>
        </>
      )}
      {preview && (
        <span id={`${id}-preview`} className="muted">
          {t('language.preview')}
        </span>
      )}
      <span className="muted language-status" role="status">
        {catalogFailed ? t('localeLoad.failed') : null}
      </span>
    </div>
  );
}
