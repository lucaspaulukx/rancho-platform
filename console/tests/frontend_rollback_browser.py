"""Check retained console assets in browser tabs using synthetic, read-only API data."""

import re
from collections.abc import Callable
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import Browser, Page, Route, expect

ORIGIN = 'http://localhost:18091'
HOSTS = '/console/hosts'
STACKS = '/console/stacks'
PROJECT_ID = '1a9102'
PROJECT_NAME = 'Rollback acceptance environment'
PROJECT_API = f'/v2-beta/projects/{PROJECT_ID}'
ASSET = re.compile(r'/console/assets/[A-Za-z0-9_.-]+\.(?:js|css|woff2|svg|png|webp)')
OPERATIONS = re.compile(r'/console/assets/Operations-[A-Za-z0-9_-]+\.js')
ENTRY = re.compile(r'/console/assets/index-[A-Za-z0-9_-]+\.js')
STATIC_FILES = {
    '/console/console-config.json',
    '/console/brand/rancher-favicon.ico',
    '/console/brand/rancher-symbol.svg',
    '/console/brand/rancher-wordmark.svg',
    '/console/favicon.svg',
}
FIXTURES = {
    '/oidc/config': {'version': 1, 'effective': {}, 'available': {}},
    '/v2-beta/token': {'data': [{
        'accountId': 'frontend-rollback',
        'userIdentity': {'externalId': 'frontend-rollback'},
        'userType': 'user',
    }]},
    '/v2-beta/projects?limit=100': {'data': [
        {'id': '1a9101', 'name': 'Default synthetic environment', 'state': 'active'},
        {'id': PROJECT_ID, 'name': PROJECT_NAME, 'state': 'active'},
    ]},
    f'{PROJECT_API}/schemas': {'data': [
        {
            'id': kind,
            'pluralName': f'{kind}s',
            'resourceFields': {},
            'collectionMethods': ['GET'],
            'resourceMethods': ['GET'],
            'links': {'collection': f'{PROJECT_API}/{kind}s'},
        }
        for kind in ('host', 'stack', 'service', 'container')
    ]},
    **{
        f'{PROJECT_API}/{collection}?limit=100': {'data': []}
        for collection in ('hosts', 'stacks', 'services', 'containers')
    },
}


