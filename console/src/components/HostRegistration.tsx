import { useEffect, useRef, useState } from 'react';
import { allPages, api, type Resource } from '../api';
import { useApp } from '../state';
import { useSchemas } from '../hooks/useSchemas';
import { Alert, Button, ErrorState, Loading, Modal } from './ui';
import { SecretField } from './SecretField';

export function HostRegistration({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const schemas = useSchemas(true);
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const schema = schemas.data?.registrationToken;
  const allowed = schema?.collectionMethods?.includes('POST');
  async function prepare() {
    if (!allowed || !schema?.links.collection) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    setCommand('');
    try {
      const tokens = await allPages<Resource>(schema.links.collection, controller.signal);
      let token = tokens.find((value) => value.state === 'active' && !value.removed);
      if (!token)
        token = await api<Resource>(schema.links.collection, {}, 'POST', controller.signal);
      for (let attempt = 0; attempt < 20; attempt++) {
        if (token.state === 'active' && typeof token.command === 'string' && token.command.trim()) {
          if (!controller.signal.aborted) setCommand(token.command);
          return;
        }
        if (['inactive', 'removed', 'error'].includes(token.state || ''))
          throw new Error('O registro não ficou disponível. Tente novamente.');
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          };
          const timer = setTimeout(() => {
            controller.signal.removeEventListener('abort', abort);
            resolve();
          }, 500);
          controller.signal.addEventListener('abort', abort, { once: true });
          if (controller.signal.aborted) abort();
        });
        token = await api<Resource>(token.links.self, undefined, undefined, controller.signal);
      }
      throw new Error('O registro ainda está sendo preparado. Aguarde e tente novamente.');
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error ? failure : new Error('Não foi possível preparar o registro.'),
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <Modal
      open
      drawer
      title="Adicionar host"
      description={`Environment: ${app.project?.name || '—'}`}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      <h2>Registrar um host Docker</h2>
      <p>
        Execute o comando no host que deseja adicionar. Ele deve conseguir acessar o endereço do
        servidor Rancher e usar uma versão de Docker compatível com o Rancher 1.6.
      </p>
      <Alert tone="warning">
        O comando autoriza um agente neste environment e executa um container privilegiado no host
        escolhido. Compartilhe-o somente com quem administra esse host.
      </Alert>
      {schemas.isPending ? (
        <Loading />
      ) : schemas.error ? (
        <ErrorState error={schemas.error} />
      ) : !allowed ? (
        <Alert>Seu perfil não permite registrar hosts neste environment.</Alert>
      ) : (
        <Button
          variant="primary"
          busy={busy}
          onClick={() => void prepare()}
          style={{ marginTop: 20 }}
        >
          {command ? 'Atualizar comando' : 'Preparar comando de registro'}
        </Button>
      )}
      {error && <ErrorState error={error} />}
      {command && (
        <div style={{ marginTop: 20 }}>
          <SecretField label="Comando de registro" value={command} multiline />
          <p className="muted">
            O comando é exibido apenas neste painel. O novo host aparecerá na listagem após o agente
            conectar.
          </p>
        </div>
      )}
    </Modal>
  );
}
