"""Read-only source dump; runtime JDBC contracts against a new original20-env copy."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import secrets
import subprocess
import time

from migration import tool
from migration.recovery import inspect, OWNER
from migration.test_original_rehearsal import original_twenty_environments


def main():
    root = Path(__file__).resolve().parents[1]
    folder = root / 'migration-runs' / ('runtime-schema-' + secrets.token_hex(6))
    folder.mkdir(parents=True)
    password = secrets.token_urlsafe(48)
    tool.backup(tool.Database('rancher16-rbac-lab'), folder, password)
    sql = tool.decrypt((folder / 'cattle.sql.enc').read_bytes(), password)
    label = secrets.token_hex(12)
    name = 'rancher-rehearsal-schema-' + label
    volume = name + '-db'
    image = inspect('rancher16-local-rbac:schema-validation', 'image')['Id']
    checks = []
    created = False
    tool.run(['volume', 'create', '--label', OWNER + '=' + label, volume])
    try:
        script = '''set -e
mysql_install_db --user=mysql --datadir=/var/lib/mysql >/tmp/init.log 2>&1
mkdir -p /var/run/mysqld; chown mysql:mysql /var/run/mysqld
exec mysqld --user=mysql --datadir=/var/lib/mysql --bind-address=127.0.0.1 --skip-slave-start --event-scheduler=OFF --innodb-buffer-pool-size=64M --log-error=/tmp/mysql.log
'''
        tool.run(['create', '--name', name, '--label', OWNER + '=' + label, '--log-driver', 'none',
                  '--network', 'none', '--memory', '768m', '--mount', 'type=volume,src=' + volume + ',dst=/var/lib/mysql,volume-nocopy',
                  '--mount', 'type=bind,src=' + str(root / 'tests') + ',dst=/contracts,readonly',
                  '--env', 'COMMUNITY_SCHEMA_OWNED_TEST=true', '--entrypoint', '/bin/sh', image, '-c', script])
        created = True
        tool.run(['start', name])
        for attempt in range(60):
            try:
                tool.run(['exec', name, 'mysqladmin', '--user=root', 'ping'], timeout=5)
                break
            except tool.MigrationError:
                if attempt == 59: raise
                time.sleep(1)
        state = inspect(name)
        assert state['HostConfig']['NetworkMode'] == 'none' and not state['HostConfig'].get('PortBindings')
        assert all(m.get('Name') != 'rancher16-rbac-lab-db' for m in state['Mounts'])
        tool.run(['exec', '-i', name, 'mysql', '--user=root'], sql, timeout=300)
        db = tool.Database(name)
        original_twenty_environments(db)
        baseline = tool.preflight(db, check_tables=True)
        assert baseline['inventoryCounts']['environments'] == 20
        java = '/usr/lib/jvm/zulu-8-amd64/bin/'
        classpath = '/lab/classes:/usr/share/cattle/war/WEB-INF/lib/*:/usr/share/cattle/war/WEB-INF/jetty/*'
        tool.run(['exec', name, java + 'javac', '-cp', classpath, '-d', '/tmp', '/contracts/CommunitySchemaContract.java', '/contracts/ConfigurationContract.java'])
        print(tool.run(['exec', name, java + 'java', '-cp', '/tmp:' + classpath, 'ConfigurationContract']).decode().strip(), flush=True)
        checksum = hashlib.sha256((root / 'migration/sql/001-local-groups.sql').read_text(encoding='utf-8').encode()).hexdigest()
        def contract(mode='apply'):
            result = subprocess.run(['docker', 'exec', name, java + 'java', '-cp', '/tmp:' + classpath, 'CommunitySchemaContract', mode, checksum], capture_output=True, timeout=90)
            if result.returncode:
                for line in result.stdout.decode(errors='replace').splitlines():
                    if line.startswith('SCHEMA-CONTRACT-FAILURE '):
                        print(line, flush=True)
                raise tool.MigrationError('Real JDBC schema contract failed; private diagnostics withheld.')
            return result.stdout
        def check(label):
            checks.append(label); print('PASS:', label, flush=True)
        contract()
        installed = db.query('SELECT version,checksum,applied FROM cattle.community_schema_migration;')
        contract()
        assert db.query('SELECT version,checksum,applied FROM cattle.community_schema_migration;') == installed
        after = tool.preflight(db, check_tables=True)
        assert all(after['tableChecksums'][table] == value for table, value in baseline['tableChecksums'].items())
        check('original20 schema installed, checksum shared with Python, native data preserved and reapply idempotent')
        db.query("UPDATE cattle.community_schema_migration SET checksum=REPEAT('0',64) WHERE version=1;")
        contract('expect-refusal')
        assert db.query('SELECT checksum FROM cattle.community_schema_migration;') == '0' * 64
        check('checksum drift refused without rewriting metadata')
        db.query("UPDATE cattle.community_schema_migration SET checksum='" + checksum + "',version=2;")
        contract('expect-refusal')
        check('future schema version refused')
        db.query('UPDATE cattle.community_schema_migration SET version=1; ALTER TABLE cattle.local_rbac_grant MODIFY role VARCHAR(8) NOT NULL;')
        contract('expect-refusal')
        check('incompatible pre-existing column refused')
        db.query('ALTER TABLE cattle.local_rbac_grant MODIFY role VARCHAR(16) NOT NULL; ALTER TABLE cattle.local_rbac_group DROP INDEX name;')
        contract('expect-refusal')
        check('missing uniqueness constraint refused')
        db.query('ALTER TABLE cattle.local_rbac_group ADD UNIQUE INDEX name(name); TRUNCATE TABLE cattle.community_schema_migration; ALTER TABLE cattle.community_schema_migration MODIFY checksum VARCHAR(8) NOT NULL;')
        contract('expect-refusal')
        assert db.query('SELECT COUNT(*) FROM cattle.community_schema_migration;') == '0'
        check('malformed version table refused before recording success')
        original_twenty_environments(db)
        partial = (root / 'migration/sql/001-local-groups.sql').read_text(encoding='utf-8').split(';')[:2]
        db.query('USE cattle;' + ';'.join(partial) + ';')
        contract()
        check('interrupted additive DDL resumes without duplicate data')
        original_twenty_environments(db)
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: contract(), range(2)))
        assert len(results) == 2 and db.query('SELECT COUNT(*) FROM cattle.community_schema_migration;') == '1'
        check('concurrent initializers serialize and record one version')
        # Corresponding restore, rather than pretending inverse DDL is a rollback.
        db.query('DROP DATABASE cattle;')
        tool.run(['exec', '-i', name, 'mysql', '--user=root'], sql, timeout=300)
        original_twenty_environments(db)
        restored = tool.preflight(db, check_tables=True)
        assert tool.compare(baseline, restored)
        check('restoring original20 snapshot rolls back schema and preserves all original checksums')
        report = {'status': 'passed', 'checks': checks, 'sourceModified': False, 'engineUpgradeAccepted': False}
        (folder / 'runtime-schema-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    finally:
        if created:
            assert inspect(name)['Config']['Labels'].get(OWNER) == label
            tool.run(['rm', '-f', '-v', name])
        assert inspect(volume, 'volume')['Labels'].get(OWNER) == label
        tool.run(['volume', 'rm', volume])


if __name__ == '__main__':
    main()
