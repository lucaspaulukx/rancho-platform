import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SecretField } from '../components/SecretField';
import { I18nProvider, useI18n } from '../i18n/provider';

function Panel() {
  const { setLocale } = useI18n();
  return (
    <>
      <button onClick={() => setLocale('en-US')}>English</button>
      <SecretField label="Registration" value="synthetic-registration-command" multiline />
    </>
  );
}

it('preserves masking and translates a failed copy without persisting the command', async () => {
  const user = userEvent.setup();
  const copy = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockRejectedValue(new Error('synthetic-private-detail'));
  render(
    <I18nProvider
      policy={{
        enabled: true,
        defaultLocale: 'pt-BR',
        availableLocales: ['pt-BR', 'en-US'],
        selectable: true,
        detectBrowser: false,
        preview: true,
      }}
    >
      <Panel />
    </I18nProvider>,
  );
  const command = screen.getByLabelText('Registration');
  expect(command).not.toHaveValue('synthetic-registration-command');
  await user.click(screen.getByRole('button', { name: 'Copiar' }));
  await screen.findByText('Não foi possível copiar. Revele o valor e copie manualmente.');
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByLabelText('Registration')).toBe(command);
  expect(command).not.toHaveValue('synthetic-registration-command');
  expect(
    screen.getByText('Unable to copy. Reveal the value and copy it manually.'),
  ).toBeInTheDocument();
  expect(screen.queryByText('synthetic-private-detail')).not.toBeInTheDocument();
  expect(copy).toHaveBeenCalledExactlyOnceWith('synthetic-registration-command');
  await user.click(screen.getByRole('button', { name: 'Reveal' }));
  expect(command).toHaveValue('synthetic-registration-command');
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(
    'synthetic-registration-command',
  );
});
