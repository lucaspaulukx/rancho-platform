import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Resource } from '../api';
import { useApp } from '../state';
import { executeBulk, resourceKey, type BulkAction, type BulkResult } from '../bulk-actions';
import { fieldLabel } from './SchemaForm';
import { Alert, Badge, Button, DataTable, Field, Modal } from './ui';

export interface BulkPlan {
  action: BulkAction;
  resources: Resource[];
}
export function BulkOperation({ plan, onClose }: { plan: BulkPlan; onClose: () => void }) {
  const app = useApp();
  const client = useQueryClient();
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [error, setError] = useState('');
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
    setError('');
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
        setError(failure instanceof Error ? failure.message : 'Não foi possível iniciar o lote.');
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
  return (
    <>
      <Modal
        open
        drawer
        title={`${fieldLabel(plan.action)} em lote`}
        description={`Environment: ${app.project?.name} · ${plan.resources.length} ${plan.resources.length === 1 ? 'recurso' : 'recursos'}`}
        onOpenChange={(open) => {
          if (!open && !running) onClose();
        }}
        footer={
          <>
            <Button onClick={onClose} disabled={running}>
              {started ? 'Fechar resultados' : 'Cancelar'}
            </Button>
            {!started && (
              <Button
                variant={
                  ['stop', 'deactivate', 'remove'].includes(plan.action) ? 'danger' : 'primary'
                }
                disabled={plan.action === 'remove' && confirmation !== app.project?.name}
                onClick={() => void run()}
              >
                Confirmar {plan.resources.length}{' '}
                {plan.resources.length === 1 ? 'operação' : 'operações'}
              </Button>
            )}
          </>
        }
      >
        <Alert tone="warning">
          A operação será aplicada a cada recurso listado. Uma falha não desfaz as operações já
          recebidas pelo Rancher. Confira os alvos antes de confirmar.
        </Alert>
        {plan.action === 'restart' &&
          plan.resources.some((resource) =>
            ['service', 'loadBalancerService'].includes(resource.type),
          ) && (
            <Alert>
              O reinício dos serviços usa lotes de 1 container e intervalo de 2 segundos entre
              lotes. O envio é acompanhado por recurso; confirme o estado final na operação.
            </Alert>
          )}
        {plan.action === 'remove' && (
          <>
            <Alert tone="warning">
              A remoção pode encerrar containers e remover recursos dependentes pelo lifecycle do
              Rancher. Não há desfazer automático.
            </Alert>
            {!started && (
              <Field label="Confirme o nome do environment" hint={app.project?.name}>
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
            {running ? 'Enviando operações' : 'Envio encerrado'} · {results.length} de{' '}
            {plan.resources.length} respostas. O estado final continua sendo acompanhado na tela de
            operação.
          </p>
        )}
        {error && <Alert>{error}</Alert>}
        <DataTable
          rows={rows}
          rowKey={(value) => resourceKey(value.resource)}
          columns={[
            {
              key: 'name',
              label: 'Recurso',
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
              label: 'Resultado',
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
                      {value.result.status === 'accepted'
                        ? 'Recebida'
                        : value.result.status === 'failed'
                          ? 'Falhou'
                          : 'Verificar estado'}
                    </Badge>
                    <small className="health-label">{value.result.message}</small>
                  </>
                ) : (
                  <span className="muted">{started ? 'Aguardando envio' : 'A confirmar'}</span>
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
        title="Operação em andamento"
        description="Aguarde o envio do lote antes de trocar de tela ou environment."
        footer={
          <Button
            onClick={() => {
              if (blocker.state === 'blocked') blocker.reset();
            }}
          >
            Permanecer nesta tela
          </Button>
        }
      />
    </>
  );
}
