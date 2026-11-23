import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
} from 'react';

export function CheckboxField({
  label,
  description,
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  label: ReactNode;
  description?: string;
}) {
  const generated = useId();
  const inputId = id || generated;
  const descriptionId = `${inputId}-description`;
  return (
    <label className="checkbox-field checkbox-control" htmlFor={inputId}>
      <input
        {...props}
        id={inputId}
        type="checkbox"
        aria-labelledby={props['aria-labelledby'] || `${inputId}-label`}
        aria-describedby={
          [props['aria-describedby'], description ? descriptionId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
      />
      <span className="checkbox-copy">
        <span id={`${inputId}-label`}>{label}</span>
        {description && <small id={descriptionId}>{description}</small>}
      </span>
    </label>
  );
}

export function Button({
  variant = 'secondary',
  busy,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      className={`button ${variant} ${props.className || ''}`}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </header>
  );
}
export function Alert({
  children,
  tone = 'danger',
}: {
  children: ReactNode;
  tone?: 'danger' | 'info' | 'success' | 'warning';
}) {
  return (
    <div className={`alert ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Loading({ label = 'Carregando dados…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon || <Search size={28} />}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-state">
      <Alert>
        {error instanceof Error ? error.message : 'Não foi possível carregar os dados.'}
      </Alert>
      {retry && <Button onClick={retry}>Tentar novamente</Button>}
    </div>
  );
}
export function Badge({ children, state }: { children: ReactNode; state?: string }) {
  return (
    <span
      className={`badge ${['active', 'running', 'healthy'].includes(state || '') ? 'positive' : ['error', 'removed', 'unhealthy'].includes(state || '') ? 'negative' : ['warning', 'degraded', 'activating', 'restarting', 'updating-active'].includes(state || '') ? 'warning' : ''}`}
    >
      {children}
    </span>
  );
}
export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string, descriptionId: string) => ReactNode;
  id?: string;
}) {
  const generated = useId();
  const inputId = id || generated;
  const descriptionId = `${inputId}-description`;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      {children(inputId, descriptionId)}
      {(hint || error) && (
        <small id={descriptionId} className={error ? 'field-error' : 'muted'}>
          {error || hint}
        </small>
      )}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  drawer = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  drawer?: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          ref={content}
          onOpenAutoFocus={(event) => {
            const previous = document.activeElement;
            if (previous instanceof HTMLElement && !content.current?.contains(previous))
              restoreFocus.current = previous;
            const input = Array.from(
              content.current?.querySelectorAll<HTMLInputElement>(
                'input:not([type=hidden]),textarea,select',
              ) || [],
            ).find((element) => element.getClientRects().length > 0 && !element.disabled);
            if (input) {
              event.preventDefault();
              input.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            if (restoreFocus.current?.isConnected) {
              event.preventDefault();
              restoreFocus.current.focus({ preventScroll: true });
            }
          }}
          className={drawer ? 'dialog drawer' : 'dialog'}
          aria-describedby={description ? undefined : undefined}
        >
          <header className="dialog-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && <Dialog.Description>{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label="Fechar diálogo">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </header>
          <div
            className="dialog-body"
            tabIndex={0}
            onFocusCapture={(event) => {
              if (!(event.target instanceof HTMLElement)) return;
              const body = event.currentTarget,
                rect = event.target.getBoundingClientRect(),
                clip = body.getBoundingClientRect();
              const margin = 12;
              const bottom = Math.min(
                rect.bottom,
                rect.top + Math.max(0, clip.height - 2 * margin),
              );
              const delta =
                rect.top < clip.top + margin
                  ? rect.top - clip.top - margin
                  : bottom > clip.bottom - margin
                    ? bottom - clip.bottom + margin
                    : 0;
              if (delta) body.scrollTop += delta;
            }}
          >
            {children}
          </div>
          {footer && <footer className="dialog-footer">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Tabs({
  labels,
  selected,
  onChange,
  panelId,
  idPrefix,
  label,
}: {
  labels: string[];
  selected: number;
  onChange: (index: number) => void;
  panelId: string;
  idPrefix: string;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="tabs">
      {labels.map((text, index) => (
        <button
          key={index}
          type="button"
          role="tab"
          id={`${idPrefix}-${index}`}
          tabIndex={selected === index ? 0 : -1}
          aria-controls={panelId}
          aria-selected={selected === index}
          onClick={() => onChange(index)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % labels.length;
            else if (event.key === 'ArrowLeft') next = (index + labels.length - 1) % labels.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = labels.length - 1;
            else return;
            event.preventDefault();
            onChange(next);
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>('[role=tab]')
              [next]?.focus();
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  busy = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} busy={busy}>
            Confirmar
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
}
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  label = 'Tabela de dados',
  paginate = true,
  emptyTitle = 'Nenhum resultado',
  emptyDescription = 'Não há registros para os filtros selecionados.',
  selection,
  onSelection,
}: {
  label?: string;
  paginate?: boolean;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  selection?: Set<string>;
  onSelection?: (ids: Set<string>) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState('');
  const [descending, setDescending] = useState(false);
  const column = columns.find((c) => c.key === sort);
  const filtered = rows.filter(
    (row) =>
      !search ||
      !searchText ||
      searchText(row).toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  if (column?.sortValue)
    filtered.sort(
      (a, b) =>
        String(column.sortValue!(a)).localeCompare(String(column.sortValue!(b)), undefined, {
          numeric: true,
        }) * (descending ? -1 : 1),
    );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pageCount - 1);
  const visible = paginate ? filtered.slice(current * 20, current * 20 + 20) : filtered;
  const searchId = useId();
  return (
    <div className="table-panel">
      {searchText && (
        <div className="table-toolbar">
          <label className="search-input" htmlFor={searchId}>
            <Search size={17} />
            <input
              id={searchId}
              placeholder="Buscar nesta lista…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            <span className="sr-only">Buscar registros</span>
          </label>
          <span className="muted">
            {filtered.length} registro{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      )}
      {!filtered.length ? (
        <Empty title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="table-scroll" tabIndex={0} role="region" aria-label={label}>
            <table>
              <thead>
                <tr>
                  {selection && (
                    <th>
                      <span className="sr-only">Selecionar</span>
                    </th>
                  )}
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      aria-sort={
                        sort === c.key ? (descending ? 'descending' : 'ascending') : undefined
                      }
                    >
                      {c.sortValue ? (
                        <button
                          onClick={() => {
                            setSort(c.key);
                            setDescending(sort === c.key ? !descending : false);
                          }}
                        >
                          {c.label}
                          <span aria-hidden="true">
                            {sort === c.key ? (descending ? ' ↓' : ' ↑') : ' ↕'}
                          </span>
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={rowKey(row)}>
                    {selection && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${searchText?.(row) || rowKey(row)}`}
                          checked={selection.has(rowKey(row))}
                          onChange={(e) => {
                            const ids = new Set(selection);
                            if (e.target.checked) ids.add(rowKey(row));
                            else ids.delete(rowKey(row));
                            onSelection?.(ids);
                          }}
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key}>{c.render(row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginate && (
            <footer className="table-footer">
              <span>
                {current * 20 + 1}–{Math.min((current + 1) * 20, filtered.length)} de{' '}
                {filtered.length}
              </span>
              <div>
                <Button
                  aria-label="Página anterior"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span>
                  Página {current + 1} de {pageCount}
                </span>
                <Button
                  aria-label="Próxima página"
                  disabled={current + 1 >= pageCount}
                  onClick={() => setPage(current + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </footer>
          )}
        </>
      )}
    </div>
  );
}
const ToastContext = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  return (
    <ToastContext value={setMessage}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message && (
          <div className="toast">
            <CheckCircle2 size={19} />
            {message}
            <Button
              variant="ghost"
              aria-label="Dispensar notificação"
              onClick={() => setMessage('')}
            >
              <X size={16} />
            </Button>
          </div>
        )}
      </div>
    </ToastContext>
  );
}
export const useToast = () => useContext(ToastContext);
