"""Local console acceptance; credentials and stream URLs never enter evidence."""
import argparse
import csv
import importlib.util
import io
import json
import logging
import secrets
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
logging.disable(logging.CRITICAL)
checks = []
group = None
stage = 'initialization'
parser = argparse.ArgumentParser()
parser.add_argument('--expect-disabled', action='store_true')
parser.add_argument('--soak-seconds', type=int, default=0)
parser.add_argument('--streams', action='store_true')
parser.add_argument('--access', action='store_true')
parser.add_argument('--bulk-remove', action='store_true')
parser.add_argument('--a11y', action='store_true')
parser.add_argument('--topology', action='store_true')
parser.add_argument('--session-expiry', action='store_true')
parser.add_argument('--self-access', action='store_true')
parser.add_argument('--source-styles', action='store_true')
parser.add_argument('--base-url', choices=['http://localhost:18090', 'http://localhost:18091'], default='http://localhost:18090')
args = parser.parse_args()
lab.BASE = args.base_url


def check(name, condition=True):
    assert condition, name
    checks.append({'check': name, 'status': 'passed'})
    print('PASS: ' + name, flush=True)


def session():
    user = lab.Session()
    user.opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(user.cookies))
    return user


def cookies(user):
    return [{'name': item.name, 'value': item.value, 'url': lab.BASE}
            for item in user.cookies if item.name in ('token', 'CSRF')]


def track(page):
    sockets = []

    def opened(socket):
        state = {'frames': 0, 'closed': False}
        sockets.append(state)
        socket.on('framereceived', lambda _: state.update(frames=state['frames'] + 1))
        socket.on('close', lambda: state.update(closed=True))

    page.on('websocket', opened)
    return sockets


def until(page, predicate, timeout=45000):
    deadline = time.monotonic() + timeout / 1000
    while not predicate():
        assert time.monotonic() < deadline, 'Browser condition timed out'
        page.wait_for_timeout(100)


def host_metrics(page):
    page.goto(lab.BASE + '/console/hosts/1h1?env=1a12')
    page.get_by_role('button', name='Métricas do host', exact=True).click()
    expect(page.get_by_text('Ao vivo', exact=True)).to_be_visible(timeout=45000)


def stream_acceptance(browser):
    global group, stage
    stage = 'physical terminal downgrade'
    group = admin.api('localGroups', {'name': 'Console stream test ' + secrets.token_hex(4),
                                     'members': ['10'], 'grants': {'12': 'member'}})
    reader = session()
    reader.oidc('leitor')
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    context.add_cookies(cookies(reader))
    page = context.new_page()
    sockets = track(page)
    page.goto(lab.BASE + '/console/hosts/1h1?env=1a12')
    row = page.get_by_role('row').filter(
        has=page.get_by_role('button', name='console-standalone', exact=True))
    row.get_by_role('button', name='Terminal', exact=True).click()
    page.get_by_role('button', name='Conectar ao container', exact=True).click()
    until(page, lambda: sockets and sockets[-1]['frames'] > 0)
    check('member opens a real interactive terminal on the physical container')
    group = admin.api('localGroups', {'id': group['id'], 'name': group['name'],
                                     'revision': group['revision'], 'members': ['10'],
                                     'grants': {'12': 'readonly'}})
    current = reader.api('projects/1a12/containers/1i1')
    check('downgrade preserves container GET and logs but removes execute action',
          'logs' in current.get('actions', {}) and 'execute' not in current.get('actions', {}))
    until(page, lambda: sockets[-1]['closed'], timeout=35000)
    expect(page.get_by_role('alert')).to_contain_text('seu acesso expirou')
    check('readonly downgrade closes the already open physical terminal')
    page.screenshot(path=str(ROOT / 'evidence/console-terminal-downgrade.png'))
    page.get_by_role('button', name='Fechar conexão', exact=True).click()
    stage = 'physical log revocation'
    row.get_by_role('button', name='Logs', exact=True).click()
    expect(page.get_by_role('log')).to_contain_text('standalone-lab-log', timeout=30000)
    check('downgraded readonly session can still receive real container logs')
    admin.api('localGroups', {'id': group['id'], 'name': group['name'],
                              'revision': group['revision'], 'delete': True})
    group = None
    until(page, lambda: sockets[-1]['closed'], timeout=35000)
    check('removing environment grant closes an already open physical log socket')
    status, _, _ = reader.request('/v2-beta/projects/1a12/containers/1i1')
    check('revoked session cannot read the physical container', status in (403, 404))
    context.close()


