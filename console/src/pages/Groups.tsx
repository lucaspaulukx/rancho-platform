import { useEffect, useRef, useState } from 'react';

import { useBlocker } from 'react-router-dom';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { History, Pencil, Plus, Search, ShieldCheck, Trash2, UsersRound } from 'lucide-react';

import {
  allPages,
  api,
  rawId,
  roles,
  type Account,
  type Group,
  type GroupInput,
  type Project,
  type Role,
} from '../api';

import { useApp } from '../state';
import { useLocalAccessData } from '../hooks/useLocalAccessData';
import { GroupAudit } from '../components/AccessDiagnostics';

import {
  Alert,
  Badge,
  Button,
  Confirm,
  DataTable,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Tabs,
  useToast,
} from '../components/ui';

export function groupChanges(original: Group | null, input: GroupInput) {
  const oldMembers = new Set(original?.members || []);
  const nextMembers = new Set(input.members || []);

  const environments = new Set([
    ...Object.keys(original?.grants || {}),
    ...Object.keys(input.grants || {}),
  ]);

  return {
    added: [...nextMembers].filter((id) => !oldMembers.has(id)),
    removed: [...oldMembers].filter((id) => !nextMembers.has(id)),
    changed: [...environments].filter((id) => original?.grants[id] !== input.grants?.[id]),
  };
}

