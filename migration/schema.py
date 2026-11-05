"""Versioned additive schema; callable only by the offline owned rehearsal sandbox."""
import hashlib
from pathlib import Path

from migration.tool import MigrationError


def apply_schema(database):
    # This module intentionally exposes no source/cutover CLI.
    if not database.container.startswith('rancher-rehearsal-'):
        raise MigrationError('Schema migration is restricted to the offline rehearsal.')
    sql = (Path(__file__).parent / 'sql/001-local-groups.sql').read_text(encoding='utf-8')
    checksum = hashlib.sha256(sql.encode()).hexdigest()
    database.query('CREATE TABLE IF NOT EXISTS cattle.community_schema_migration (version INT PRIMARY KEY, checksum VARCHAR(64) NOT NULL, applied TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;')
    existing = database.query('SELECT checksum FROM cattle.community_schema_migration WHERE version=1;')
    if existing:
        if existing != checksum:
            raise MigrationError('Migration checksum mismatch; refusing to change the schema.')
    # MySQL DDL auto-commits. Statements are additive/idempotent; record the version
    # only after every statement and expected-column query succeeds.
    if not existing:
        database.query('USE cattle;\n' + sql)
    columns = {
        'local_rbac_group': 'id,name,revision',
        'local_rbac_member': 'group_id,account_id',
        'local_rbac_grant': 'group_id,project_id,role',
        'local_rbac_audit': 'id,actor,group_id,operation,created',
        'local_rbac_audit_detail': 'id,actor,group_id,operation,before_snapshot,after_snapshot,created',
        'local_rbac_oidc_user': 'identity_hash,account_id',
    }
    for table, names in columns.items():
        database.query('SELECT ' + names + ' FROM cattle.' + table + ' LIMIT 0;')
    if not existing:
        database.query("INSERT INTO cattle.community_schema_migration(version,checksum) VALUES(1,'" + checksum + "');")