def self_access_acceptance(browser):
    global stage
    stage = 'ordinary account self-service report'
    reader = session()
    reader.oidc('leitor')
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    context.add_cookies(cookies(reader))
    page = context.new_page()
    page.goto(lab.BASE + '/console/?env=1a7')
    page.get_by_label('Menu do usuário', exact=True).click()
    page.get_by_role('button', name='Meu acesso', exact=True).click()
    drawer = page.get_by_role('dialog')
    expect(drawer.locator('dd').filter(has_text='Read Only')).to_be_visible()
    expect(drawer.get_by_role('cell', name='Leitores - laboratorio', exact=True)).to_be_visible()
    check('ordinary user sees own native readonly role and contributing group in shared drawer')
    values = drawer.get_by_label('Environment', exact=True).locator('option').evaluate_all('elements => elements.map(element => element.value)')
    check('self-service selector does not disclose unauthorized production environment', '1a7' in values and '1a8' not in values)
    page.screenshot(path=str(ROOT / 'evidence/console-self-access-reader.png'))
    drawer.get_by_role('button', name='Fechar', exact=True).click()
    page.goto(lab.BASE + '/console/users/1a1?env=1a7')
    expect(page.get_by_role('heading', name='Acesso restrito', exact=True)).to_be_visible()
    check('self-service does not grant access to another account administrative route')
    context.close()


def session_expiry_acceptance(browser):
    global group, stage
    group = admin.api('localGroups', {'name': 'Console cookie expiry ' + secrets.token_hex(4),
                                     'members': ['11'], 'grants': {'12': 'member'}})
    operator = session()
    operator.oidc('operador')
    for mode in ('metrics', 'logs', 'terminal'):
        stage = 'physical cookie expiration during ' + mode
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.add_cookies(cookies(operator))
        page = context.new_page()
        sockets = track(page)
        if mode == 'metrics':
            host_metrics(page)
        else:
            page.goto(lab.BASE + '/console/hosts/1h1?env=1a12')
            row = page.get_by_role('row').filter(has=page.get_by_role('button', name='console-standalone', exact=True))
            row.get_by_role('button', name='Logs' if mode == 'logs' else 'Terminal', exact=True).click()
            if mode == 'terminal':
                page.get_by_role('button', name='Conectar ao container', exact=True).click()
        until(page, lambda: sockets and sockets[-1]['frames'] >= 2)
        check(mode + ': isolated operator receives actual stream frames before cookie expiration')
        context.clear_cookies(name='token')
        until(page, lambda: sockets[-1]['closed'], timeout=35000)
        check(mode + ': losing browser session cookie closes the already open socket')
        expect(page.get_by_role('heading', name='Acesse seu ambiente', exact=True)).to_be_visible(timeout=10000)
        check(mode + ': unauthorized resource revalidation returns to the shared login screen')
        context.close()