export function GroupEditor({
  group,
  users,
  projects,
  onClose,
  onSaved,
}: {
  group: Group | null;
  users: Account[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(group?.name || '');
  const [nameError, setNameError] = useState('');
  const [members, setMembers] = useState(new Set(group?.members || []));

  const [grants, setGrants] = useState<Record<string, Role>>({ ...group?.grants });
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');

  const [discard, setDiscard] = useState(false);
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);

  const body: GroupInput = {
    name: name.trim(),
    members: [...members],
    grants,
    ...(group ? { id: group.id, revision: group.revision } : {}),
  };

  const changes = groupChanges(group, body);

  const dirty =
    name !== (group?.name || '') ||
    changes.added.length > 0 ||
    changes.removed.length > 0 ||
    changes.changed.length > 0;

  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);

  const blocker = useBlocker(dirty);

  const save = useMutation({
    mutationFn: () => api<Group>('localGroups', body),
    onSuccess: () => {
      toast(group ? 'Grupo atualizado. Os grants já estão em vigor.' : 'Grupo criado.');
      onSaved();
    },
  });

  function close() {
    if (save.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }

  const matchingUsers = users.filter((u) =>
    `${u.name || ''} ${u.id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  const matchingProjects = projects.filter((p) =>
    p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const missingMembers = [...members].filter((id) => !users.some((user) => rawId(user.id) === id));
  const missingProjects = Object.keys(grants).filter(
    (id) => !projects.some((project) => rawId(project.id) === id),
  );

  return (
    <>
      <Modal
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={group ? 'Editar grupo' : 'Criar grupo'}
        description="Defina membros e acesso aos environments em um único lugar."
        drawer
        footer={
          <>
            <span className="muted" style={{ marginRight: 'auto', fontSize: 11 }}>
              {members.size} membros · {Object.keys(grants).length} environments
            </span>
            <Button onClick={close} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              busy={save.isPending}
              onClick={() => {
                if (!name.trim()) {
                  setNameError('Informe um nome para o grupo.');
                  nameRef.current?.focus();
                  return;
                }
                if (tab < 2) {
                  setTab(2);
                  setSearch('');
                } else save.mutate();
              }}
            >
              {tab < 2 ? 'Revisar alterações' : 'Salvar grupo'}
            </Button>
          </>
        }
      >
        <Field
          label="Nome do grupo"
          error={nameError}
          hint="Um nome que represente a equipe ou sua função."
        >
          {(id, desc) => (
            <input
              ref={nameRef}
              id={id}
              aria-describedby={desc}
              value={name}
              maxLength={128}
              onChange={(e) => {
                setName(e.target.value);
                setNameError('');
              }}
              placeholder="Ex.: Operações de infraestrutura"
              required
            />
          )}
        </Field>

        <Tabs
          labels={[
            `Membros (${members.size})`,
            `Environments (${Object.keys(grants).length})`,
            'Revisão',
          ]}
          selected={tab}
          onChange={(index) => {
            setTab(index);
            setSearch('');
          }}
          panelId="group-tabpanel"
          idPrefix="group-tab"
          label="Configuração do grupo"
        />
        <div role="tabpanel" id="group-tabpanel" aria-labelledby={`group-tab-${tab}`}>
          {tab < 2 && (
            <label className="search-input" style={{ width: '100%' }}>
              <Search size={17} />
              <input
                aria-label={tab === 0 ? 'Buscar membros' : 'Buscar environments'}
                placeholder={tab === 0 ? 'Buscar por nome ou ID…' : 'Buscar environment…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          )}

          {tab === 0 && (
            <>
              <p className="muted" style={{ fontSize: 11, margin: '15px 0' }}>
                Selecione as contas que fazem parte deste grupo. Usuários novos precisam entrar ao
                menos uma vez para aparecer aqui.
              </p>
              <div className="selection-list">
                {matchingUsers.map((user) => (
                  <label
                    key={user.id}
                    className={`selection-item ${members.has(rawId(user.id)) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={members.has(rawId(user.id))}
                      disabled={user.state !== 'active' && !members.has(rawId(user.id))}
                      onChange={(e) => {
                        const next = new Set(members);
                        if (e.target.checked) next.add(rawId(user.id));
                        else next.delete(rawId(user.id));
                        setMembers(next);
                      }}
                    />
                    <span className="avatar">
                      {(user.name || user.id).slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <strong>{user.name || user.id}</strong>
                      <small>
                        {user.id} · {user.kind === 'admin' ? 'Administrador' : 'Usuário'}
                        {user.state !== 'active' ? ' · Conta inativa' : ''}
                      </small>
                    </div>
                  </label>
                ))}
                {!matchingUsers.length && <p className="muted">Nenhum usuário encontrado.</p>}
                {missingMembers
                  .filter((id) => id.includes(search.trim()))
                  .map((id) => (
                    <div className="selection-item selected" key={`missing-${id}`}>
                      <UsersRound size={19} />
                      <div>
                        <strong>Conta indisponível ({id})</strong>
                        <small>O vínculo foi preservado. Você pode removê-lo deste grupo.</small>
                      </div>
                      <Button
                        onClick={() =>
                          setMembers(
                            (current) => new Set([...current].filter((value) => value !== id)),
                          )
                        }
                      >
                        Remover vínculo da conta {id}
                      </Button>
                    </div>
                  ))}
              </div>
            </>
          )}

          {tab === 1 && (
            <>
              <p className="muted" style={{ fontSize: 11, margin: '15px 0' }}>
                Nenhum environment é concedido por padrão. Escolha o papel apenas nos ambientes
                necessários.
              </p>
              <div className="selection-list">
                {matchingProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`selection-item ${grants[rawId(project.id)] ? 'selected' : ''}`}
                  >
                    <ShieldCheck size={19} />
                    <div>
                      <strong>{project.name}</strong>
                      <small>{project.id}</small>
                    </div>
                    <select
                      aria-label={`Permissão em ${project.name}`}
                      value={grants[rawId(project.id)] || ''}
                      disabled={project.state !== 'active' && !grants[rawId(project.id)]}
                      onChange={(e) => {
                        const next = { ...grants };
                        if (e.target.value) next[rawId(project.id)] = e.target.value as Role;
                        else delete next[rawId(project.id)];
                        setGrants(next);
                      }}
                    >
                      <option value="">Sem acesso</option>
                      {roles
                        .filter(
                          (role) =>
                            project.state === 'active' || grants[rawId(project.id)] === role.value,
                        )
                        .map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
                {missingProjects
                  .filter((id) => id.includes(search.trim()))
                  .map((id) => (
                    <div className="selection-item selected" key={`missing-${id}`}>
                      <ShieldCheck size={19} />
                      <div>
                        <strong>Environment indisponível ({id})</strong>
                        <small>
                          Permissão preservada: {grants[id]}. Remova o vínculo se ele não deve
                          permanecer.
                        </small>
                      </div>
                      <Button
                        onClick={() =>
                          setGrants((current) => {
                            const next = { ...current };
                            delete next[id];
                            return next;
                          })
                        }
                      >
                        Remover permissão do environment {id}
                      </Button>
                    </div>
                  ))}
              </div>
              <Alert tone="info">
                Os papéis seguem as regras do Rancher. Acesso direto ao environment continua sendo
                considerado pelo backend.
              </Alert>
            </>
          )}

          {tab === 2 && (
            <>
              <h3>{name.trim() || 'Informe um nome para continuar'}</h3>
              <div className="review-list">
                <div>
                  <span>Membros selecionados</span>
                  <strong>{members.size}</strong>
                </div>
                <div>
                  <span>Environments com acesso</span>
                  <strong>{Object.keys(grants).length}</strong>
                </div>
              </div>
              <p className="muted" style={{ fontSize: 12 }}>
                {changes.added.length} membros adicionados · {changes.removed.length} removidos ·{' '}
                {changes.changed.length} permissões alteradas
              </p>
              <div className="selection-list">
                {Object.entries(grants).map(([id, role]) => (
                  <div key={id} className="selection-item">
                    <ShieldCheck size={17} />
                    <div>
                      <strong>{projects.find((p) => rawId(p.id) === id)?.name || id}</strong>
                    </div>
                    <Badge>{roles.find((r) => r.value === role)?.label || role}</Badge>
                  </div>
                ))}
              </div>
              {!Object.keys(grants).length && (
                <Alert tone="info">Este grupo não concederá acesso a nenhum environment.</Alert>
              )}
              {group && changes.removed.length > 0 && (
                <div style={{ marginTop: 15 }}>
                  <Alert tone="warning">
                    A remoção de membros retira os acessos concedidos por este grupo nas próximas
                    requisições, inclusive em sessões existentes.
                  </Alert>
                </div>
              )}
            </>
          )}
        </div>
        {save.error && (
          <div style={{ marginTop: 20 }}>
            <Alert>
              {save.error.message}
              {'status' in save.error && save.error.status === 409 && (
                <p>
                  Seus dados foram preservados. Feche o editor e recarregue o grupo para revisar a
                  versão atual antes de tentar novamente.
                </p>
              )}
            </Alert>
          </div>
        )}
      </Modal>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar alterações?"
        description="As alterações ainda não foram salvas neste grupo."
        onConfirm={onClose}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Sair sem salvar?"
        description="Seu rascunho de grupo ainda não foi salvo."
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}

