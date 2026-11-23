import { useEffect, useRef, useState } from 'react';
import { allPages, api, type Resource } from '../api';
import { useApp } from '../state';
import { useSchemas } from '../hooks/useSchemas';
import { Alert, Button, ErrorState, Loading, Modal } from './ui';
import { SecretField } from './SecretField';
import { useI18n } from '../i18n/provider';
class RegistrationError extends Error {
  constructor(
    readonly key:
      'hostRegistration.unavailable' | 'hostRegistration.pending' | 'hostRegistration.failed',
  ) {
    super(key);
  }
}

export function HostRegistration({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
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
          throw new RegistrationError('hostRegistration.unavailable');
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
      throw new RegistrationError('hostRegistration.pending');
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error ? failure : new RegistrationError('hostRegistration.failed'),
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <Modal
      open
      drawer
      title={t('hostRegistration.title')}
      description={t('hostRegistration.environment', { name: app.project?.name || '—' })}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={<Button onClick={onClose}>{t('hostRegistration.close')}</Button>}
    >
      <h2>{t('hostRegistration.register')}</h2>
      <p>{t('hostRegistration.instructions')}</p>
      <Alert tone="warning">{t('hostRegistration.warning')}</Alert>
      {schemas.isPending ? (
        <Loading />
      ) : schemas.error ? (
        <ErrorState error={schemas.error} />
      ) : !allowed ? (
        <Alert>{t('hostRegistration.denied')}</Alert>
      ) : (
        <Button
          variant="primary"
          busy={busy}
          onClick={() => void prepare()}
          style={{ marginTop: 20 }}
        >
          {command ? t('hostRegistration.refresh') : t('hostRegistration.prepare')}
        </Button>
      )}
      {error && (
        <ErrorState error={error instanceof RegistrationError ? new Error(t(error.key)) : error} />
      )}
      {command && (
        <div style={{ marginTop: 20 }}>
          <SecretField label={t('hostRegistration.command')} value={command} multiline />
          <p className="muted">{t('hostRegistration.notice')}</p>
        </div>
      )}
    </Modal>
  );
}
