import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Pause, Play, X } from 'lucide-react';
import { api, type Resource } from '../api';
import { useApp } from '../state';
import {
  boundedLogs,
  decodeLogFrame,
  decodeTerminal,
  encodeTerminal,
  websocketAddress,
  streamResourceAllowed,
  type LogLine,
} from '../streams';
import { Alert, Button, Modal } from './ui';
import { useI18n } from '../i18n/provider';
type StreamErrorKey =
  | 'resourceStream.scope'
  | 'resourceStream.invalidFrame'
  | 'resourceStream.failed'
  | 'resourceStream.revoked'
  | 'resourceStream.unavailable'
  | 'resourceStream.startFailed';

interface Connection {
  url: string;
  token: string;
}
type Mode = 'logs' | 'execute';
interface StreamProps {
  resource: Resource;
  mode: Mode;
  onClose: () => void;
  context?: ReactNode;
}
export function ResourceStream(props: StreamProps) {
  const app = useApp();
  return (
    <StreamSession
      key={`${app.identity}:${app.project?.id}:${props.resource.id}:${props.mode}`}
      {...props}
    />
  );
}
function StreamSession({ resource, mode, onClose, context }: StreamProps) {
  const { t, locale } = useI18n();
  const app = useApp();
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(mode === 'logs');
  const [error, setError] = useState<StreamErrorKey | null>(null);
  const [closed, setClosed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<LogLine[]>([]);
  const body = useRef<HTMLDivElement>(null);
  const terminalHost = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const environment = app.project?.id;

  useEffect(() => {
    if (!started || !app.config.modules.observability) return;
    if (!environment || resource.accountId !== environment) {
      setError('resourceStream.scope');
      setClosed(true);
      return;
    }
    let disposed = false;
    let socket: WebSocket | undefined;
    let terminal: import('@xterm/xterm').Terminal | undefined;
    let observer: ResizeObserver | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const controller = new AbortController();
    const decoder = new TextDecoder();
    async function connect() {
      try {
        const current = await api<Resource>(
          resource.links.self,
          undefined,
          undefined,
          AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        );
        const action = streamResourceAllowed(current, resource, mode, environment)
          ? current.actions?.[mode]
          : undefined;
        if (!action) throw new Error('Esta operação não está disponível para este recurso.');
        const payload =
          mode === 'logs'
            ? { follow: true, lines: 500, timestamps: true }
            : { attachStdin: true, attachStdout: true, tty: true, command: ['/bin/sh'] };
        const connection = await api<Connection>(
          action,
          payload,
          'POST',
          AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        );
        if (disposed) return;
        if (mode === 'execute') {
          const [{ Terminal }, { FitAddon }] = await Promise.all([
            import('@xterm/xterm'),
            import('@xterm/addon-fit'),
          ]);
          if (disposed || !terminalHost.current) return;
          terminal = new Terminal({
            cursorBlink: false,
            scrollback: 1000,
            fontSize: 13,
            screenReaderMode: true,
            theme: { background: '#0c141d', foreground: '#f8fafc' },
          });
          const fit = new FitAddon();
          terminal.loadAddon(fit);
          terminal.open(terminalHost.current);
          observer = new ResizeObserver(() => {
            fit.fit();
            if (socket?.readyState === WebSocket.OPEN)
              socket.send(`:resizeTTY:${terminal!.cols},${terminal!.rows}`);
          });
          observer.observe(terminalHost.current);
          terminal.onData((text) => {
            if (socket?.readyState === WebSocket.OPEN) socket.send(encodeTerminal(text));
          });
        }
        socket = new WebSocket(
          websocketAddress(connection.url, connection.token, app.config.classicUrl),
        );
        socketRef.current = socket;
        socket.onopen = () => {
          if (disposed) {
            socket?.close();
            return;
          }
          setConnected(true);
          terminal?.focus();
          if (terminal) socket!.send(`:resizeTTY:${terminal.cols},${terminal.rows}`);
        };
        socket.onmessage = (event) => {
          if (disposed || typeof event.data !== 'string') return;
          try {
            if (mode === 'logs')
              setLines((current) => boundedLogs(current, decodeLogFrame(event.data)));
            else terminal?.write(decodeTerminal(event.data, decoder));
          } catch {
            setError('resourceStream.invalidFrame');
            socket?.close();
          }
        };
        socket.onerror = () => {
          if (!disposed) setError('resourceStream.failed');
        };
        socket.onclose = (event) => {
          if (heartbeat) clearInterval(heartbeat);
          observer?.disconnect();
          socketRef.current = null;
          if (!disposed) {
            setConnected(false);
            setClosed(true);
            if (event?.code === 1008) setError('resourceStream.revoked');
          }
        };
        heartbeat = setInterval(() => {
          void api<Resource>(
            resource.links.self,
            undefined,
            undefined,
            AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
          )
            .then((current) => {
              if (!streamResourceAllowed(current, resource, mode, environment))
                throw new Error('Permission changed');
            })
            .catch(() => {
              if (!disposed) {
                setError('resourceStream.unavailable');
                socket?.close();
              }
            });
        }, 15_000);
      } catch {
        if (!disposed) setError('resourceStream.startFailed');
      }
    }
    void connect();
    return () => {
      disposed = true;
      controller.abort();
      if (heartbeat) clearInterval(heartbeat);
      observer?.disconnect();
      socket?.close();
      terminal?.dispose();
      socketRef.current = null;
    };
  }, [started, resource.id, mode, environment, app.identity, app.config.modules.observability]);

  useEffect(() => {
    if (!paused && body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [lines, paused]);
  function download() {
    const url = URL.createObjectURL(
      new Blob([lines.map((line) => line.text).join('\n')], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.id}-logs.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      drawer
      title={`${t(mode === 'logs' ? 'resourceStream.logs' : 'resourceStream.console')} · ${resource.name || resource.id}`}
      description={t('resourceStream.description', {
        name: app.project?.name || '—',
        status: t(
          connected
            ? 'resourceStream.connected'
            : closed
              ? 'resourceStream.closed'
              : started
                ? 'resourceStream.connecting'
                : 'resourceStream.waiting',
        ),
      })}
      footer={
        <Button onClick={onClose}>
          <X size={16} />
          {t('resourceStream.close')}
        </Button>
      }
    >
      {context}
      {error && <Alert>{t(error)}</Alert>}
      {mode === 'execute' ? (
        <>
          {!started && (
            <div style={{ marginBottom: 20 }}>
              <Alert tone="warning">{t('resourceStream.warning')}</Alert>
              <Button variant="primary" onClick={() => setStarted(true)} style={{ marginTop: 15 }}>
                <Play size={16} />
                {t('resourceStream.connect')}
              </Button>
            </div>
          )}
          <div
            ref={terminalHost}
            className="terminal-host"
            dir="ltr"
            aria-label={t('resourceStream.terminal')}
          />
        </>
      ) : (
        <>
          <div className="stream-toolbar">
            <input
              aria-label={t('resourceStream.filter')}
              placeholder={t('resourceStream.filterPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button onClick={() => setPaused(!paused)}>
              {paused ? <Play size={16} /> : <Pause size={16} />}
              {t(paused ? 'resourceStream.resume' : 'resourceStream.pause')}
            </Button>
            <Button onClick={download} disabled={!lines.length}>
              <Download size={16} />
              {t('resourceStream.download')}
            </Button>
          </div>
          <p className="muted" style={{ fontSize: 11 }}>
            {t('resourceStream.buffer')}
          </p>
          <div
            ref={body}
            className="log-viewer"
            dir="ltr"
            role="log"
            aria-live={paused ? 'off' : 'polite'}
            aria-label={t('resourceStream.logLabel')}
          >
            {lines
              .filter(
                (line) =>
                  !search ||
                  line.text.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)),
              )
              .map((line, index) => (
                <div className={line.channel === 'stderr' ? 'stderr' : ''} key={index}>
                  {line.text}
                </div>
              ))}
          </div>
        </>
      )}
    </Modal>
  );
}