def topology_acceptance(browser):
    global stage
    stage = 'native service topology'
    base = 'projects/1a12'
    name = 'console-graph-' + secrets.token_hex(4)
    stack = admin.api(base + '/stacks', {'name': name, 'description': 'Disposable topology acceptance'})
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    context.add_cookies(cookies(admin))
    page = context.new_page()
    try:
        services = [admin.api(base + '/services', {'name': name + '-' + suffix,
                    'stackId': stack['id'], 'scale': 0, 'startOnCreate': False,
                    'launchConfig': {'imageUuid': 'docker:alpine:3.20', 'command': ['true']}})
                    for suffix in ('web', 'database')]
        def link_action():
            current = admin.api(base + '/services/' + services[0]['id'])
            return current.get('actions', {}).get('setservicelinks')
        until(page, link_action)
        status, _, _ = admin.request(link_action(), {'serviceLinks': [{'serviceId': services[1]['id'], 'name': 'database'}]})
        check('disposable service link is accepted by the native Rancher action', status in (200, 202))
        mappings = []
        def find_mapping():
            mappings[:] = [value for value in admin.api(base + '/serviceConsumeMaps?limit=100')['data']
                           if value.get('serviceId') == services[0]['id'] and value.get('consumedServiceId') == services[1]['id']]
            return bool(mappings)
        until(page, find_mapping)
        errors = []
        page.on('pageerror', lambda error: errors.append(type(error).__name__))
        page.goto(lab.BASE + '/console/?env=1a12')
        page.get_by_role('button', name='Topologia', exact=True).click()
        drawer = page.get_by_role('dialog')
        drawer.get_by_label('Stack', exact=True).select_option(stack['id'])
        for service in services:
            expect(drawer.locator('.react-flow__node[data-id="' + service['id'] + '"]')).to_be_visible()
        edge = drawer.locator('.react-flow__edge[data-id="' + mappings[0]['id'] + '"]')
        expect(edge).to_be_visible()
        expect(drawer.get_by_text('database', exact=True)).to_be_visible()
        check('topology renders both native service nodes and their persisted directional link')
        page.screenshot(path=str(ROOT / 'evidence/console-service-topology-dark.png'))
        viewport = drawer.locator('.react-flow__viewport')
        before = viewport.get_attribute('style')
        drawer.get_by_role('button', name='Ampliar topologia', exact=True).click()
        until(page, lambda: viewport.get_attribute('style') != before)
        check('topology zoom control changes the actual graph transform')
        page.set_viewport_size({'width': 390, 'height': 844})
        drawer.get_by_role('button', name='Enquadrar topologia', exact=True).click()
        until(page, lambda: drawer.locator('.service-topology').evaluate('''element => {
          const bounds = element.getBoundingClientRect();
          return [...element.querySelectorAll('.react-flow__node')].every(node => {
            const box = node.getBoundingClientRect();
            return box.left >= bounds.left - 1 && box.right <= bounds.right + 1 &&
                   box.top >= bounds.top - 1 && box.bottom <= bounds.bottom + 1;
          });
        }'''))
        check('mobile fit control frames both real service nodes inside the graph')
        check('mobile topology viewport stays inside its drawer', drawer.evaluate(
            '(element) => { const box = element.getBoundingClientRect(); return box.x >= 0 && box.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1; }'))
        page.screenshot(path=str(ROOT / 'evidence/console-service-topology-mobile.png'))
        drawer.get_by_role('button', name='Fechar', exact=True).click()
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.get_by_role('button', name='Usar tema claro', exact=True).click()
        page.get_by_role('button', name='Topologia', exact=True).click()
        drawer.get_by_label('Stack', exact=True).select_option(stack['id'])
        expect(page.locator('html')).to_have_attribute('data-theme', 'light')
        expect(edge).to_be_visible()
        page.screenshot(path=str(ROOT / 'evidence/console-service-topology-light.png'))
        check('topology renders the same persisted link in the shared light theme')
        check('topology produces no browser runtime errors', not errors)
    finally:
        context.close()
        status, current, _ = admin.request('/v2-beta/' + base + '/stacks/' + stack['id'])
        if status == 200 and not current.get('removed'):
            action = current.get('actions', {}).get('remove')
            assert action, 'Temporary topology stack cleanup unavailable'
            assert admin.request(action, {})[0] in (200, 202, 204), 'Temporary topology stack cleanup failed'


