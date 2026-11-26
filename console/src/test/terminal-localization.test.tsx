import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Resource } from '../api';
import { ResourceStream } from '../components/ResourceStream';
import { I18nProvider, useI18n } from '../i18n/provider';

const terminalModule = vi.hoisted(() => {
  let finishLoading = () => {};
  const loading = new Promise<void>((resolve) => {
    finishLoading = resolve;
  });
  return {
    loading,
    finishLoading,
    started: false,
    strings: { promptLabel: 'Terminal input', tooMuchOutput: 'Too much output' },
  };
});

vi.mock('@xterm/xterm', async () => {
  terminalModule.started = true;
  await terminalModule.loading;
  class Terminal {
    static strings = terminalModule.strings;
    textarea = document.createElement('textarea');
    loadAddon() {}
    onData() {}
    focus() {
      this.textarea.focus();
    }
    open(host: HTMLElement) {
      this.textarea.setAttribute('aria-label', Terminal.strings.promptLabel);
      host.append(this.textarea);
    }
    dispose() {
      this.textarea.remove();
    }
  }
  return { Terminal };
});

vi.mock('@xterm/addon-fit', () => ({ FitAddon: class {} }));

vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'fixture',
    project: { id: '1a12', name: 'Fixture' },
    config: { classicUrl: 'http://localhost:18080', modules: { observability: true } },
  }),
}));

class Socket {
  static instances: Socket[] = [];
  onopen?: () => void;
  send = vi.fn();
  close = vi.fn();
  constructor() {
    Socket.instances.push(this);
  }
}

const resource: Resource = {
  id: '1i1',
  type: 'container',
  name: 'fixture',
  state: 'running',
  accountId: '1a12',
  links: { self: '/v2-beta/projects/1a12/containers/1i1' },
  actions: { execute: '/v2-beta/projects/1a12/containers/1i1?action=execute' },
};

function Viewer() {
  const { setLocale } = useI18n();
  return (
    <ResourceStream
      resource={resource}
      mode="execute"
      onClose={vi.fn()}
      context={
        <>
          <button onClick={() => setLocale('pt-BR')}>Portuguese</button>
          <button onClick={() => setLocale('fa-IR')}>Persian</button>
        </>
      }
    />
  );
}

afterEach(() => vi.unstubAllGlobals());

it('uses the latest locale after lazy loading and updates the active terminal in place', async () => {
  vi.stubGlobal('WebSocket', Socket);
  const fetcher = vi.fn(async (input: string) =>
    Response.json(
      input === resource.links.self
        ? resource
        : { url: new URL('/v1/connect', window.location.origin).href, token: 'fixture' },
    ),
  );
  vi.stubGlobal('fetch', fetcher);

  render(
    <I18nProvider
      policy={{
        enabled: true,
        defaultLocale: 'en-US',
        availableLocales: ['en-US', 'pt-BR', 'fa-IR'],
        selectable: true,
        detectBrowser: false,
        preview: true,
      }}
    >
      <Viewer />
    </I18nProvider>,
  );

  try {
    fireEvent.click(screen.getByRole('button', { name: 'Connect to container' }));
    await waitFor(() => expect(terminalModule.started).toBe(true));
    expect(Socket.instances).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Portuguese' }));
    await screen.findByLabelText('Terminal do container');
  } finally {
    terminalModule.finishLoading();
  }

  const input = await screen.findByRole('textbox', { name: 'Entrada do terminal' });
  expect(terminalModule.strings.tooMuchOutput).toBe(
    'Há muitas linhas para anunciar. Navegue pelas linhas do terminal para lê-las.',
  );
  const [socket] = Socket.instances;
  expect(socket).toBeDefined();
  act(() => socket.onopen?.());
  expect(input).toHaveFocus();
  fetcher.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Persian' }));
  expect(await screen.findByRole('textbox', { name: 'ورودی ترمینال' })).toBe(input);
  expect(input).toHaveFocus();
  expect(terminalModule.strings.tooMuchOutput).toBe(
    'خروجی برای خواندن خودکار بیش از حد طولانی است. برای خواندن آن بین سطرهای ترمینال جابه‌جا شوید.',
  );
  expect(Socket.instances).toEqual([socket]);
  expect(socket.close).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
