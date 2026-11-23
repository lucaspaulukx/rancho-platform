import { useI18n } from '../i18n/provider';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Field } from './ui';

export function ComposeEditor({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(!value);
  return (
    <section className="compose-editor">
      <div className="compose-editor-heading">
        <strong>{label}</strong>
        <Button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={t(visible ? 'composeEditor.hideLabel' : 'composeEditor.showLabel', { label })}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          {visible ? t('composeEditor.hide') : t('composeEditor.show')}
        </Button>
      </div>
      {visible ? (
        <Field label={label} hint={t('composeEditor.hint')}>
          {(id, descriptionId) => (
            <textarea
              dir="ltr"
              id={id}
              aria-describedby={descriptionId}
              className="compose-source"
              rows={12}
              spellCheck={false}
              autoComplete="off"
              required={required}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </Field>
      ) : (
        <p className="muted">{t('composeEditor.hidden')}</p>
      )}
      <small className="muted">
        {t('composeEditor.size', {
          lines: String(value ? value.split('\n').length : 0),
          bytes: new TextEncoder().encode(value).byteLength,
        })}
      </small>
    </section>
  );
}
