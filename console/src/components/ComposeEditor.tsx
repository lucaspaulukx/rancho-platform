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
  const [visible, setVisible] = useState(!value);
  return (
    <section className="compose-editor">
      <div className="compose-editor-heading">
        <strong>{label}</strong>
        <Button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label}`}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          {visible ? 'Ocultar' : 'Mostrar'}
        </Button>
      </div>
      {visible ? (
        <Field label={label} hint="Conteúdo enviado ao Rancher sem conversão. Até 512 KiB UTF-8.">
          {(id, descriptionId) => (
            <textarea
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
        <p className="muted">Conteúdo oculto. Use Mostrar para editar.</p>
      )}
      <small className="muted">
        {value ? value.split('\n').length : 0} linhas ·{' '}
        {new TextEncoder().encode(value).byteLength.toLocaleString('pt-BR')} bytes
      </small>
    </section>
  );
}