def accessibility_acceptance(browser):
    global stage
    stage = 'automated WCAG accessibility'
    source = (ROOT / 'console/node_modules/axe-core/axe.min.js').read_text(encoding='utf-8')
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()

    def audit(label):
        if args.source_styles:
            page.evaluate('''css => {
              const sheet = new CSSStyleSheet(); sheet.replaceSync(css);
              const selected = [...sheet.cssRules].filter(rule => rule.type === CSSRule.STYLE_RULE &&
                ['.avatar', '.badge.negative', '.badge.positive', '.badge.warning'].includes(rule.selectorText));
              const style = document.createElement('style');
              style.textContent = selected.map(rule => rule.cssText).join('\\n');
              document.head.appendChild(style);
            }''', (ROOT / 'console/src/styles.css').read_text(encoding='utf-8'))
        page.evaluate(source)
        violations = page.evaluate('''async () => {
                    await document.fonts.ready;
                    await Promise.all(document.getAnimations().filter(animation =>
                        Number.isFinite(animation.effect?.getComputedTiming().endTime))
                        .map(animation => animation.finished.catch(() => {})));
          const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
          return result.violations.map(value => ({ id: value.id, impact: value.impact,
            targets: value.nodes.flatMap(node => node.target) }));
        }''')
        checks.append({'check': label, 'status': 'failed' if violations else 'passed',
                       'sourceStyles': args.source_styles, 'violations': violations})
        print(('FAILED: ' if violations else 'PASS: ') + label +
              (': ' + ', '.join(value['id'] for value in violations) if violations else ''), flush=True)

    page.goto(lab.BASE + '/console/login')
    expect(page.get_by_role('heading', name='Acesse seu ambiente', exact=True)).to_be_visible()
    audit('WCAG automated login in dark theme')
    context.add_cookies(cookies(admin))
    for route, title in (('/?env=1a12', 'UI-OPS-LAB'), ('/hosts/1h1?env=1a12', None),
                         ('/groups?env=1a12', 'Grupos e permissões'), ('/users/1a10?env=1a12', 'leitor')):
        page.goto(lab.BASE + '/console' + route)
        expect(page.get_by_role('heading', name=title, exact=True) if title else
               page.get_by_role('heading', level=1)).to_be_visible()
        audit('WCAG automated dark route ' + route.split('?')[0])
    trigger = page.get_by_role('button', name='Acesso efetivo', exact=True)
    trigger.click()
    drawer = page.get_by_role('dialog')
    expect(drawer.get_by_text('Papel efetivo', exact=True)).to_be_visible()
    audit('WCAG automated effective access drawer dark')
    page.keyboard.press('Escape')
    expect(drawer).to_have_count(0)
    expect(trigger).to_be_focused()
    check('effective access drawer restores keyboard focus to its trigger')
    page.get_by_role('button', name='Usar tema claro', exact=True).click()
    trigger.click()
    expect(drawer.get_by_text('Papel efetivo', exact=True)).to_be_visible()
    audit('WCAG automated effective access drawer light')
    page.set_viewport_size({'width': 390, 'height': 844})
    audit('WCAG automated effective access drawer mobile light')
    page.keyboard.press('Escape')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.goto(lab.BASE + '/console/groups?env=1a12')
    page.get_by_role('button', name='Auditoria de grupos', exact=True).click()
    expect(page.get_by_role('cell', name='Exclusão', exact=True).first).to_be_visible()
    audit('WCAG automated group audit drawer light')
    page.keyboard.press('Escape')
    page.goto(lab.BASE + '/console/?env=1a12')
    page.get_by_role('button', name='Topologia', exact=True).click()
    expect(page.locator('.react-flow__node').first).to_be_visible()
    audit('WCAG automated service topology drawer light')
    context.close()
    if any(value['status'] != 'passed' for value in checks):
        raise AssertionError('Automated accessibility violations recorded')


