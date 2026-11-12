import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/provider';
import {
  decodeBinding,
  encodeBinding,
  type BindingDraft,
  type BindingKind,
} from '../workload-bindings';
import { Alert, Button, Field } from './ui';
export function WorkloadBindingsEditor({
  kind,
  value,
  onChange,
}: {
  kind: BindingKind;
  value: unknown;
  onChange: (value: string[]) => void;
}) {
  const { t } = useI18n();
  const valid =
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.every((v) => typeof v === 'string'));
  const [rows, setRows] = useState<BindingDraft[]>(() =>
    Array.isArray(value) ? value.map((v, i) => decodeBinding(kind, String(v), i)) : [],
  );
  const [nextId, setNextId] = useState(rows.length);
  function change(next: BindingDraft[]) {
    setRows(next);
    onChange(next.map(encodeBinding));
  }
  function update(key: number, patch: Record<string, string>) {
    change(
      rows.map((v) =>
        v.key === key && v.kind !== 'native'
          ? ({ ...v, ...patch, changed: true } as BindingDraft)
          : v,
      ),
    );
  }
  const title =
    kind === 'ports' ? t('bindingsEditor.portsTitle') : t('bindingsEditor.volumesTitle');
  return (
    <fieldset className="nested-fields">
      <legend>{title}</legend>
      {!valid ? (
        <Alert>{t('bindingsEditor.unsupported')}</Alert>
      ) : (
        <>
          <p className="muted">
            {kind === 'ports' ? t('bindingsEditor.portsHint') : t('bindingsEditor.volumesHint')}
          </p>
          {rows.map((row, index) => (
            <section className="compose-editor" key={row.key}>
              <div className="compose-editor-heading">
                <strong>
                  {kind === 'ports'
                    ? t('bindingsEditor.portRow', { index: index + 1 })
                    : t('bindingsEditor.volumeRow', { index: index + 1 })}
                </strong>
                <Button
                  type="button"
                  aria-label={
                    kind === 'ports'
                      ? t('bindingsEditor.removePort', { index: index + 1 })
                      : t('bindingsEditor.removeVolume', { index: index + 1 })
                  }
                  onClick={() => change(rows.filter((v) => v.key !== row.key))}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              {row.kind === 'native' ? (
                <>
                  <Alert tone="info">{t('bindingsEditor.native')}</Alert>
                  <code className="binding-native" dir="ltr">
                    {row.original}
                  </code>
                </>
              ) : row.kind === 'ports' ? (
                <>
                  <div className="form-grid">
                    <Field label={t('bindingsEditor.containerPort', { index: index + 1 })}>
                      {(id) => (
                        <input
                          id={id}
                          required
                          dir="ltr"
                          inputMode="numeric"
                          value={row.container}
                          onChange={(e) => update(row.key, { container: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field
                      label={t('bindingsEditor.hostPort', { index: index + 1 })}
                      hint={t('bindingsEditor.hostPortHint')}
                    >
                      {(id) => (
                        <input
                          id={id}
                          dir="ltr"
                          inputMode="numeric"
                          value={row.host}
                          onChange={(e) => update(row.key, { host: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={t('bindingsEditor.protocol', { index: index + 1 })}>
                      {(id) => (
                        <select
                          id={id}
                          value={row.protocol}
                          onChange={(e) => update(row.key, { protocol: e.target.value })}
                        >
                          <option value="tcp">TCP</option>
                          <option value="udp">UDP</option>
                        </select>
                      )}
                    </Field>
                    <Field
                      label={t('bindingsEditor.ip', { index: index + 1 })}
                      hint={t('bindingsEditor.ipHint')}
                    >
                      {(id) => (
                        <input
                          id={id}
                          value={row.ip}
                          dir="ltr"
                          autoComplete="off"
                          onChange={(e) => update(row.key, { ip: e.target.value })}
                        />
                      )}
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <Field
                    label={t('bindingsEditor.source', { index: index + 1 })}
                    hint={t('bindingsEditor.sourceHint')}
                  >
                    {(id) => (
                      <input
                        id={id}
                        value={row.source}
                        dir="ltr"
                        autoComplete="off"
                        onChange={(e) => update(row.key, { source: e.target.value })}
                      />
                    )}
                  </Field>
                  <div className="form-grid">
                    <Field
                      label={t('bindingsEditor.target', { index: index + 1 })}
                      hint={t('bindingsEditor.targetHint')}
                    >
                      {(id) => (
                        <input
                          id={id}
                          required
                          value={row.target}
                          dir="ltr"
                          autoComplete="off"
                          onChange={(e) => update(row.key, { target: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={t('bindingsEditor.access', { index: index + 1 })}>
                      {(id) => (
                        <select
                          id={id}
                          value={row.mode}
                          onChange={(e) => update(row.key, { mode: e.target.value })}
                        >
                          <option value="rw">{t('bindingsEditor.readWrite')}</option>
                          <option value="ro">{t('bindingsEditor.readOnly')}</option>
                        </select>
                      )}
                    </Field>
                  </div>
                </>
              )}
            </section>
          ))}
          <Button
            type="button"
            disabled={rows.length >= 100}
            onClick={() => {
              change([
                ...rows,
                kind === 'ports'
                  ? {
                      kind,
                      key: nextId,
                      container: '',
                      host: '',
                      ip: '',
                      protocol: 'tcp',
                      changed: true,
                    }
                  : { kind, key: nextId, source: '', target: '', mode: 'rw', changed: true },
              ]);
              setNextId(nextId + 1);
            }}
          >
            <Plus size={16} />
            {kind === 'ports' ? t('bindingsEditor.addPort') : t('bindingsEditor.addVolume')}
          </Button>
        </>
      )}
    </fieldset>
  );
}
