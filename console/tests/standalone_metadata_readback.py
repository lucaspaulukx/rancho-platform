"""Edit one owned standalone container through the console on the legacy lab."""

import importlib.util
import json
from pathlib import Path
import re
import secrets
import time
from urllib.parse import urlsplit

from legacy_guest import run_guest
from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
ORIGIN = 'http://localhost:18090'
PROJECT = 'projects/1a12'
COLLECTION = PROJECT + '/containers'
LABEL = 'rancho.test.standalone-metadata'
SPEC = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(lab)
lab.BASE = ORIGIN


def wait_for(session, path, condition):
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        resource = session.api(path)
        if condition(resource):
            return resource
        time.sleep(1)
    raise TimeoutError('The owned container did not reach the expected state')


def physical_identity(resource):
    docker_id = resource.get('externalId') or ''
    assert re.fullmatch(r'[a-f0-9]{64}', docker_id)
    result = run_guest("sudo docker inspect --format 'FIXTURE_STATUS:{{.Id}} {{.Image}} {{.State.Running}}' " + docker_id)
    assert result.get('exitCode') == 0
    assert len(result['status']) == 1
    fields = result['status'][0].removeprefix('FIXTURE_STATUS:').split()
    assert fields[0] == docker_id and fields[-1] == 'true'
    return fields


def remove_owned(session, resource, name, changed_name):
    assert re.fullmatch(r'1i[0-9]+', resource['id'])
    path = COLLECTION + '/' + resource['id']
    current = wait_for(session, path, lambda value: value.get('removed')
                       or set(value.get('actions', {})).intersection({'stop', 'remove'}))
    assert current['accountId'] == '1a12' and current['labels'].get(LABEL) == name
    assert current['name'] in (name, changed_name)
    if current.get('removed'):
        return
    if 'remove' not in current['actions']:
        session.api(path + '?action=stop', {}, method='POST')
        wait_for(session, path, lambda value: 'remove' in value.get('actions', {}))
    session.api(path + '?action=remove', {}, method='POST')
    wait_for(session, path, lambda value: bool(value.get('removed')))
    docker_id = current.get('externalId')
    if docker_id:
        assert re.fullmatch(r'[a-f0-9]{64}', docker_id)
        remaining = run_guest("sudo docker ps -a --no-trunc --filter id=" + docker_id
                              + " --format 'FIXTURE_STATUS:{{.ID}}'")
        assert remaining.get('exitCode') == 0 and not remaining.get('status')
    print('PASS: exact standalone fixture removed')


def edit_in_browser(session, resource, edited_name, description):
    target = urlsplit(resource['links']['self'])
    assert target.netloc == 'localhost:18090' and not target.query
    assert target.path == '/v2-beta/' + COLLECTION + '/' + resource['id']
    expected = {'name': edited_name, 'description': description}
    changes = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(service_workers='block')
        context.add_cookies([{'name': cookie.name, 'value': cookie.value, 'url': ORIGIN}
                             for cookie in session.cookies if cookie.name in ('token', 'CSRF')])

        def gate(route):
            request = route.request
            url = urlsplit(request.url)
            if url.scheme == 'http' and url.netloc == target.netloc:
                if request.method in ('GET', 'HEAD'):
                    route.continue_()
                    return
                if request.method == 'PUT' and url.path == target.path and not url.query:
                    if request.post_data_json == expected:
                        changes.append(True)
                        route.continue_()
                        return
            route.abort()

        context.route('**/*', gate)
        context.route_web_socket('**/*', lambda _: None)
        page = context.new_page()
        page.goto(ORIGIN + '/console/containers?env=1a12', wait_until='domcontentloaded')
        page.get_by_role('button', name='Ações de ' + resource['name'], exact=True).click()
        page.get_by_text('Editar configuração', exact=True).click()
        dialog = page.get_by_role('dialog', name='Editar · ' + resource['name'])
        dialog.get_by_label('Nome', exact=True).fill(edited_name)
        dialog.get_by_label('Descrição', exact=True).fill(description)
        expect(dialog.get_by_label('Imagem', exact=True)).to_have_count(0)
        with page.expect_response(lambda response: urlsplit(response.url).path == target.path
                                  and response.request.method == 'PUT') as saved:
            dialog.get_by_role('button', name='Salvar alterações', exact=True).click()
        assert saved.value.ok and changes == [True]
        page.close()
        context.unroute_all(behavior='wait')
        context.close()


def main():
    session = lab.Session()
    name = 'rancho-standalone-' + secrets.token_hex(6)
    changed_name = name + '-edited'
    description = 'Updated standalone container test metadata'
    resource = None
    stage = 'preflight'
    try:
        session.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
        project = session.api(PROJECT)
        host = session.api(PROJECT + '/hosts/1h1')
        assert project['name'] == 'UI-OPS-LAB' and host['accountId'] == project['id']
        assert host['agentState'] == 'active'
        schema = session.api(PROJECT + '/schemas/container')
        assert 'PUT' in schema['resourceMethods']
        assert {key for key, field in schema['resourceFields'].items() if field.get('update')} == {'name', 'description'}
        stage = 'create'
        resource = session.api(COLLECTION, {'name': name, 'imageUuid': 'docker:alpine:3.20',
                               'networkMode': 'host', 'requestedHostId': host['id'], 'startOnCreate': True,
                               'command': ['sleep', '600'], 'labels': {LABEL: name}})
        path = COLLECTION + '/' + resource['id']
        before = wait_for(session, path, lambda value: value['state'] == 'running')
        assert before['accountId'] == project['id'] and before['labels'].get(LABEL) == name
        identity = physical_identity(before)
        stage = 'console-edit'
        edit_in_browser(session, before, changed_name, description)
        stage = 'readback'
        after = session.api(path)
        assert after['name'] == changed_name and after['description'] == description
        assert after['imageUuid'] == before['imageUuid'] and physical_identity(after) == identity
        print('PASS: console edits native name and description without replacing the running Docker container')
    except Exception as error:
        print(json.dumps({'status': 'failed', 'stage': stage, 'errorType': type(error).__name__}))
        return 1
    finally:
        try:
            if resource:
                remove_owned(session, resource, name, changed_name)
        finally:
            if any(cookie.name == 'token' for cookie in session.cookies):
                assert session.request('/v2-beta/token/current', method='DELETE')[0] in (200, 204, 401)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