def bulk_remove_acceptance(browser):
    global group, stage
    stage = 'native bulk removal in real browser'
    base = 'projects/1a12'
    name = 'console-remove-' + secrets.token_hex(4)
    stack = admin.api(base + '/stacks', {'name': name, 'description': 'Disposable bulk removal acceptance'})
    try:
        services = [admin.api(base + '/services', {'name': name + '-' + suffix,
                    'stackId': stack['id'], 'scale': 0, 'startOnCreate': False,
                    'launchConfig': {'imageUuid': 'docker:alpine:3.20', 'command': ['true']}})
                    for suffix in ('one', 'two')]
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.add_cookies(cookies(admin))
        page = context.new_page()
        posts = []
        page.on('request', lambda request: posts.append(True) if request.method == 'POST'
                and 'action=remove' in request.url else None)
        page.goto(lab.BASE + '/console/?env=1a12&q=' + name)
        for service in services:
            page.get_by_role('checkbox', name='Selecionar ' + service['name'], exact=True).check()
        page.get_by_role('button', name='Remover selecionados', exact=True).click()
        drawer = page.get_by_role('dialog')
        confirm = drawer.get_by_role('button', name='Confirmar 2 operações', exact=True)
        expect(confirm).to_be_disabled()
        field = drawer.get_by_label('Confirme o nome do environment', exact=True)
        field.fill('incorrect-environment')
        expect(confirm).to_be_disabled()
        check('destructive bulk removal sends no action before exact environment confirmation', not posts)
        page.set_viewport_size({'width': 390, 'height': 844})
        check('mobile destructive confirmation stays within viewport', drawer.evaluate(
            '(element) => { const box = element.getBoundingClientRect(); return box.x >= 0 && box.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1; }'))
        page.screenshot(path=str(ROOT / 'evidence/console-bulk-remove-mobile.png'))
        page.set_viewport_size({'width': 1440, 'height': 1000})
        field.fill('UI-OPS-LAB')
        confirm.click()
        expect(drawer.get_by_text('Recebida', exact=True)).to_have_count(2, timeout=30000)
        check('bulk removal posts each native action once and displays per-target acceptance', len(posts) == 2)
        page.screenshot(path=str(ROOT / 'evidence/console-bulk-remove-results.png'))

        def removed(service):
            status, value, _ = admin.request('/v2-beta/' + base + '/services/' + service['id'])
            return status == 404 or status == 200 and (value.get('removed') or value.get('state') in ('removed', 'purged'))

        until(page, lambda: all(removed(service) for service in services))
        check('both disposable services reach actual removed backend state')
        check('accepted destructive batch offers no immediate resubmit',
              drawer.get_by_role('button', name='Confirmar 2 operações', exact=True).count() == 0)
        context.close()
        stage = 'readonly bulk removal denial'
        group = admin.api('localGroups', {'name': 'Console removal readonly ' + secrets.token_hex(4),
                                         'members': ['10'], 'grants': {'12': 'readonly'}})
        reader = session()
        reader.oidc('leitor')
        context = browser.new_context()
        context.add_cookies(cookies(reader))
        page = context.new_page()
        page.goto(lab.BASE + '/console/?env=1a12&q=' + name)
        expect(page.get_by_role('button', name=name, exact=True)).to_be_visible()
        expect(page.locator('input.operation-selection')).to_have_count(0)
        status, value, _ = reader.request('/v2-beta/' + base + '/stacks/' + stack['id'] + '?action=remove', {})
        check('readonly cannot select bulk removal or call native remove directly',
              status in (403, 404) or status == 422 and value.get('code') == 'InvalidAction')
        context.close()
    finally:
        status, current, _ = admin.request('/v2-beta/' + base + '/stacks/' + stack['id'])
        if status == 200 and not current.get('removed'):
            action = current.get('actions', {}).get('remove')
            assert action, 'Temporary stack cleanup action unavailable'
            assert admin.request(action, {})[0] in (200, 202, 204), 'Temporary stack cleanup failed'


