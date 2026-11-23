import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { Alert, Button, Field } from './ui';

export function SecretField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setError('Não foi possível copiar. Revele o valor e copie manualmente.');
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
          {visible ? 'Ocultar' : 'Revelar'}
        </Button>
        <Button type="button" onClick={() => void copy()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
