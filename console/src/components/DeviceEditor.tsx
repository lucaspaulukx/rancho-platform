import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/provider';
import {
  deviceFields,
  devicePermissions,
  DeviceValidationError,
  maxDeviceMappings,
  normalizeDevices,
} from '../workload-devices';
import { Alert, Button, CheckboxField, Field } from './ui';

export function DeviceEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<
    Record<
      number,
      {
        raw: string;
        fields: NonNullable<ReturnType<typeof deviceFields>>;
      }
    >
  >({});
  const rows = value == null ? [] : value;
  const editable =
    Array.isArray(rows) &&
    rows.length <= maxDeviceMappings &&
    rows.every((row) => typeof row === 'string');
  let error: DeviceValidationError | undefined;
  if (value != null) {
    try {
      normalizeDevices(value);
    } catch (caught) {
      if (caught instanceof DeviceValidationError) error = caught;
    }
  }
  return (
    <section aria-label={t('devices.title')}>
      <p className="muted">{t('devices.description')}</p>
      <p className="muted">{t('devices.effectivePermissions')}</p>
      {error && <Alert>{t(error.key)}</Alert>}
      {!editable ? (
        <Alert>{t('devices.incompatible')}</Alert>
      ) : (
        <>
          {rows.map((raw: string, position: number) => {
            const fields =
              drafts[position]?.raw === raw ? drafts[position].fields : deviceFields(raw);
            const index = position + 1;
            const update = (next: string) =>
              onChange(rows.map((row, at) => (at === position ? next : row)));
            const updateFields = (nextFields: NonNullable<ReturnType<typeof deviceFields>>) => {
              const next = `${nextFields.host}:${nextFields.container}:${nextFields.permissions}`;
              // Retain invalid path text as an editable draft; a typed colon must not freeze the row as legacy data.
              setDrafts((current) => ({
                ...current,
                [position]: { raw: next, fields: nextFields },
              }));
              update(next);
            };
            return (
              <fieldset className="nested-fields" key={position}>
                <legend>{t('devices.row', { index })}</legend>
                {!fields ? (
                  <>
                    <Alert tone="warning">{t('devices.legacy')}</Alert>
                    <Field label={t('devices.rawValue', { index })}>
                      {(id) => <textarea id={id} value={raw} readOnly rows={2} dir="ltr" />}
                    </Field>
                  </>
                ) : (
                  <>
                    {(['host', 'container'] as const).map((key) => (
                      <Field
                        key={key}
                        label={t(key === 'host' ? 'devices.host' : 'devices.container', { index })}
                        hint={t('devices.pathHint')}
                      >
                        {(id, description) => (
                          <input
                            id={id}
                            aria-describedby={description}
                            required
                            dir="ltr"
                            value={fields[key]}
                            onChange={(event) =>
                              updateFields({ ...fields, [key]: event.target.value })
                            }
                          />
                        )}
                      </Field>
                    ))}
                    {devicePermissions.map((permission) => (
                      <CheckboxField
                        key={permission}
                        label={t(
                          permission === 'r'
                            ? 'devices.read'
                            : permission === 'w'
                              ? 'devices.write'
                              : 'devices.mknod',
                          { index },
                        )}
                        checked={fields.permissions.includes(permission)}
                        onChange={(event) => {
                          const permissions = devicePermissions
                            .filter((candidate) =>
                              candidate === permission
                                ? event.target.checked
                                : fields.permissions.includes(candidate),
                            )
                            .join('');
                          updateFields({ ...fields, permissions });
                        }}
                      />
                    ))}
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t('devices.remove', { index })}
                  onClick={() => {
                    setDrafts((current) =>
                      Object.fromEntries(
                        Object.entries(current)
                          .filter(([at]) => Number(at) !== position)
                          .map(([at, draft]) => [
                            Number(at) > position ? Number(at) - 1 : Number(at),
                            draft,
                          ]),
                      ),
                    );
                    onChange(rows.filter((_, at) => at !== position));
                  }}
                >
                  <Trash2 size={15} />
                  {t('devices.remove', { index })}
                </Button>
              </fieldset>
            );
          })}
          <Button
            type="button"
            disabled={rows.length >= maxDeviceMappings}
            onClick={() => onChange([...rows, '::rwm'])}
          >
            <Plus size={15} />
            {t('devices.add')}
          </Button>
        </>
      )}
    </section>
  );
}
