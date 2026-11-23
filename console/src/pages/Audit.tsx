import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Resource } from '../api';
import { auditMetadata, auditNext, auditQuery, type AuditEvent, type AuditFilters } from '../audit';
import { useApp } from '../state';
import {
  Alert,
  Button,
  DataTable,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
} from '../components/ui';
import { formatResourceDate } from '../resource-format';
const initial: AuditFilters = { event: '', resource: '', account: '' };
export function Audit() {
  const app = useApp();
  return <AuditScope key={app.identity} />;
}
function AuditScope() {
  const app = useApp();
  const [draft, setDraft] = useState(initial),
    [filters, setFilters] = useState(initial);
  const [history, setHistory] = useState<string[]>([]),
    [selected, setSelected] = useState<AuditEvent | null>(null),
    [validation, setValidation] = useState('');
  const path = history.at(-1) || auditQuery(filters);
  const query = useQuery({
    queryKey: ['data', app.identity, 'administrative-audit', path],
    enabled: app.admin && app.config.modules.audit,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const result = await api<{ data: Resource[]; pagination?: { next?: string } }>(
        path,
        undefined,
        undefined,
        signal,
      );
      if (!Array.isArray(result.data)) throw new Error('Resposta de auditoria inválida.');
      return { rows: result.data.map(auditMetadata), next: auditNext(result.pagination?.next) };
    },
  });
  function apply(e: React.FormEvent) {
    e.preventDefault();
    try {
      auditQuery(draft);
      setFilters({ ...draft });
      setHistory([]);
      setSelected(null);
      setValidation('');
    } catch (e) {
      setValidation(e instanceof Error ? e.message : 'Revise os filtros.');
    }
  }
  if (!app.admin || !app.config.modules.audit)
    return <Alert>Auditoria indisponível neste acesso.</Alert>;
  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Eventos registrados pelo Rancher, com metadados de autoria, recurso e resultado."
        action={
          <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
            Atualizar
          </Button>
        }
      />
      <form className="panel" onSubmit={apply}>
        <div className="form-grid">
          <Field label="Tipo de recurso">
            {(id) => (
              <input
                id={id}
                value={draft.resource}
                onChange={(e) => setDraft({ ...draft, resource: e.target.value })}
                placeholder="Ex.: service"
              />
            )}
          </Field>
          <Field label="Tipo de evento">
            {(id) => (
              <input
                id={id}
                value={draft.event}
                onChange={(e) => setDraft({ ...draft, event: e.target.value })}
                placeholder="Identificador nativo"
              />
            )}
          </Field>
          <Field label="Filtrar por conta autenticada">
            {(id) => (
              <input
                id={id}
                value={draft.account}
                onChange={(e) => setDraft({ ...draft, account: e.target.value })}

                placeholder="Ex.: 1a1"
              />
            )}
          </Field>
        </div>
        <div className="row-actions audit-filter-actions">
          <Button type="submit">Aplicar filtros</Button>
          <Button
            onClick={() => {
              setDraft(initial);
              setFilters(initial);
              setHistory([]);
              setValidation('');
            }}
          >
            Limpar filtros
          </Button>
        </div>
        {validation && <Alert>{validation}</Alert>}
      </form>
      <Alert tone="info">
        Até 100 eventos por página. A busca abaixo consulta somente esta página. Corpos de
        requisição/resposta e descrições livres são omitidos para proteger dados sensíveis.
      </Alert>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <DataTable
            paginate={false}
            rows={query.data?.rows || []}
            rowKey={(v) => v.id}
            searchText={(v) =>
              `${v.id} ${v.eventType} ${v.resourceType} ${v.resourceId} ${v.accountId} ${v.authenticatedAsAccountId} ${v.responseCode ?? ''}`
            }
            columns={[
              { key: 'created', label: 'Data', render: (v) => formatResourceDate(v.created) },
              { key: 'event', label: 'Evento', render: (v) => v.eventType || '—' },
              {
                key: 'resource',
                label: 'Recurso',
                render: (v) => `${v.resourceType || '—'} ${v.resourceId}`,
              },
              {
                key: 'actor',
                label: 'Conta autenticada',
                render: (v) => v.authenticatedAsAccountId || '—',
              },
              { key: 'status', label: 'HTTP', render: (v) => v.responseCode ?? '—' },
              {
                key: 'detail',
                label: 'Detalhes',
                render: (v) => (
                  <Button onClick={() => setSelected(v)} aria-label={`Detalhes do evento ${v.id}`}>
                    Ver detalhes
                  </Button>
                ),
              },
            ]}
          />
          <div className="row-actions audit-pagination" aria-label="Paginação da auditoria">
            <Button
              disabled={!history.length || query.isFetching}
              onClick={() => setHistory((v) => v.slice(0, -1))}
            >
              Eventos anteriores
            </Button>
            <span aria-live="polite">Página {history.length + 1}</span>
            <Button
              disabled={!query.data?.next || query.isFetching}
              onClick={() => {
                if (query.data?.next) setHistory((v) => [...v, query.data!.next!]);
              }}
            >
              Mais eventos
            </Button>
          </div>
        </>
      )}
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Detalhes do evento"
      >
        <dl className="details-grid">
          {selected &&
            Object.entries({
              ID: selected.id,
              Data: formatResourceDate(selected.created),
              Evento: selected.eventType,
              'Tipo de recurso': selected.resourceType,
              'ID do recurso': selected.resourceId,
              'Conta do registro': selected.accountId,
              'Conta autenticada': selected.authenticatedAsAccountId,
              'Identidade autenticada': selected.authenticatedAsIdentityId,
              Autenticação: selected.authType,
              'Código HTTP': selected.responseCode,
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
        </dl>
      </Modal>
    </>
  );
}
