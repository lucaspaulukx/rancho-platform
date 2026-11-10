import { requestErrorText } from '../request-errors';
import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Resource } from '../api';
import { useApp } from '../state';
import {
  BulkOperationError,
  executeBulk,
  resourceKey,
  type BulkAction,
  type BulkResult,
} from '../bulk-actions';
import { useI18n } from '../i18n/provider';
import { Alert, Badge, Button, DataTable, Field, Modal } from './ui';

export interface BulkPlan {
  action: BulkAction;
  resources: Resource[];
}
export function BulkOperation({ plan, onClose }: { plan: BulkPlan; onClose: () => void }) {
  const app = useApp();
  const { t } = useI18n();
  const client = useQueryClient();
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const blocker = useBlocker(running);
  useEffect(() => {
    if (!running && blocker.state === 'blocked') blocker.reset();
  }, [running, blocker]);
  useEffect(
    () => () => {
      alive.current = false;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (running) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [running]);
  async function run() {
    if (started || !app.project || (plan.action === 'remove' && confirmation !== app.project.name))
      return;
    setStarted(true);
    setRunning(true);
    setError(null);
    controller.current = new AbortController();
    try {
      await executeBulk(
        plan.resources,
        plan.action,
        app.project.id,
        (result) => {
          if (alive.current) setResults((current) => [...current, result]);
        },
        undefined,
        controller.current.signal,
      );
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error
            ? failure
            : new BulkOperationError('bulkOperation.message.startFailed'),
        );
    } finally {
      void client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', app.project.id],
      });
      if (alive.current) setRunning(false);
    }
  }
  const rows = plan.resources.map((resource) => ({
    resource,
    result: results.find((value) => value.id === resourceKey(resource)),
  }));
  const count = plan.resources.length;
  return (
    <>
      <Modal
        open
        drawer
        title={t('bulkOperation.title', { action: t(`operations.action.${plan.action}`) })}
        description={t('bulkOperation.description', {
          name: app.project?.name ?? '',
          resources: t('bulkOperation.resources', { count }),
        })}
        onOpenChange={(open) => {
          if (!open && !running) onClose();
        }}
        footer={
          <>
            <Button onClick={onClose} disabled={running}>
              {t(started ? 'bulkOperation.closeResults' : 'common.cancel')}
            </Button>
            {!started && (
              <Button
                variant={
                  ['stop', 'deactivate', 'remove'].includes(plan.action) ? 'danger' : 'primary'
                }
                disabled={plan.action === 'remove' && confirmation !== app.project?.name}
                onClick={() => void run()}
              >
                {t('bulkOperation.confirm', { count })}
              </Button>
            )}
          </>
        }
      >
        <Alert tone="warning">{t('bulkOperation.warning')}</Alert>
        {plan.action === 'restart' &&
          plan.resources.some((resource) =>
            ['service', 'loadBalancerService'].includes(resource.type),
          ) && <Alert>{t('bulkOperation.restartHint')}</Alert>}
        {plan.action === 'remove' && (
          <>
            <Alert tone="warning">{t('bulkOperation.removeWarning')}</Alert>
            {!started && (
              <Field label={t('bulkOperation.confirmEnvironment')} hint={app.project?.name}>
                {(id) => (
                  <input
                    id={id}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                  />
                )}
              </Field>
            )}
          </>
        )}
        {started && (
          <p role="status">
            {t('bulkOperation.progress', {
              status: t(running ? 'bulkOperation.sending' : 'bulkOperation.finished'),
              received: results.length,
              total: count,
            })}
          </p>
        )}
        {error && (
          <Alert>
            {error instanceof BulkOperationError ? t(error.messageKey) : requestErrorText(error, t)}
          </Alert>
        )}
        <DataTable
          rows={rows}
          rowKey={(value) => resourceKey(value.resource)}
          columns={[
            {
              key: 'name',
              label: t('bulkOperation.resource'),
              render: (value) => (
                <>
                  <strong>{value.resource.name || value.resource.id}</strong>
                  <small className="health-label">
                    {value.resource.type} · {value.resource.id}
                  </small>
                </>
              ),
            },
            {
              key: 'result',
              label: t('bulkOperation.result'),
              render: (value) =>
                value.result ? (
                  <>
                    <Badge
                      state={
                        value.result.status === 'accepted'
                          ? 'active'
                          : value.result.status === 'failed'
                            ? 'error'
                            : 'degraded'
                      }
                    >
                      {t(`bulkOperation.status.${value.result.status}`)}
                    </Badge>
                    <small className="health-label">
                      {value.result.messageKey ? t(value.result.messageKey) : value.result.message}
                    </small>
                  </>
                ) : (
                  <span className="muted">
                    {t(started ? 'bulkOperation.queued' : 'bulkOperation.pending')}
                  </span>
                ),
            },
          ]}
        />
      </Modal>
      <Modal
        open={blocker.state === 'blocked'}
        children={null}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('bulkOperation.runningTitle')}
        description={t('bulkOperation.runningDescription')}
        footer={
          <Button
            onClick={() => {
              if (blocker.state === 'blocked') blocker.reset();
            }}
          >
            {t('bulkOperation.stay')}
          </Button>
        }
      />
    </>
  );
}
