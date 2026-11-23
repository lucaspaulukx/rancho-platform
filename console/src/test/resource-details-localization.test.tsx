import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { ResourceDetails } from '../components/ResourceDetails';
import { ToastProvider } from '../components/ui';
import { I18nProvider, useI18n } from '../i18n/provider';
import type { LocalizationPolicy } from '../i18n/policy';
import { formatResourceDate } from '../resource-format';

const policy: LocalizationPolicy = {
  enabled: true,
  defaultLocale: 'pt-BR',
  availableLocales: ['pt-BR', 'en-US'],
  selectable: true,
  detectBrowser: false,
  preview: true,
};

const resource = {
  id: '1s1',
  type: 'service',
  links: {},
  name: 'Serviço existente',
  created: '2026-10-21T00:00:00Z',
  expiresAt: '2020-10-21T00:00:00Z',
  launchConfig: { imageUuid: 'docker:alpine:3.20', password: 'fixture-redacted' },
};

function Details() {
  const { setLocale } = useI18n();
  return (
    <>
      <button onClick={() => setLocale('en-US')}>English</button>
      <ResourceDetails resource={resource} />
    </>
  );
}

it('changes details labels and regional formats while keeping the open sanitized configuration', async () => {
  const user = userEvent.setup();
  render(
    <I18nProvider policy={policy}>
      <ToastProvider>
        <Details />
      </ToastProvider>
    </I18nProvider>,
  );
  expect(screen.getByText(formatResourceDate(resource.created, 'pt-BR'))).toBeInTheDocument();
  expect(screen.getByText('Expirado')).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Configuração' }));
  const configuration = screen.getByLabelText('Configuração sanitizada');
  expect(configuration).not.toHaveTextContent('fixture-redacted');
  expect(configuration).toHaveTextContent('[protegido]');
  const nativeText = configuration.textContent;
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByRole('tab', { name: 'Configuration', selected: true })).toBeInTheDocument();
  expect(screen.getByLabelText('Sanitized configuration')).toBe(configuration);
  expect(configuration.textContent).toBe(nativeText);
  await user.click(screen.getByRole('tab', { name: 'Summary' }));
  expect(screen.getByText('Serviço existente')).toBeInTheDocument();
  expect(screen.getByText('Expired')).toBeInTheDocument();
  expect(screen.getByText(formatResourceDate(resource.created, 'en-US'))).toBeInTheDocument();
});