def access_acceptance(browser):
    global group, stage
    stage = 'physical access and audit drawers'
    name = 'Console audit ' + secrets.token_hex(4)
    group = admin.api('localGroups', {'name': name, 'members': ['10'], 'grants': {'12': 'readonly'}})
    group = admin.api('localGroups', {'id': group['id'], 'name': name,
                                     'revision': group['revision'], 'members': ['10'], 'grants': {'12': 'member'}})
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    context.add_cookies(cookies(admin))
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(type(error).__name__))
    page.goto(lab.BASE + '/console/groups?env=1a12')
    page.get_by_role('button', name='Histórico de ' + name, exact=True).click()
    drawer = page.get_by_role('dialog')
    expect(drawer.get_by_role('cell', name='Atualização', exact=True)).to_be_visible()
    drawer.locator('button[aria-label^="Revisar evento "]').first.click()
    change = drawer.get_by_role('region', name='Alteração auditada')
    expect(change.get_by_text('UI-OPS-LAB: Read Only', exact=True)).to_be_visible()
    expect(change.get_by_text('UI-OPS-LAB: Member', exact=True)).to_be_visible()
    check('group drawer shows real before and after grants from persisted audit')
    change.scroll_into_view_if_needed()
    page.screenshot(path=str(ROOT / 'evidence/console-group-audit-dark.png'))
    drawer.get_by_role('button', name='Fechar', exact=True).click()
    stage = 'effective account access in real browser'
    page.goto(lab.BASE + '/console/users/1a10?env=1a12')
    page.get_by_role('button', name='Acesso efetivo', exact=True).click()
    drawer = page.get_by_role('dialog')
    expect(drawer.get_by_role('cell', name=name, exact=True)).to_be_visible()
    expect(drawer.locator('dd').filter(has_text='Member')).to_be_visible()
    check('account drawer shows backend role and the actual contributing group')
    page.screenshot(path=str(ROOT / 'evidence/console-effective-access-dark.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    check('mobile effective access drawer stays within viewport', drawer.evaluate(
        '(element) => { const box = element.getBoundingClientRect(); return box.x >= 0 && box.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1; }'))
    page.screenshot(path=str(ROOT / 'evidence/console-effective-access-mobile.png'))
    drawer.get_by_role('button', name='Fechar', exact=True).click()
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.get_by_role('button', name='Usar tema claro', exact=True).click()
    page.get_by_role('button', name='Acesso efetivo', exact=True).click()
    drawer = page.get_by_role('dialog')
    expect(drawer.get_by_role('cell', name=name, exact=True)).to_be_visible()
    expect(page.locator('html')).to_have_attribute('data-theme', 'light')
    page.screenshot(path=str(ROOT / 'evidence/console-effective-access-light.png'))
    check('effective access uses the shared light theme')
    drawer.get_by_role('button', name='Fechar', exact=True).click()
    stage = 'audit after group deletion'
    admin.api('localGroups', {'id': group['id'], 'name': name,
                              'revision': group['revision'], 'delete': True})
    group = None
    page.goto(lab.BASE + '/console/groups?env=1a12')
    page.get_by_role('button', name='Auditoria de grupos', exact=True).click()
    drawer = page.get_by_role('dialog')
    deleted = drawer.get_by_role('row').filter(has=page.get_by_role('cell', name=name, exact=True)).filter(
        has=page.get_by_role('cell', name='Exclusão', exact=True))
    expect(deleted).to_be_visible()
    deleted.locator('button[aria-label^="Revisar evento "]').click()
    expect(drawer.get_by_text('Grupo inexistente', exact=True)).to_be_visible()
    check('global audit retains and displays the deleted group snapshot')
    page.screenshot(path=str(ROOT / 'evidence/console-group-deletion-light.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    check('mobile audit drawer stays within viewport', drawer.evaluate(
        '(element) => { const box = element.getBoundingClientRect(); return box.x >= 0 && box.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1; }'))
    page.screenshot(path=str(ROOT / 'evidence/console-group-audit-mobile.png'))
    check('access and audit workflows produce no browser runtime errors', not errors)
    context.close()


