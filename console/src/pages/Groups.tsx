import { requestErrorText } from '../request-errors';
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

import { useI18n } from '../i18n/provider';
import { roleLabel } from '../i18n/role-label';

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
  const { t } = useI18n();
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
      toast(group ? t('groups.updated') : t('groups.created'));
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
        title={group ? t('groups.editGroup') : t('groups.createGroup')}
        description={t('groups.editorDescription')}
        drawer
        footer={
          <>
            <span className="muted" style={{ marginRight: 'auto', fontSize: 11 }}>
              {t('groups.selectionSummary', {
                members: members.size,
                environments: Object.keys(grants).length,
              })}
            </span>
            <Button onClick={close} disabled={save.isPending}>
              {t('groups.cancel')}
            </Button>
            <Button
              variant="primary"
              busy={save.isPending}
              onClick={() => {
                if (!name.trim()) {
                  setNameError('required');
                  nameRef.current?.focus();
                  return;
                }
                if (tab < 2) {
                  setTab(2);
                  setSearch('');
                } else save.mutate();
              }}
            >
              {tab < 2 ? t('groups.reviewChanges') : t('groups.saveGroup')}
            </Button>
          </>
        }
      >
        <Field
          label={t('groups.groupName')}
          error={nameError ? t('groups.nameRequired') : ''}
          hint={t('groups.nameHint')}
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
              placeholder={t('groups.namePlaceholder')}
              required
            />
          )}
        </Field>

        <Tabs
          labels={[
            t('groups.membersTab', { count: members.size }),
            t('groups.environmentsTab', { count: Object.keys(grants).length }),
            t('groups.review'),
          ]}
          selected={tab}
          onChange={(index) => {
            setTab(index);
            setSearch('');
          }}
          panelId="group-tabpanel"
          idPrefix="group-tab"
          label={t('groups.configuration')}
        />
        <div role="tabpanel" id="group-tabpanel" aria-labelledby={`group-tab-${tab}`}>
          {tab < 2 && (
            <label className="search-input" style={{ width: '100%' }}>
              <Search size={17} />
              <input
                aria-label={tab === 0 ? t('groups.searchMembers') : t('groups.searchEnvironments')}
                placeholder={tab === 0 ? t('groups.searchNameId') : t('groups.searchEnvironment')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          )}

          {tab === 0 && (
            <>
              <p className="muted" style={{ fontSize: 11, margin: '15px 0' }}>
                {t('groups.membersHelp')}
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
                        {user.id} ·{' '}
                        {user.kind === 'admin' ? t('groups.administrator') : t('groups.user')}
                        {user.state !== 'active' ? t('groups.inactive') : ''}
                      </small>
                    </div>
                  </label>
                ))}
                {!matchingUsers.length && <p className="muted">{t('groups.noUsers')}</p>}
                {missingMembers
                  .filter((id) => id.includes(search.trim()))
                  .map((id) => (
                    <div className="selection-item selected" key={`missing-${id}`}>
                      <UsersRound size={19} />
                      <div>
                        <strong>{t('groups.missingAccount', { id })}</strong>
                        <small>{t('groups.preservedMember')}</small>
                      </div>
                      <Button
                        onClick={() =>
                          setMembers(
                            (current) => new Set([...current].filter((value) => value !== id)),
                          )
                        }
                      >
                        {t('groups.removeAccount', { id })}
                      </Button>
                    </div>
                  ))}
              </div>
            </>
          )}

          {tab === 1 && (
            <>
              <p className="muted" style={{ fontSize: 11, margin: '15px 0' }}>
                {t('groups.environmentHelp')}
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
                      aria-label={t('groups.permissionLabel', { name: project.name })}
                      value={grants[rawId(project.id)] || ''}
                      disabled={project.state !== 'active' && !grants[rawId(project.id)]}
                      onChange={(e) => {
                        const next = { ...grants };
                        if (e.target.value) next[rawId(project.id)] = e.target.value as Role;
                        else delete next[rawId(project.id)];
                        setGrants(next);
                      }}
                    >
                      <option value="">{t('groups.noAccess')}</option>
                      {roles
                        .filter(
                          (role) =>
                            project.state === 'active' || grants[rawId(project.id)] === role,
                        )
                        .map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(t, role)}
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
                        <strong>{t('groups.missingEnvironment', { id })}</strong>
                        <small>{t('groups.preservedPermission', { role: grants[id] })}</small>
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
                        {t('groups.removeEnvironment', { id })}
                      </Button>
                    </div>
                  ))}
              </div>
              <Alert tone="info">{t('groups.rancherRules')}</Alert>
            </>
          )}

          {tab === 2 && (
            <>
              <h3>{name.trim() || t('groups.nameToContinue')}</h3>
              <div className="review-list">
                <div>
                  <span>{t('groups.selectedMembers')}</span>
                  <strong>{members.size}</strong>
                </div>
                <div>
                  <span>{t('groups.accessEnvironments')}</span>
                  <strong>{Object.keys(grants).length}</strong>
                </div>
              </div>
              <p className="muted" style={{ fontSize: 12 }}>
                {t('groups.changes', {
                  added: changes.added.length,
                  removed: changes.removed.length,
                  changed: changes.changed.length,
                })}
              </p>
              <div className="selection-list">
                {Object.entries(grants).map(([id, role]) => (
                  <div key={id} className="selection-item">
                    <ShieldCheck size={17} />
                    <div>
                      <strong>{projects.find((p) => rawId(p.id) === id)?.name || id}</strong>
                    </div>
                    <Badge>{roleLabel(t, role)}</Badge>
                  </div>
                ))}
              </div>
              {!Object.keys(grants).length && (
                <Alert tone="info">{t('groups.noEnvironmentAccess')}</Alert>
              )}
              {group && changes.removed.length > 0 && (
                <div style={{ marginTop: 15 }}>
                  <Alert tone="warning">{t('groups.removalWarning')}</Alert>
                </div>
              )}
            </>
          )}
        </div>
        {save.error && (
          <div style={{ marginTop: 20 }}>
            <Alert>
              {requestErrorText(save.error, t)}
              {'status' in save.error && save.error.status === 409 && <p>{t('groups.conflict')}</p>}
            </Alert>
          </div>
        )}
      </Modal>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('groups.discardTitle')}
        description={t('groups.discardDescription')}
        onConfirm={onClose}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('groups.leaveTitle')}
        description={t('groups.leaveDescription')}
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}

