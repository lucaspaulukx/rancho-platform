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
  const app = useApp();
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(mode === 'logs');
  const [error, setError] = useState('');
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
      setError('O recurso não pertence ao environment selecionado.');
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
            setError('Foi recebida uma mensagem de conexão inválida.');
            socket?.close();
          }
        };
        socket.onerror = () => {
          if (!disposed) setError('A conexão falhou. Feche este painel e tente novamente.');
        };
        socket.onclose = (event) => {
          if (heartbeat) clearInterval(heartbeat);
          observer?.disconnect();
          socketRef.current = null;
          if (!disposed) {
            setConnected(false);
            setClosed(true);
            if (event?.code === 1008)
              setError(
                'A conexão foi encerrada porque sua sessão ou permissão não está mais disponível.',
              );
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
                setError('O recurso não está mais disponível ou seu acesso expirou.');
                socket?.close();
              }
            });
        }, 15_000);
      } catch {
        if (!disposed)
          setError(
            'Não foi possível iniciar a conexão. Verifique o estado do recurso e suas permissões.',
          );
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
      title={`${mode === 'logs' ? 'Logs' : 'Console'} · ${resource.name || resource.id}`}
      description={`Environment: ${app.project?.name || '—'} · ${connected ? 'Conectado' : closed ? 'Conexão encerrada' : started ? 'Conectando…' : 'Aguardando conexão'}`}
      footer={
        <Button onClick={onClose}>
          <X size={16} />
          Fechar conexão
        </Button>
      }
    >
      {context}
      {error && <Alert>{error}</Alert>}
      {mode === 'execute' ? (
        <>
          {!started && (
            <div style={{ marginBottom: 20 }}>
              <Alert tone="warning">
                A console executa comandos dentro do container selecionado com as permissões
                concedidas pelo Rancher.
              </Alert>
              <Button variant="primary" onClick={() => setStarted(true)} style={{ marginTop: 15 }}>
                <Play size={16} />
                Conectar ao container
              </Button>
            </div>
          )}
          <div ref={terminalHost} className="terminal-host" aria-label="Terminal do container" />
        </>
      ) : (
        <>
          <div className="stream-toolbar">
            <input
              aria-label="Filtrar logs"
              placeholder="Filtrar linhas recebidas…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button onClick={() => setPaused(!paused)}>
              {paused ? <Play size={16} /> : <Pause size={16} />}
              {paused ? 'Retomar rolagem' : 'Pausar rolagem'}
            </Button>
            <Button onClick={download} disabled={!lines.length}>
              <Download size={16} />
              Baixar
            </Button>
          </div>
          <p className="muted" style={{ fontSize: 11 }}>
            Buffer limitado às últimas 2.000 linhas e 512 KB. A busca e o download usam somente o
            conteúdo recebido neste painel.
          </p>
          <div
            ref={body}
            className="log-viewer"
            role="log"
            aria-live={paused ? 'off' : 'polite'}
            aria-label="Logs do container"
          >
            {lines
              .filter(
                (line) =>
                  !search || line.text.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
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
