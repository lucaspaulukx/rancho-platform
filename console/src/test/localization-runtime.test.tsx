import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, useI18n } from '../i18n/provider';
import { normalizeLocalizationPolicy, type LocalizationPolicy } from '../i18n/policy';
import { LanguageSelector } from '../components/LanguageSelector';
import { validateConfig } from '../config';
import config from '../../public/console-config.json';

const preview: LocalizationPolicy = {
  enabled: true,
  defaultLocale: 'pt-BR',
  availableLocales: ['pt-BR', 'en-US'],
  selectable: true,
  detectBrowser: false,
  preview: true,
};
function Probe({ mounted }: { mounted?: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const [draft, setDraft] = useState('');
  useEffect(() => {
    mounted?.();
  }, []);
  return (
    <>
      <LanguageSelector />
      <output data-testid="locale">{locale}</output>
      <span>{t('common.save')}</span>
      <input aria-label="draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button onClick={() => setLocale('en-US')}>English</button>
      <button onClick={() => setLocale('fa-IR')}>Persian</button>
    </>
  );
}
const key = (identity: string) => `rancho.console.locale.${encodeURIComponent(identity)}`;
const save = (identity: string, locale: string) =>
  localStorage.setItem(key(identity), JSON.stringify({ version: 1, locale }));

describe('Optional locale configuration', () => {
  it('upgrades old configuration without activation or mutation and round-trips normalized policy', () => {
    const before = JSON.stringify(config);
    const next = validateConfig(config);
    expect(next.localization).toEqual(normalizeLocalizationPolicy());
    expect(next.localization?.enabled).toBe(false);
    expect(validateConfig(next)).toEqual(next);
    expect(JSON.stringify(config)).toBe(before);
    const value = { ...config, localization: preview };
    expect(validateConfig(value).localization).toEqual(preview);
  });
  it('rejects incomplete production catalogs, invalid lists, wrong types and unknown settings', () => {
    for (const invalid of [
      null,
      [],
      'true',
      { enabled: 'true' },
      { enable: true },
      { defaultLocale: 'en-us' },
      { availableLocales: [] },
      { availableLocales: ['pt-BR', 'pt-BR'] },
      { availableLocales: ['none', 'pt-BR'] },
      { availableLocales: ['en-US'], defaultLocale: 'pt-BR', preview: true },
      { availableLocales: ['pt-BR', 'en-US'] },
      { preview: 'true' },
      { detectBrowser: 1 },
    ])
      expect(() => validateConfig({ ...config, localization: invalid })).toThrow();
    expect(normalizeLocalizationPolicy({ enabled: true })).toEqual({
      ...normalizeLocalizationPolicy(),
      enabled: true,
    });
  });
});

describe('Locale provider lifetime and policy', () => {
  it('keeps the old pt-BR interface and hides selection when absent or disabled', async () => {
    save('anonymous', 'en-US');
    const user = userEvent.setup();
    const { rerender } = render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR');
    expect(screen.getByText('Salvar')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    rerender(
      <I18nProvider policy={{ ...preview, enabled: false }}>
        <Probe />
      </I18nProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR');
  });
  it('switches without remounting descendants, losing drafts or writing private content', async () => {
    const user = userEvent.setup(),
      mounted = vi.fn();
    render(
      <I18nProvider policy={preview} identity="1a99">
        <Probe mounted={mounted} />
      </I18nProvider>,
    );
    const draft = screen.getByLabelText('draft');
    await user.type(draft, 'unsaved private input');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Idioma' }), 'en-US');
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByLabelText('draft')).toBe(draft);
    expect(draft).toHaveValue('unsaved private input');
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(document.documentElement.lang).toBe('en-US');
    expect(localStorage.getItem(key('1a99'))).toBe(JSON.stringify({ version: 1, locale: 'en-US' }));
    expect(screen.getByText('Preview · translations incomplete')).toBeInTheDocument();
    await user.click(screen.getByText('Persian', { exact: true }));
    expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
  });
  it('prefers the account choice and carries only the public choice into a new account', () => {
    save('anonymous', 'en-US');
    save('userB', 'pt-BR');
    const { rerender } = render(
      <I18nProvider policy={preview}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
    rerender(
      <I18nProvider policy={preview} identity="userA">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
    rerender(
      <I18nProvider policy={preview} identity="userB">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR');
    expect(localStorage.getItem(key('userA'))).toBeNull();
    expect(localStorage.getItem(key('userB'))).toBe(
      JSON.stringify({ version: 1, locale: 'pt-BR' }),
    );
  });
  it('negotiates browser language only when allowed and ignores malformed stored values', () => {
    const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE', 'en-GB']);
    localStorage.setItem(key('anonymous'), '{corrupted');
    try {
      const { rerender } = render(
        <I18nProvider policy={preview}>
          <Probe />
        </I18nProvider>,
      );
      expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR');
      rerender(
        <I18nProvider policy={{ ...preview, detectBrowser: true }}>
          <Probe />
        </I18nProvider>,
      );
      expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
      save('anonymous', 'none');
      fireEvent(window, new StorageEvent('storage', { key: key('anonymous') }));
      expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
    } finally {
      languages.mockRestore();
    }
  });
  it('enforces administrator default when selection is locked and handles reversal', async () => {
    const user = userEvent.setup();
    save('anonymous', 'pt-BR');
    const { rerender } = render(
      <I18nProvider policy={{ ...preview, defaultLocale: 'en-US', selectable: false }}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    rerender(
      <I18nProvider policy={preview}>
        <Probe />
      </I18nProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'English' }));
    rerender(
      <I18nProvider policy={{ ...preview, availableLocales: ['pt-BR'] }}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR');
    rerender(
      <I18nProvider policy={{ ...preview, enabled: false }}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR');
  });
  it('keeps selection usable with blocked storage and restores document attributes at unmount', async () => {
    const user = userEvent.setup();
    const oldLang = document.documentElement.getAttribute('lang'),
      oldDir = document.documentElement.getAttribute('dir');
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      const policy = {
        ...preview,
        availableLocales: ['pt-BR', 'fa-IR'] as LocalizationPolicy['availableLocales'],
      };
      const { unmount, rerender } = render(
        <I18nProvider policy={policy}>
          <Probe />
        </I18nProvider>,
      );
      await user.click(screen.getByText('Persian', { exact: true }));
      expect(document.documentElement.lang).toBe('fa-IR');
      expect(document.documentElement.dir).toBe('rtl');
      rerender(
        <I18nProvider policy={{ ...policy }}>
          <Probe />
        </I18nProvider>,
      );
      expect(document.documentElement.lang).toBe('fa-IR');
      rerender(
        <I18nProvider
          policy={{ ...policy, detectBrowser: true, availableLocales: ['pt-BR', 'fa-IR', 'en-US'] }}
        >
          <Probe />
        </I18nProvider>,
      );
      expect(document.documentElement.lang).toBe('fa-IR');
      unmount();
      expect(document.documentElement.getAttribute('lang')).toBe(oldLang);
      expect(document.documentElement.getAttribute('dir')).toBe(oldDir);
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
  it('responds to cross-tab preference removal and does not consume unrelated storage events', () => {
    save('anonymous', 'en-US');
    render(
      <I18nProvider policy={preview}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
    localStorage.removeItem(key('anonymous'));
    fireEvent(window, new StorageEvent('storage', { key: 'unrelated' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
    fireEvent(window, new StorageEvent('storage', { key: null }));
    expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR');
  });
});
