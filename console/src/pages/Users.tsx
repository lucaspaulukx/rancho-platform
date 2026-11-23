import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ShieldCheck, UsersRound } from 'lucide-react';
import { rawId, roles, type Group, type Account } from '../api';
import { useApp } from '../state';
import { useLocalAccessData } from '../hooks/useLocalAccessData';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  Empty,
  ErrorState,
  Loading,
  PageHeader,
} from '../components/ui';
import { GroupEditor } from './Groups';
import { AccessDiagnostics } from '../components/AccessDiagnostics';
import { ActionMenu } from '../components/ActionMenu';
import { LocalAccountPanel, type AccountSelection } from '../components/LocalAccountPanel';
import { sessionAccountId } from '../local-accounts';

export function Users() {
  const app = useApp();
  const client = useQueryClient();
  const { id } = useParams();
  const query = useLocalAccessData();
  const [editing, setEditing] = useState<Group | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [management, setManagement] = useState<AccountSelection | null>(null);
  const accountAdministration = app.admin && app.config.modules.localAccountAdministration;
  const ownAccount = sessionAccountId(app.token);
  function actions(account: Account) {
    return (
      <ActionMenu
        label={`Ações da conta ${account.name || account.id}`}
        actions={[
          {
            id: 'profile',
            label: 'Editar perfil da conta',
            onSelect: () => setManagement({ mode: 'profile', account }),
          },
          {
            id: 'password',
            label: 'Redefinir senha local',
            onSelect: () => setManagement({ mode: 'password', account }),
          },
          ...(account.state === 'inactive'
            ? [
                {
                  id: 'activate',
                  label: 'Ativar conta',
                  onSelect: () => setManagement({ mode: 'activate', account }),
                },
              ]
            : []),
          ...(account.state === 'active'
            ? [
                {
                  id: 'deactivate',
                  label: 'Desativar conta',
                  danger: true,
                  disabled: !ownAccount || account.id === ownAccount,
                  reason: 'Use outro administrador para desativar sua conta.',
                  onSelect: () => setManagement({ mode: 'deactivate', account }),
                },
              ]
            : []),
          {
            id: 'remove',
            label: 'Excluir conta',
            danger: true,
            disabled: account.state !== 'inactive' || !ownAccount || account.id === ownAccount,
            reason:
              'Desative a conta antes de excluí-la; use outro administrador para sua própria conta.',
            onSelect: () => setManagement({ mode: 'remove', account }),
          },
        ]}
      />
    );
  }
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const { users, groups, projects, groupsEnabled } = query.data;
  const user = id ? users.find((user) => user.id === id) : undefined;
  if (id && !user)
    return (
      <Empty
        title="Usuário não encontrado"
        description="Esta conta não está disponível na instância."
      />
    );
  const memberships = user ? groups.filter((group) => group.members.includes(rawId(user.id))) : [];
  return (
    <>
      <PageHeader
        title={user?.name || (user ? user.id : 'Usuários')}
        description={
          user
            ? 'Conta Rancher e participação em grupos locais.'
            : 'Visualize suas contas e gerencie o acesso das equipes pelos grupos.'
        }
        eyebrow="CONTROLE DE ACESSO"
        action={
          user ? (
            <Link className="button secondary" to="/users">
              <ArrowLeft size={16} />
              Voltar
            </Link>
          ) : accountAdministration ? (
            <Button onClick={() => setManagement({ mode: 'create' })}>Criar conta local</Button>
          ) : undefined
        }
      />
      {user ? (
        <>
          <section className="panel">
            <div className="panel-heading">
              <h2>Dados da conta</h2>
              {groupsEnabled && (
                <Button onClick={() => setDiagnosing(true)}>
                  <ShieldCheck size={15} />
                  Acesso efetivo
                </Button>
              )}
              <Badge state={user.state}>{user.state}</Badge>
              {accountAdministration && actions(user)}
            </div>
            <dl className="details-grid">
              <div>
                <dt>Identificação</dt>
                <dd>{user.id}</dd>
              </div>
              <div>
                <dt>Perfil global</dt>
                <dd>{user.kind === 'admin' ? 'Administrador' : 'Usuário'}</dd>
              </div>
              <div>
                <dt>Nome</dt>
                <dd>{user.name || 'Não informado'}</dd>
              </div>
              <div>
                <dt>Grupos locais</dt>
                <dd>{groupsEnabled ? memberships.length : 'Gerenciamento desativado'}</dd>
              </div>
            </dl>
            {user.kind === 'admin' && (
              <Alert tone="info">
                Esta conta tem privilégios administrativos globais. Participação em grupos não reduz
                esses privilégios.
              </Alert>
            )}
          </section>
          <section className="panel" style={{ marginTop: 20 }}>
            <div className="panel-heading">
              <h2>Participação em grupos</h2>
            </div>
            {!groupsEnabled ? (
              <Alert tone="info">
                O gerenciamento de grupos está desativado nesta console ou no servidor.
              </Alert>
            ) : (
              <DataTable
                rows={groups}
                rowKey={(group) => group.id}
                searchText={(group) => group.name}
                emptyTitle="Nenhum grupo local"
                emptyDescription="Crie um grupo para organizar os acessos da equipe."
                columns={[
                  {
                    key: 'name',
                    label: 'Grupo',
                    sortValue: (group) => group.name,
                    render: (group) => (
                      <div className="row-title">
                        <span className="row-title-icon">
                          <ShieldCheck size={18} />
                        </span>
                        <strong>{group.name}</strong>
                      </div>
                    ),
                  },
                  {
                    key: 'member',
                    label: 'Participação',
                    render: (group) => (
                      <Badge state={group.members.includes(rawId(user.id)) ? 'active' : undefined}>
                        {group.members.includes(rawId(user.id)) ? 'Membro' : 'Não participa'}
                      </Badge>
                    ),
                  },
                  {
                    key: 'grants',
                    label: 'Environments',
                    render: (group) => Object.keys(group.grants).length,
                  },
                  {
                    key: 'edit',
                    label: 'Gerenciamento',
                    render: (group) => (
                      <Button variant="ghost" onClick={() => setEditing(group)}>
                        Editar grupo
                        <ArrowRight size={15} />
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </section>
          {groupsEnabled && memberships.length > 0 && (
            <section className="panel" style={{ marginTop: 20 }}>
              <h2>Grants dos grupos</h2>
              <p className="muted" style={{ fontSize: 12 }}>
                Os vínculos abaixo mostram o que cada grupo concede. Permissões diretas e
                privilégios globais também são considerados pelo Rancher.
              </p>
              <div className="selection-list">
                {memberships.flatMap((group) =>
                  Object.entries(group.grants).map(([project, role]) => (
                    <div className="selection-item" key={`${group.id}-${project}`}>
                      <ShieldCheck size={18} />
                      <div>
                        <strong>
                          {projects.find((p) => rawId(p.id) === project)?.name || project}
                        </strong>
                        <small>{group.name}</small>
                      </div>
                      <Badge>{roles.find((r) => r.value === role)?.label || role}</Badge>
                    </div>
                  )),
                )}
              </div>
            </section>
          )}
        </>
      ) : (
        <DataTable
          rows={users}
          rowKey={(user) => user.id}
          searchText={(user) => `${user.name || ''} ${user.id} ${user.kind}`}
          columns={[
            {
              key: 'name',
              label: 'Usuário',
              sortValue: (user) => user.name || user.id,
              render: (user) => (
                <Link className="row-title" to={`/users/${user.id}`}>
                  <span className="row-title-icon">
                    <UsersRound size={18} />
                  </span>
                  <div>
                    <strong>{user.name || user.id}</strong>
                    <small>{user.id}</small>
                  </div>
                </Link>
              ),
            },
            {
              key: 'kind',
              label: 'Perfil global',
              render: (user) => (
                <Badge>{user.kind === 'admin' ? 'Administrador' : 'Usuário'}</Badge>
              ),
            },
            {
              key: 'state',
              label: 'Estado',
              sortValue: (user) => user.state,
              render: (user) => <Badge state={user.state}>{user.state}</Badge>,
            },
            {
              key: 'groups',
              label: 'Grupos locais',
              render: (user) =>
                groupsEnabled
                  ? groups.filter((group) => group.members.includes(rawId(user.id))).length
                  : 'Desativados',
            },
            {
              key: 'open',
              label: 'Detalhes',
              render: (user) => (
                <Link
                  className="button ghost"
                  to={`/users/${user.id}`}
                  aria-label={`Abrir ${user.name || user.id}`}
                >
                  <ArrowRight size={16} />
                </Link>
              ),
            },
            ...(accountAdministration
              ? [{ key: 'actions', label: 'Ações', render: (account: Account) => actions(account) }]
              : []),
          ]}
        />
      )}
      {diagnosing && user && (
        <AccessDiagnostics
          key={user.id}
          account={user}
          projects={projects}
          onClose={() => setDiagnosing(false)}
        />
      )}
      {editing && (
        <GroupEditor
          group={editing}
          users={users}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void client.invalidateQueries({ queryKey: ['data', app.identity, 'access'] });
            void app.refresh();
          }}
        />
      )}
      {management && accountAdministration && (
        <LocalAccountPanel
          key={`${app.identity}:${management.account?.id || 'new'}:${management.mode}`}
          selection={management}
          onClose={() => setManagement(null)}
        />
      )}
    </>
  );
}
