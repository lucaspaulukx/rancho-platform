import { useState } from 'react';
import type { Resource } from '../api';
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
        title={mode === 'logs' ? 'Logs do recurso' : 'Terminal do recurso'}
        onOpenChange={(value) => {
          if (!value) onClose();
        }}
        footer={<Button onClick={onClose}>Fechar</Button>}
      >
        <Empty
          title="Nenhum container disponível"
          description="O Rancher não disponibilizou esta operação para os containers deste recurso."
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
            {parent.type === 'stack' ? 'Stack' : 'Serviço'}:{' '}
            <strong>{parent.name || parent.id}</strong>
          </p>
          <Field label="Container">
            {(id) => (
              <select
                id={id}
                value={resource.id}
                onChange={(event) => setSelected(event.target.value)}
              >
                {choices.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name || value.id} · {value.state}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <p className="muted">
            Exibindo apenas o container selecionado. A troca encerra a conexão anterior.
          </p>
        </div>
      }
    />
  );
}