export function Groups() {
  const { t } = useI18n();
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
      toast(t('groups.deleted'));
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
        title={t('groups.title')}
        description={t('groups.description')}
        eyebrow={t('groups.eyebrow')}
        action={
          <>
            <Button onClick={() => setHistory(null)}>
              <History size={17} />
              {t('groups.audit')}
            </Button>
            <Button variant="primary" onClick={() => setEditing(null)}>
              <Plus size={17} />
              {t('groups.createAction')}
            </Button>
          </>
        }
      />
      <div className="metric-grid groups-metrics">
        <div className="metric">
          <div>
            <p>{t('groups.localGroups')}</p>
            <strong>{groups.length}</strong>
            <small>{t('groups.managedHere')}</small>
          </div>
          <div className="metric-icon">
            <ShieldCheck size={21} />
          </div>
        </div>
        <div className="metric">
          <div>
            <p>{t('groups.linkedMembers')}</p>
            <strong>{memberCount}</strong>
            <small>{t('groups.distinctUsers')}</small>
          </div>
          <div className="metric-icon">
            <UsersRound size={21} />
          </div>
        </div>
        <div className="metric">
          <div>
            <p>{t('groups.grantedEnvironments')}</p>
            <strong>{environmentCount}</strong>
            <small>{t('groups.groupLinks')}</small>
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
        emptyTitle={t('groups.emptyTitle')}
        emptyDescription={t('groups.emptyDescription')}
        columns={[
          {
            key: 'name',
            label: t('groups.group'),
            sortValue: (g) => g.name,
            render: (g) => (
              <div className="row-title">
                <span className="row-title-icon">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <button onClick={() => setEditing(g)}>{g.name}</button>
                  <small>{t('groups.revision', { revision: g.revision })}</small>
                </div>
              </div>
            ),
          },

          {
            key: 'members',
            label: t('groups.members'),
            sortValue: (g) => g.members.length,
            render: (g) => (
              <span>
                {t(g.members.length === 1 ? 'groups.oneUser' : 'groups.manyUsers', {
                  count: g.members.length,
                })}
              </span>
            ),
          },

          {
            key: 'environments',
            label: t('groups.environments'),
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
                {!Object.keys(g.grants).length && (
                  <span className="muted">{t('groups.noGrants')}</span>
                )}
              </div>
            ),
          },

          {
            key: 'roles',
            label: t('groups.roles'),
            render: (g) => (
              <span className="muted">
                {[...new Set(Object.values(g.grants))]
                  .map((role) => roleLabel(t, role))
                  .join(', ') || '—'}
              </span>
            ),
          },

          {
            key: 'actions',
            label: t('groups.actions'),
            render: (g) => (
              <div className="row-actions">
                <Button
                  variant="ghost"
                  onClick={() => setHistory(g)}
                  aria-label={t('groups.historyLabel', { name: g.name })}
                >
                  <History size={15} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setEditing(g)}
                  aria-label={t('groups.editLabel', { name: g.name })}
                >
                  <Pencil size={15} />
                  {t('groups.edit')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDeleting(g)}
                  aria-label={t('groups.deleteLabel', { name: g.name })}
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
        title={t('groups.deleteTitle', { name: deleting?.name || t('groups.groupFallback') })}
        description={t('groups.deleteDescription')}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting);
        }}
        busy={remove.isPending}
      />
      {remove.error && <Alert>{requestErrorText(remove.error, t)}</Alert>}
    </>
  );
}