admin = session()
try:
    admin.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        if args.self_access:
            self_access_acceptance(browser)
            browser.close()
            raise SystemExit(0)
        if args.session_expiry:
            session_expiry_acceptance(browser)
            browser.close()
            raise SystemExit(0)
        if args.topology:
            topology_acceptance(browser)
            browser.close()
            raise SystemExit(0)
        if args.a11y:
            accessibility_acceptance(browser)
            browser.close()
            raise SystemExit(0)
        if args.bulk_remove:
            bulk_remove_acceptance(browser)
            browser.close()
            raise SystemExit(0)
        if args.access:
            access_acceptance(browser)
            browser.close()
            raise SystemExit(0)
        if args.streams:
            stream_acceptance(browser)
            browser.close()
            raise SystemExit(0)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.add_cookies(cookies(admin))
        page = context.new_page()
        sockets = track(page)
        if args.expect_disabled:
            stage = 'disabled runtime flag'
            page.goto(lab.BASE + '/console/hosts/1h1?env=1a12')
            expect(page.get_by_role('button', name='console-standalone', exact=True)).to_be_visible()
            expect(page.get_by_role('button', name='Métricas do host', exact=True)).to_have_count(0)
            page.get_by_role('button', name='console-standalone', exact=True).click()
            expect(page.get_by_role('dialog')).to_be_visible()
            expect(page.get_by_role('button', name='Métricas', exact=True)).to_have_count(0)
            check('disabled runtime metrics flag removes host and container controls without opening sockets', not sockets)
            context.close()
            browser.close()
            raise SystemExit(0)
        stage = 'host live metrics'
        host_metrics(page)
        until(page, lambda: sockets and sockets[-1]['frames'] >= 3)
        check('host receives multiple real metric frames')
        expect(page.get_by_role('img', name='CPU: evolução das amostras recebidas')).to_be_visible()
        expect(page.get_by_role('img', name='Memória: evolução das amostras recebidas')).to_be_visible()
        check('host CPU and memory charts render with explicit units')
        page.screenshot(path=str(ROOT / 'evidence/console-metrics-host-dark.png'))
        stage = 'pause resume reconnect and CSV'
        page.get_by_role('button', name='Pausar', exact=True).click()
        until(page, lambda: sockets[-1]['closed'])
        expect(page.get_by_text('Pausado', exact=True)).to_be_visible()
        check('pause closes the real metric socket')
        page.get_by_role('button', name='Retomar', exact=True).click()
        until(page, lambda: len(sockets) >= 2 and sockets[-1]['frames'] >= 2)
        check('resume opens a new socket and receives samples')
        previous = sockets[-1]
        page.get_by_role('button', name='Reconectar métricas', exact=True).click()
        until(page, lambda: previous['closed'] and len(sockets) >= 3 and sockets[-1]['frames'] >= 2)
        check('explicit reconnect replaces the previous socket')
        with page.expect_download() as download:
            page.get_by_role('button', name='CSV', exact=True).click()
        rows = list(csv.DictReader(io.StringIO(Path(download.value.path()).read_text(encoding='utf-8'))))
        check('CSV contains timestamped numeric samples without connection credentials',
              len(rows) >= 2 and set(rows[0]) == {'ts', 'cpuPercent', 'memoryMiB', 'memoryLimitMiB',
                                                'rxKiBs', 'txKiBs', 'readKiBs', 'writeKiBs'}
              and all(row['ts'] and float(row['memoryMiB']) >= 0 for row in rows))
        stage = 'mobile layout'
        page.set_viewport_size({'width': 390, 'height': 844})
        check('mobile drawer and controls stay within viewport', page.locator('[role=dialog]').evaluate(
            '(element) => { const box = element.getBoundingClientRect(); return box.x >= 0 && box.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1; }'))
        page.screenshot(path=str(ROOT / 'evidence/console-metrics-host-mobile.png'))
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.get_by_role('button', name='Fechar', exact=True).click()
        until(page, lambda: sockets[-1]['closed'])
        check('closing drawer tears down the socket')
        stage = 'light theme'
        page.get_by_role('button', name='Usar tema claro', exact=True).click()
        expect(page.locator('html')).to_have_attribute('data-theme', 'light')
        page.get_by_role('button', name='Métricas do host', exact=True).click()
        expect(page.get_by_text('Ao vivo', exact=True)).to_be_visible(timeout=45000)
        until(page, lambda: sockets[-1]['frames'] >= 3)
        page.screenshot(path=str(ROOT / 'evidence/console-metrics-host-light.png'))
        check('light theme renders live metrics using shared theme controls')
        page.get_by_role('button', name='Fechar', exact=True).click()
        page.get_by_role('button', name='Usar tema escuro', exact=True).click()
        stage = 'container live metrics'
        page.get_by_role('button', name='console-standalone', exact=True).click()
        page.get_by_role('button', name='Métricas', exact=True).click()
        expect(page.get_by_text('Ao vivo', exact=True)).to_be_visible(timeout=45000)
        until(page, lambda: sockets[-1]['frames'] >= 3)
        check('physical container receives multiple metric frames')
        page.screenshot(path=str(ROOT / 'evidence/console-metrics-container-dark.png'))
        if args.soak_seconds > 0:
            stage = 'prolonged container metrics'
            monitor = context.new_cdp_session(page)
            monitor.send('HeapProfiler.collectGarbage')
            heap_before = monitor.send('Runtime.getHeapUsage')['usedSize']
            started = time.monotonic()
            count = len(sockets)
            until(page, lambda: time.monotonic() - started >= args.soak_seconds,
                timeout=(args.soak_seconds + 10) * 1000)
            expect(page.get_by_text('Ao vivo', exact=True)).to_be_visible()
            check('prolonged stream stays live without reconnecting',
                len(sockets) == count and not sockets[-1]['closed']
                and sockets[-1]['frames'] >= args.soak_seconds / 2)
            with page.expect_download() as download:
                page.get_by_role('button', name='CSV', exact=True).click()
            rows = list(csv.DictReader(io.StringIO(Path(download.value.path()).read_text(encoding='utf-8'))))
            from datetime import datetime
            timestamps = [datetime.fromisoformat(row['ts'].replace('Z', '+00:00')) for row in rows]
            check('prolonged export respects 300 point and five minute history bounds',
                2 <= len(rows) <= 300 and (timestamps[-1] - timestamps[0]).total_seconds() <= 300)
            monitor.send('HeapProfiler.collectGarbage')
            heap_after = monitor.send('Runtime.getHeapUsage')['usedSize']
            check('retained JS heap stays within warm baseline plus eight MiB after collection',
                  heap_after <= heap_before + 8 * 1024 * 1024)
            checks[-1].update({'soakSeconds': args.soak_seconds,
                              'heapUsedStartBytes': heap_before, 'heapUsedEndBytes': heap_after,
                              'retainedGrowthBytes': heap_after - heap_before})
            monitor.detach()
            page.screenshot(path=str(ROOT / 'evidence/console-metrics-container-soak.png'))
        page.get_by_role('button', name='Fechar', exact=True).click()
        stage = 'reader open stream revocation'
        group = admin.api('localGroups', {'name': 'Console browser metrics ' + secrets.token_hex(4),
                                         'members': ['10'], 'grants': {'12': 'readonly'}})
        reader = session()
        reader.oidc('leitor')
        reader_context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        reader_context.add_cookies(cookies(reader))
        reader_page = reader_context.new_page()
        reader_sockets = track(reader_page)
        host_metrics(reader_page)
        until(reader_page, lambda: reader_sockets and reader_sockets[-1]['frames'] >= 2)
        check('readonly browser session receives live host metrics')
        admin.api('localGroups', {'id': group['id'], 'name': group['name'],
                                  'revision': group['revision'], 'delete': True})
        group = None
        until(reader_page, lambda: reader_sockets[-1]['closed'], timeout=35000)
        check('removing grant closes an already open reader socket within revalidation window')
        status, _, _ = reader.request('/v2-beta/projects/1a12/hosts/1h1')
        check('backend denies reader resource after temporary grant removal', status in (403, 404))
        reader_context.close()
        context.close()
        browser.close()
