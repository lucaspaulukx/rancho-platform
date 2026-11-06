import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { Alert, Button, Field } from './ui';
import { useI18n } from '../i18n/provider';

export function SecretField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setError(true);
    }
  }
  return (
    <div className="secret-field">
      <Field label={label}>
        {(id) =>
          multiline ? (
            <textarea
              id={id}
              readOnly
              rows={4}
              className={visible ? 'code-input' : 'secret-input'}
              value={visible ? value : '••••••••••••••••••••••••'}
              spellCheck={false}
            />
          ) : (
            <input
              id={id}
              type={visible ? 'text' : 'password'}
              readOnly
              value={value}
              autoComplete="off"
            />
          )
        }
      </Field>
      <div className="row-actions">
        <Button type="button" variant="ghost" onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          {visible ? t('secretField.hide') : t('secretField.reveal')}
        </Button>
        <Button type="button" onClick={() => void copy()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? t('secretField.copied') : t('secretField.copy')}
        </Button>
      </div>
      {error && <Alert>{t('secretField.copyFailed')}</Alert>}
    </div>
  );
}
