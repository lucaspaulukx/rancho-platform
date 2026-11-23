import { useState } from 'react';
import type { Resource } from '../api';
import { useI18n } from '../i18n/provider';
import { resourceStateLabel } from '../i18n/resource-state';
import { useApp } from '../state';
import { ResourceStream } from './ResourceStream';
import { Button, Empty, Field, Modal } from './ui';

export function WorkloadStreams({
  parent,
  containers,
  mode,
  onClose,
}: {
  parent: Resource;
  containers: Resource[];
  mode: 'logs' | 'execute';
  onClose: () => void;
}) {
  const app = useApp();
  const { t } = useI18n();
  const choices = containers
    .filter(
      (value) => value.accountId === app.project?.id && !value.removed && value.actions?.[mode],
    )
    .sort(
      (a, b) =>
        Number(b.state === 'running') - Number(a.state === 'running') ||
        String(a.name || a.id).localeCompare(String(b.name || b.id), 'pt-BR'),
    );
  const [selected, setSelected] = useState(choices[0]?.id || '');
  if (!app.config.modules.observability) return null;
  const resource = choices.find((value) => value.id === selected) || choices[0];
  if (!resource)
    return (
      <Modal
        open
        drawer
        title={t(mode === 'logs' ? 'workloadStreams.logs' : 'workloadStreams.terminal')}
        onOpenChange={(value) => {
          if (!value) onClose();
        }}
        footer={<Button onClick={onClose}>{t('common.close')}</Button>}
      >
        <Empty
          title={t('workloadStreams.emptyTitle')}
          description={t('workloadStreams.emptyDescription')}
        />
      </Modal>
    );
  return (
    <ResourceStream
      key={`${app.identity}:${app.project?.id}:${resource.id}:${mode}`}
      resource={resource}
      mode={mode}
      onClose={onClose}
      context={
        <div className="workload-stream-context">
          <p className="muted">
            {t(parent.type === 'stack' ? 'workloadStreams.stack' : 'workloadStreams.service')}{' '}
            <strong>{parent.name || parent.id}</strong>
          </p>
          <Field label={t('workloadStreams.container')}>
            {(id) => (
              <select
                id={id}
                value={resource.id}
                onChange={(event) => setSelected(event.target.value)}
              >
                {choices.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name || value.id} · {resourceStateLabel(t, value.state)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <p className="muted">{t('workloadStreams.selectionHint')}</p>
        </div>
      }
    />
  );
}