except Exception as error:
    checks.append({'check': stage, 'status': 'failed', 'errorType': type(error).__name__})
    print('FAILED: ' + stage + ' (' + type(error).__name__ + '); sensitive output withheld.', flush=True)
finally:
    if group:
        try:
            admin.api('localGroups', {'id': group['id'], 'name': group['name'],
                                      'revision': group['revision'], 'delete': True})
        except Exception:
            checks.append({'check': 'temporary grant cleanup', 'status': 'failed'})
    result_name = ('self-access-browser-test-results.json' if args.self_access else
                   'session-expiry-browser-test-results.json' if args.session_expiry else
                   'topology-browser-test-results.json' if args.topology else
                   'accessibility-browser-test-results.json' if args.a11y else
                   'bulk-remove-browser-test-results.json' if args.bulk_remove else
                   'access-browser-test-results.json' if args.access else
                   'stream-browser-test-results.json' if args.streams else
                   'metrics-flag-test-results.json' if args.expect_disabled else
                   'metrics-browser-test-results.json' if args.soak_seconds else
                   'metrics-browser-smoke-test-results.json')
    (ROOT / 'console' / result_name).write_text(
        json.dumps(checks, indent=2) + '\n', encoding='utf-8')
if any(item['status'] != 'passed' for item in checks):
    raise SystemExit(1)
print(str(len(checks)) + ' metric browser checks passed.', flush=True)