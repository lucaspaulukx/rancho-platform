import { useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/provider';
import {
  decodeScheduling,
  encodeScheduling,
  globalLabel,
  schedulingKinds,
  schedulingModes,
  type SchedulingRule,
} from '../workload-scheduling';
import { Alert, Button, Field } from './ui';

const kindLabels = {
  host_label: 'schedulingEditor.kind.host_label',
  container_label: 'schedulingEditor.kind.container_label',
  container: 'schedulingEditor.kind.container',
} as const;
const modeLabels = {
  '': 'schedulingEditor.mode.required',
  _ne: 'schedulingEditor.mode.exclude',
  _soft: 'schedulingEditor.mode.prefer',
  _soft_ne: 'schedulingEditor.mode.avoid',
} as const;

export function SchedulingEditor({
  value,
  onChange,
  renderLabels,
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  renderLabels: (
    value: Record<string, string>,
    onChange: (value: Record<string, string>) => void,
  ) => ReactNode;
}) {
  const { t } = useI18n();
  const [initial] = useState(() => {
    try {
      return { ...decodeScheduling(value), error: false };
    } catch {
      return {
        rules: [] as SchedulingRule[],
        other: value,
        error: true,
      };
    }
  });
  const [rules, setRules] = useState(initial.rules),
    [other, setOther] = useState(initial.other);
  function update(next: SchedulingRule[], labels = other) {
    setRules(next);
    setOther(labels);
    onChange(encodeScheduling(next, labels, false));
  }
  const global = other[globalLabel] === 'true';
  return (
    <section aria-label={t('schedulingEditor.title')}>
      <p className="muted">{t('schedulingEditor.description')}</p>
      {global && <Alert tone="info">{t('schedulingEditor.global')}</Alert>}
      {initial.error ? (
        <>
          <Alert>{t('schedulingEditor.legacy')}</Alert>
          {renderLabels(other, (labels) => update([], labels))}
        </>
      ) : (
        <>
          {rules.map((rule, index) => {
            function patch(patch: Partial<SchedulingRule>) {
              update(rules.map((v) => (v.id === rule.id ? { ...v, ...patch } : v)));
            }
            return (
              <fieldset className="nested-fields" key={rule.id}>
                <legend>{t('schedulingEditor.rule', { index: index + 1 })}</legend>
                <Field label={t('schedulingEditor.target')}>
                  {(id) => (
                    <select
                      id={id}
                      value={rule.kind}
                      onChange={(e) => patch({ kind: e.target.value as SchedulingRule['kind'] })}
                    >
                      {Object.keys(schedulingKinds).map((key) => (
                        <option key={key} value={key} disabled={global && key !== 'host_label'}>
                          {t(kindLabels[key as SchedulingRule['kind']])}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={t('schedulingEditor.condition')}>
                  {(id) => (
                    <select
                      id={id}
                      value={rule.mode}
                      onChange={(e) => patch({ mode: e.target.value as SchedulingRule['mode'] })}
                    >
                      {Object.keys(schedulingModes).map((key) => (
                        <option key={key} value={key} disabled={global && key.includes('_soft')}>
                          {t(modeLabels[key as SchedulingRule['mode']])}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                {rule.kind !== 'container' && (
                  <Field
                    label={t('schedulingEditor.key')}
                    hint={
                      rule.kind === 'container_label'
                        ? t('schedulingEditor.serviceHint')
                        : undefined
                    }
                  >
                    {(id) => (
                      <input
                        id={id}
                        value={rule.key}
                        onChange={(e) => patch({ key: e.target.value })}
                        autoComplete="off"
                      />
                    )}
                  </Field>
                )}
                <Field
                  label={
                    rule.kind === 'container'
                      ? t('schedulingEditor.container')
                      : t('schedulingEditor.value')
                  }
                >
                  {(id) => (
                    <input
                      id={id}
                      value={rule.value}
                      onChange={(e) => patch({ value: e.target.value })}
                      autoComplete="off"
                    />
                  )}
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t('schedulingEditor.remove', { index: index + 1 })}
                  onClick={() => update(rules.filter((v) => v.id !== rule.id))}
                >
                  <Trash2 size={15} /> {t('schedulingEditor.removeRule')}
                </Button>
              </fieldset>
            );
          })}
          <Button
            type="button"
            disabled={rules.length >= 100}
            onClick={() =>
              update([
                ...rules,
                { id: crypto.randomUUID(), kind: 'host_label', mode: '', key: '', value: '' },
              ])
            }
          >
            <Plus size={15} /> {t('schedulingEditor.add')}
          </Button>
          <details className="advanced-fields">
            <summary>{t('schedulingEditor.native')}</summary>
            <div>{renderLabels(other, (labels) => update(rules, labels))}</div>
          </details>
        </>
      )}
    </section>
  );
}
