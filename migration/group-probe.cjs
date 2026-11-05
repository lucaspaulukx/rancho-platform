// Public source is bundled after native-client.cjs. Private input remains in memory.
const grantFs = require('node:fs');
const grantCrypto = require('node:crypto');
const grantInput = JSON.parse(grantFs.readFileSync(0, 'utf8'));
const grantClient = new NativeClient();
const grantChecks = [];
const grantDenialStatuses = {};
let grantStage = 'administrator';
function grantCheck(name, valid, httpStatus = null) {
  if (!valid) {
    const error = new Error('Grant rehearsal check failed');
    error.httpStatus = httpStatus; error.checkName = name; throw error;
  }
  grantChecks.push(name);
}
function grantId(value) {
  const text = String(value).replace(/^1a/, '');
  if (!/^[1-9][0-9]*$/.test(text)) throw new Error('Unexpected account identifier');
  return text;
}
function grantCanonical(values) { return JSON.stringify(values); }
function grantMemberVector(values) {
  return values.map(m => [m.externalIdType, m.externalIdType === 'rancher_id' ? grantId(m.externalId) : m.externalId, m.role])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
async function grantMatrix(projects) {
  const roles = [], visible = [];
  for (const user of grantInput.users) {
    const actual = await grantClient.api('projects?limit=-1', undefined, { jar: String(user.id) });
    visible.push([String(user.id), actual.data.map(p => grantId(p.id)).sort()]);
    for (const project of projects) {
      const report = await grantClient.api('localAccessReports?targetAccount=1a' + user.id + '&targetEnvironment=' + project.id);
      const row = report.data[0];
      grantCheckScope(row);
      roles.push([String(user.id), grantId(project.id), row.effectiveRole ?? null]);
    }
  }
  return { roles, visible };
}
function grantCheckScope(row) { if (!row || row.complete !== true) throw new Error('Incomplete identity scope'); }
async function grantMembers(project) {
  const result = await grantClient.api('projectMembers?projectId=1a' + project + '&limit=-1');
  return result.data.map(m => ({ externalIdType: m.externalIdType, externalId: m.externalId, role: m.role }));
}
async function grantSetMembers(project, members) {
  grantCheck('native owner retained for changed environment', members.some(m => m.role === 'owner'));
  await grantClient.api('projects/1a' + project + '?action=setmembers', { members });
  const expected = grantCanonical(grantMemberVector(members));
  for (let attempt = 0; attempt < 90; attempt++) {
    if (grantCanonical(grantMemberVector(await grantMembers(project))) === expected) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Native membership lifecycle did not converge');
}
function grantGroupSame(actual, expected) {
  return actual.name === expected.name &&
    grantCanonical(actual.members.map(grantId).sort()) === grantCanonical(expected.members.map(grantId).sort()) &&
    grantCanonical(Object.entries(actual.grants).map(([p, r]) => [grantId(p), r]).sort()) ===
      grantCanonical(Object.entries(expected.grants).map(([p, r]) => [grantId(p), r]).sort());
}
function grantGroupBody(group, updates = {}) {
  return { id: group.id, name: group.name, revision: group.revision, members: group.members, grants: group.grants, ...updates };
}
async function grantMain() {
  const credentials = grantInput.credentials;
  await grantClient.login('admin', credentials.rancherUsername, credentials.rancherPassword);
  const projects = (await grantClient.api('projects?all=true&limit=-1')).data.sort((a,b) => Number(grantId(a.id)) - Number(grantId(b.id)));
  grantCheck('twenty recovered environments available', projects.length === 20);
  const existing = (await grantClient.api('localGroups')).data;
  grantStage = 'fixture-passwords';
  for (const user of grantInput.users) {
    grantStage = 'fixture-password-create';
    const password = await grantClient.api('passwords', { accountId: '1a' + user.id, publicValue: user.name, secretValue: user.password });
    grantStage = 'fixture-password-active';
    await grantClient.waitActive('passwords/' + password.id);
    grantStage = 'fixture-user-login';
    await grantClient.login(String(user.id), user.name, user.password);
  }
  grantStage = 'baseline-matrix';
  const before = await grantMatrix(projects);
  grantCheck('complete baseline role matrix3x20', before.roles.length === 60);
  const expectedVisible = grantInput.users.map(user => [String(user.id),
    [...new Set(grantInput.plan.groups.filter(g => g.members.includes(String(user.id))).flatMap(g => Object.keys(g.grants)))].sort()]);
  grantCheck('fixture users see exactly their original environments', grantCanonical(before.visible) === grantCanonical(expectedVisible));
  grantCheck('local fixture login creates no automatic environment', (await grantClient.api('projects?all=true&limit=-1')).data.length === 20);
  const projectIds = [...new Set(grantInput.plan.groups.flatMap(g => Object.keys(g.grants)))].sort();
  const nativeBefore = new Map();
  for (const project of projectIds) nativeBefore.set(project, await grantMembers(project));
  const receipts = [];
  grantStage = 'coexist-groups';
  for (const group of grantInput.plan.groups) {
    grantCheck('proposal never overwrites an existing group', !existing.some(g => g.name.toLowerCase() === group.name.toLowerCase()));
    const created = await grantClient.api('localGroups', { name: group.name, members: group.members, grants: group.grants });
    grantCheck('group created with exact members and bindings', grantGroupSame(created, group));
    receipts.push(created);
  }
  grantCheck('coexistence preserves60 roles and visible environment sets', grantCanonical(await grantMatrix(projects)) === grantCanonical(before));
  const plannedUsers = new Set(grantInput.plan.groups.flatMap(g => g.members).map(grantId));
  const nativeAfter = new Map();
  grantStage = 'native-cutover';
  for (const project of projectIds) {
    const current = await grantMembers(project);
    grantCheck('native baseline unchanged before cutover', grantCanonical(grantMemberVector(current)) === grantCanonical(grantMemberVector(nativeBefore.get(project))));
    const filtered = current.filter(m => m.externalIdType !== 'rancher_id' || !plannedUsers.has(grantId(m.externalId)));
    nativeAfter.set(project, filtered);
    await grantSetMembers(project, filtered);
  }
  grantCheck('native cutover preserves60 roles and visibility', grantCanonical(await grantMatrix(projects)) === grantCanonical(before));
  for (const user of grantInput.users) {
    for (const group of grantInput.plan.groups.filter(g => g.members.includes(String(user.id)))) {
      for (const project of Object.keys(group.grants)) {
        const report = (await grantClient.api('localAccessReports?targetAccount=1a' + user.id + '&targetEnvironment=1a' + project)).data[0];
        grantCheck('migrated access comes from groups with no direct source', report.sources.some(s => s.kind === 'group') && !report.sources.some(s => s.kind === 'direct'));
      }
    }
  }
  grantStage = 'readonly-denial';
  const readonly = grantInput.users[0];
  const readonlyProject = before.roles.find(([u, p, role]) => u === String(readonly.id) && role === 'readonly')[1];
  const memberProject = before.roles.find(([u, p, role]) => u === String(readonly.id) && role === 'member')[1];
  const nonce = grantCrypto.randomBytes(6).toString('hex');
  const positive = await grantClient.request('/v2-beta/projects/1a' + memberProject + '/stacks', {
    jar: String(readonly.id), body: { name: 'grant-member-control-' + nonce } });
  grantCheck('same session with member group can create valid empty stack', [200, 201, 202].includes(positive.status), positive.status);
  const deniedName = 'grant-readonly-denied-' + nonce;
  const denied = await grantClient.request('/v2-beta/projects/1a' + readonlyProject + '/stacks', {
    jar: String(readonly.id), body: { name: deniedName } });
  grantCheck('readonly group cannot create stack', [403, 404, 405].includes(denied.status), denied.status);
  grantDenialStatuses.readonlyStackCreate = denied.status;
  const stackList = await grantClient.api('projects/1a' + readonlyProject + '/stacks?limit=-1');
  grantCheck('denied readonly request created no stack', !stackList.data.some(stack => stack.name === deniedName));
  const deniedGroupName = 'grant-user-admin-denied-' + nonce;
  const noAdmin = await grantClient.request('/v2-beta/localGroups', { jar: String(readonly.id), body: { name: deniedGroupName } });
  grantCheck('ordinary group cannot administer local groups', [403, 404, 405].includes(noAdmin.status), noAdmin.status);
  grantDenialStatuses.ordinaryGroupCreate = noAdmin.status;
  grantCheck('denied ordinary request created no group', !(await grantClient.api('localGroups')).data.some(group => group.name === deniedGroupName));
  grantStage = 'group-revocation';
  const index = receipts.findIndex(g => g.members.map(grantId).includes(String(readonly.id)));
  const original = receipts[index];
  const changed = await grantClient.api('localGroups', grantGroupBody(original, { members: original.members.filter(m => grantId(m) !== String(readonly.id)) }));
  const stale = await grantClient.request('/v2-beta/localGroups', { body: grantGroupBody(original, { delete: true }) });
  grantCheck('stale rollback receipt cannot delete revised group', stale.status === 409);
  const removed = await grantClient.request('/v2-beta/projects/1a' + readonlyProject, { jar: String(readonly.id) });
  grantCheck('existing user session loses revoked group access', [403, 404].includes(removed.status));
  receipts[index] = await grantClient.api('localGroups', grantGroupBody(changed, { members: original.members, grants: original.grants }));
  grantCheck('restoring owned membership restores exact60 roles', grantCanonical(await grantMatrix(projects)) === grantCanonical(before));
  grantStage = 'native-rollback';
  for (const project of projectIds) {
    grantCheck('native rollback refuses drift', grantCanonical(grantMemberVector(await grantMembers(project))) === grantCanonical(grantMemberVector(nativeAfter.get(project))));
    await grantSetMembers(project, nativeBefore.get(project));
  }
  for (const receipt of receipts.reverse()) {
    const current = (await grantClient.api('localGroups')).data.find(g => g.id === receipt.id);
    grantCheck('rollback deletes only unchanged owned group receipt', !!current && current.revision === receipt.revision && grantGroupSame(current, receipt));
    await grantClient.api('localGroups', grantGroupBody(receipt, { delete: true }));
  }
  grantCheck('rollback restores native access and60 roles', grantCanonical(await grantMatrix(projects)) === grantCanonical(before));
  grantCheck('pre-existing groups preserved', grantCanonical((await grantClient.api('localGroups')).data) === grantCanonical(existing));
  return { status: 'passed', checks: grantChecks, matrixEntries: 60, denialStatuses: grantDenialStatuses,
    baselineMatrixSha256: grantCrypto.createHash('sha256').update(grantCanonical(before)).digest('hex'),
    originalSnapshotProductionCutoverAccepted: false };
}
(async () => {
  let result;
  try { result = await grantMain(); }
  catch (error) { result = { status: 'failed', stage: grantStage, failedCheck: error.checkName || null, httpStatus: error.httpStatus || null, nativeCode: error.nativeCode || null, passedChecks: grantChecks }; }
  try { await grantClient.revoke(); result.sessionCleanupPassed = true; } catch {
    if (result.status === 'passed') result = { status: 'failed', stage: 'session-cleanup', passedChecks: grantChecks };
    result.sessionCleanupPassed = false;
  }
  process.stdout.write(JSON.stringify(result));
  if (result.status !== 'passed') process.exitCode = 1;
})();