export function Groups() {
  const app = useApp();
  const client = useQueryClient();
  const toast = useToast();

  const key = ['data', app.identity, 'access'];

  const query = useLocalAccessData();

  const [editing, setEditing] = useState<Group | null | undefined>();
  const [deleting, setDeleting] = useState<Group | null>(null);
  const [history, setHistory] = useState<Group | null | undefined>();

  const remove = useMutation({
    mutationFn: (group: Group) =>
      api('localGroups', {
        id: group.id,
        name: group.name,
        revision: group.revision,
        delete: true,
      }),
    onSuccess: async () => {
      setDeleting(null);
      await client.invalidateQueries({ queryKey: key });
      await app.refresh();
      toast('Grupo excluído. Os usuários foram preservados.');
    },
  });

  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;

  const { groups, users, projects } = query.data;

  const memberCount = new Set(groups.flatMap((g) => g.members)).size;
  const environmentCount = new Set(groups.flatMap((g) => Object.keys(g.grants))).size;

  return (
    <>
      <PageHeader
        title="Grupos e permissões"
        description="Organize suas equipes e conceda acesso aos environments, sem gerenciar usuário por usuário em cada ambiente."
        eyebrow="CONTROLE DE ACESSO"
        action={
          <>
            <Button onClick={() => setHistory(null)}>
              <History size={17} />
              Auditoria de grupos
            </Button>
            <Button variant="primary" onClick={() => setEditing(null)}>
              <Plus size={17} />
              Criar grupo
            </Button>
          </>
        }
      />
      <div className="metric-grid groups-metrics">
        <div className="metric">
          <div>
            <p>Grupos locais</p>
            <strong>{groups.length}</strong>
            <small>Gerenciados nesta instância</small>
          </div>
          <div className="metric-icon">
            <ShieldCheck size={21} />
          </div>
        </div>
        <div className="metric">
          <div>
            <p>Membros vinculados</p>
            <strong>{memberCount}</strong>
            <small>Usuários distintos nos grupos</small>
          </div>
          <div className="metric-icon">
            <UsersRound size={21} />
          </div>
        </div>
        <div className="metric">
          <div>
            <p>Environments com grants</p>
            <strong>{environmentCount}</strong>
            <small>Vínculos definidos pelos grupos</small>
          </div>
          <div className="metric-icon">
            <ShieldCheck size={21} />
          </div>
        </div>
      </div>
      <DataTable
        rows={groups}
        rowKey={(g) => g.id}
        searchText={(g) => g.name}
        emptyTitle="Comece organizando sua equipe"
        emptyDescription="Crie um grupo, adicione membros e escolha em quais environments eles poderão trabalhar."
        columns={[
          {
            key: 'name',
            label: 'Grupo',
            sortValue: (g) => g.name,
            render: (g) => (
              <div className="row-title">
                <span className="row-title-icon">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <button onClick={() => setEditing(g)}>{g.name}</button>
                  <small>Grupo local · revisão {g.revision}</small>
                </div>
              </div>
            ),
          },

          {
            key: 'members',
            label: 'Membros',
            sortValue: (g) => g.members.length,
            render: (g) => (
              <span>
                {g.members.length} usuário{g.members.length === 1 ? '' : 's'}
              </span>
            ),
          },

          {
            key: 'environments',
            label: 'Environments',
            render: (g) => (
              <div className="badge-row">
                {Object.keys(g.grants)
                  .slice(0, 2)
                  .map((id) => (
                    <Badge key={id}>{projects.find((p) => rawId(p.id) === id)?.name || id}</Badge>
                  ))}
                {Object.keys(g.grants).length > 2 && (
                  <Badge>+{Object.keys(g.grants).length - 2}</Badge>
                )}
                {!Object.keys(g.grants).length && <span className="muted">Sem grants</span>}
              </div>
            ),
          },

          {
            key: 'roles',
            label: 'Papéis',
            render: (g) => (
              <span className="muted">
                {[...new Set(Object.values(g.grants))]
                  .map((role) => roles.find((r) => r.value === role)?.label || role)
                  .join(', ') || '—'}
              </span>
            ),
          },

          {
            key: 'actions',
            label: 'Ações',
            render: (g) => (
              <div className="row-actions">
                <Button
                  variant="ghost"
                  onClick={() => setHistory(g)}
                  aria-label={`Histórico de ${g.name}`}
                >
                  <History size={15} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setEditing(g)}
                  aria-label={`Editar ${g.name}`}
                >
                  <Pencil size={15} />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDeleting(g)}
                  aria-label={`Excluir ${g.name}`}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ),
          },
        ]}
      />
      {history !== undefined && (
        <GroupAudit
          key={history?.id || 'all'}
          group={history}
          users={users}
          projects={projects}
          onClose={() => setHistory(undefined)}
        />
      )}
      {editing !== undefined && (
        <GroupEditor
          group={editing}
          users={users}
          projects={projects}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void client.invalidateQueries({ queryKey: key });
            void app.refresh();
          }}
        />
      )}
      <Confirm
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Excluir ${deleting?.name || 'grupo'}?`}
        description="Os grants deste grupo serão retirados. Usuários e vínculos diretos aos environments serão preservados."
        onConfirm={() => {
          if (deleting) remove.mutate(deleting);
        }}
        busy={remove.isPending}
      />
      {remove.error && <Alert>{remove.error.message}</Alert>}
    </>
  );
}