class Tab:
    def __init__(self, page: Page):
        self.page = page
        self.documents = 0
        self.blocked = 0
        self.page_errors = 0
        self.synthetic_requests = []
        self.asset_requests = []
        self.asset_responses = []
        self.static_failures = []
        page.context.route('**/*', self.route)
        page.context.route_web_socket('**/*', self.block_websocket)
        page.on('pageerror', self.record_page_error)
        page.on('response', self.record_response)
        page.set_default_timeout(15_000)

    def block_websocket(self, socket):
        self.blocked += 1
        socket.close()

    def record_page_error(self, _error):
        self.page_errors += 1

    def record_response(self, response):
        path = urlsplit(response.url).path
        if ASSET.fullmatch(path):
            self.asset_responses.append((path, response.status))

    def route(self, route: Route):
        request = route.request
        url = urlsplit(request.url)
        if f'{url.scheme}://{url.netloc}' == ORIGIN and request.method == 'GET':
            fixture_key = url.path + (f'?{url.query}' if url.query else '')
            if fixture_key in FIXTURES:
                self.synthetic_requests.append(fixture_key)
                route.fulfill(json=FIXTURES[fixture_key])
                return
            asset = bool(ASSET.fullmatch(url.path))
            document = request.resource_type == 'document' and url.path in {HOSTS, STACKS}
            if document or url.path in STATIC_FILES or asset:
                self.documents += int(document)
                if asset:
                    self.asset_requests.append(url.path)
                # Fetch the real static response without following redirects to API routes.
                response = route.fetch(max_redirects=0, timeout=10_000)
                try:
                    if response.status != 200:
                        self.static_failures.append(response.status)
                    if 300 <= response.status < 400:
                        route.abort()
                    else:
                        route.fulfill(response=response)
                finally:
                    response.dispose()
                return
        self.blocked += 1
        route.abort()

    def assert_clean(self):
        assert not self.blocked, f'Blocked browser requests: {self.blocked}'
        assert not self.page_errors, f'Uncaught browser errors: {self.page_errors}'
        assert not self.static_failures, f'Static response failures: {self.static_failures}'

    def load_hosts(self):
        response = self.page.goto(f'{ORIGIN}{HOSTS}?env={PROJECT_ID}', wait_until='domcontentloaded')
        assert response and response.status == 200, 'Hosts document did not return HTTP 200'
        heading = self.page.locator('main').get_by_role('heading', name='Hosts', exact=True)
        expect(heading).to_be_visible(timeout=15_000)
        self.assert_environment()
        entry = self.page.locator('script[type="module"][src]').get_attribute('src')
        assert entry and ENTRY.fullmatch(entry), 'Missing fingerprinted console entry script'
        assert (entry, 200) in self.asset_responses, 'Document entry script did not return HTTP 200'
        assert self.documents == 1, 'Hosts must load in one document'
        self.assert_operations_cold()
        self.assert_clean()
        self.page.evaluate('window.__frontendRollbackDocument = true')
        return entry

    def assert_environment(self):
        switcher = self.page.get_by_role('button', name=f'Environment: {PROJECT_NAME}', exact=True)
        expect(switcher).to_be_visible()
        assert parse_qs(urlsplit(self.page.url).query).get('env') == [PROJECT_ID], (
            'The selected environment is absent from the URL'
        )

    def assert_operations_cold(self):
        assert not any(OPERATIONS.fullmatch(path) for path in self.asset_requests), (
            'Operations was requested before the sidebar click'
        )

    def open_operations(self):
        self.assert_operations_cold()
        before = len(self.synthetic_requests)
        self.page.locator('.sidebar nav').get_by_role('link', name='Stacks', exact=True).click()
        main = self.page.locator('main')
        expect(main.get_by_role('heading', name=PROJECT_NAME, exact=True)).to_be_visible(timeout=15_000)
        empty_inventory = main.get_by_text(
            re.compile(r'^(Nenhum recurso neste filtro|No resources match these filters)$')
        )
        expect(empty_inventory).to_be_visible()
        assert urlsplit(self.page.url).path == STACKS, 'Sidebar did not navigate to Stacks'
        self.assert_environment()
        assert self.documents == 1 and self.page.evaluate('window.__frontendRollbackDocument'), (
            'The old tab reloaded during sidebar navigation'
        )
        operations = [(path, status) for path, status in self.asset_responses if OPERATIONS.fullmatch(path)]
        assert len(operations) == 1 and operations[0][1] == 200, (
            'The old document did not load exactly one Operations chunk with HTTP 200'
        )
        for collection in ('stacks', 'services', 'containers'):
            assert f'{PROJECT_API}/{collection}?limit=100' in self.synthetic_requests[before:], (
                f'Missing synthetic {collection} request for the retained environment'
            )
        self.assert_clean()
        return {'operationsAsset': operations[0][0], 'operationsStatus': operations[0][1]}

    def counts(self):
        return {
            'documents': self.documents,
            'assetResponses': len(self.asset_responses),
            'syntheticApiRequests': len(self.synthetic_requests),
            'blockedRequests': self.blocked,
            'pageErrors': self.page_errors,
            'staticFailures': len(self.static_failures),
        }


def check_old_tabs(browser: Browser, switch: Callable[[str], str]):
    """Start on previous, activate candidate, then restore previous via the supplied callback."""
    contexts = []

    def new_tab():
        context = browser.new_context(
            viewport={'width': 1440, 'height': 1000}, locale='pt-BR', service_workers='block'
        )
        contexts.append(context)
        return Tab(context.new_page())

    try:
        previous_tab = new_tab()
        previous_entry = previous_tab.load_hosts()
        candidate_entry = switch('candidate')
        assert candidate_entry != previous_entry, 'Candidate and previous document entries are identical'
        upgrade = previous_tab.open_operations()

        candidate_tab = new_tab()
        assert candidate_tab.load_hosts() == candidate_entry, 'Candidate document has the wrong entry'
        assert switch('previous') == previous_entry, 'Rollback did not restore the previous entry'
        rollback = candidate_tab.open_operations()
        assert upgrade['operationsAsset'] != rollback['operationsAsset'], (
            'Builds must have different Operations chunks to prove asset retention'
        )

        fresh_tab = new_tab()
        assert fresh_tab.load_hosts() == previous_entry, 'Fresh browser document did not load previous entry'
        for tab in (previous_tab, candidate_tab, fresh_tab):
            tab.assert_clean()
        return {
            'upgradeOldTab': {'entryAsset': previous_entry, **upgrade, **previous_tab.counts()},
            'rollbackOldTab': {'entryAsset': candidate_entry, **rollback, **candidate_tab.counts()},
            'freshAfterRollback': {'entryAsset': previous_entry, **fresh_tab.counts()},
        }
    finally:
        for context in reversed(contexts):
            context.close()
