"""Rehearse installation, migration and rollback using pinned local images."""

import argparse
import json
from pathlib import Path
import subprocess
import sys

from migration.test_fresh_install_lab import image_id


ROOT = Path(__file__).resolve().parents[1]
CLUSTER_PROFILES = ('EVENTING', 'LOCK', 'CONFIG_CUSTOM')


def run_check(arguments):
    return subprocess.run(
        [sys.executable, '-B', *arguments],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        check=True,
    ).stdout


def check_single_node_boundary(backend_image):
    """Verify the modern backend refuses cluster profiles with networking disabled."""
    for prefix in ('CATTLE', 'DEFAULT_CATTLE'):
        for profile in CLUSTER_PROFILES:
            flag = f'{prefix}_MODULE_PROFILE_HAZELCAST_{profile}'
            result = subprocess.run([
                'docker', 'run', '--rm', '--pull', 'never', '--network', 'none',
                '-e', 'CATTLE_DB_CATTLE_MYSQL_HOST=isolated-fixture',
                '-e', f'{flag}=true', backend_image,
            ], cwd=ROOT, capture_output=True, timeout=30)
            if (result.returncode != 2
                    or b'backend supports single-node mode only.' not in result.stderr):
                raise RuntimeError(f'The backend did not reject unsupported cluster flag: {flag}')


def rehearse(backend, previous, candidate, chromium, report, *, configuration_reversal=False,
             modern_database=None, restore_image=None):
    if bool(modern_database) != bool(restore_image) or (modern_database and configuration_reversal):
        raise ValueError('Invalid rehearsal image combination')
    report['stage'] = 'resolve-images'
    images = {
        'backend': image_id(backend),
        'previousConsole': image_id(previous),
        'candidateConsole': image_id(candidate),
    }
    report['images'] = images
    if images['previousConsole'] == images['candidateConsole']:
        raise ValueError('Distinct console images required')

    if modern_database:
        images['database'] = image_id(modern_database)
        images['restore'] = image_id(restore_image)
        report['scope'] = 'isolated first-start migration, database rollback and frontend rollback'
        report['firstStartMigrationPassed'] = False
        report['databaseRollbackPassed'] = False
        report['singleNodeBoundaryPassed'] = False
        report['stage'] = 'single-node-boundary'
        check_single_node_boundary(images['backend'])
        report['singleNodeBoundaryPassed'] = True
        report['stage'] = 'first-start-migration'
        run_check([
            '-m', 'migration.test_first_start_lab',
            '--backend-image', images['backend'], '--console-image', images['candidateConsole'],
            '--database-image', images['database'], '--restore-image', images['restore'],
        ])
        report['firstStartMigrationPassed'] = True
        report['stage'] = 'database-rollback'
        run_check([
            '-m', 'migration.rehearse_modern_backend', '--backend-image', images['backend'],
            '--database-image', images['database'],
        ])
        report['databaseRollbackPassed'] = True
    else:
        check_fresh_install(images, report, configuration_reversal)

    report['stage'] = 'frontend-rollback'
    args = [
        'console/tests/frontend_rollback.py',
        '--previous-image', images['previousConsole'],
        '--candidate-image', images['candidateConsole'],
    ]
    if chromium:
        args.extend(['--chromium-executable', chromium])
    rollback = json.loads(run_check(args))
    if (rollback.get('status') != 'passed' or rollback.get('cleanupComplete') is not True
            or rollback.get('images') != {
                'previous': images['previousConsole'], 'candidate': images['candidateConsole'],
            }):
        raise RuntimeError('Rollback evidence does not match the selected images')
    report['frontendRollbackPassed'] = True
    report['frontendConfigurationSha256'] = rollback['configurationSha256']
    report['stage'] = 'gateway-backend-replacement'
    report['gatewayBackendReplacementPassed'] = False
    gateway = json.loads(run_check([
        'console/tests/gateway_backend_replacement.py', '--gateway-image', images['candidateConsole'],
        '--fixture-image', images['candidateConsole'],
    ]))
    if (gateway.get('status') != 'passed' or gateway.get('cleanupComplete') is not True
            or gateway.get('backendAddressChanged') is not True or gateway.get('queryPreserved') is not True
            or gateway.get('consoleRestarted') is not False):
        raise RuntimeError('Gateway did not recover after the upstream address changed')
    report['gatewayBackendReplacementPassed'] = True
    if modern_database:
        report['stage'] = 'backend-process-recovery'
        report['backendProcessRecoveryPassed'] = False
        recovery = json.loads(run_check([
            '-m', 'migration.test_backend_crash_recovery', '--backend-image', images['backend'],
            '--console-image', images['candidateConsole'], '--database-image', images['database'],
        ]))
        if (recovery.get('status') != 'passed' or recovery.get('cleanupComplete') is not True
                or recovery.get('automaticRestart') is not True
                or recovery.get('sameAuthenticatedSession') is not True
                or recovery.get('environmentPreserved') is not True
                or recovery.get('schemaRecordPreserved') is not True
                or recovery.get('consoleRestarted') is not False or recovery.get('databaseRestarted') is not False):
            raise RuntimeError('Single-node backend did not recover automatically after a process crash')
        report['backendProcessRecoveryPassed'] = True
    report['cleanupComplete'] = True
    report.update(status='passed', stage='complete')


def check_fresh_install(images, report, configuration_reversal):
    report['stage'] = 'fresh-install'
    report['freshInstallPassed'] = False
    fresh_args = [
        '-m', 'migration.test_fresh_install_lab',
        '--backend-image', images['backend'],
        '--console-image', images['candidateConsole'],
    ]
    if configuration_reversal:
        fresh_args.append('--configuration-reversal')
        report['configurationReversalPassed'] = False
    run_check(fresh_args)
    report['freshInstallPassed'] = True
    if configuration_reversal:
        report['configurationReversalPassed'] = True

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend-image', required=True)
    parser.add_argument('--previous-console-image', required=True)
    parser.add_argument('--candidate-console-image', required=True)
    parser.add_argument('--chromium-executable')
    parser.add_argument('--configuration-reversal', action='store_true')
    parser.add_argument('--modern-database-image')
    parser.add_argument('--restore-image')
    args = parser.parse_args()
    if bool(args.modern_database_image) != bool(args.restore_image):
        parser.error('--modern-database-image and --restore-image must be supplied together')
    if args.modern_database_image and args.configuration_reversal:
        parser.error('--configuration-reversal requires the embedded database rehearsal')
    report = {
        'status': 'failed',
        'scope': 'isolated fresh installation and frontend rollback',
        'frontendRollbackPassed': False,
        'cleanupComplete': False,
        'completeReleaseAccepted': False,
    }
    try:
        rehearse(args.backend_image, args.previous_console_image, args.candidate_console_image,
                 args.chromium_executable, report, configuration_reversal=args.configuration_reversal,
                 modern_database=args.modern_database_image, restore_image=args.restore_image)
    except Exception as error:
        report['errorType'] = type(error).__name__
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
