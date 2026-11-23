"""Rehearse clean installation and frontend rollback with one pinned console candidate."""

import argparse
import json
from pathlib import Path
import subprocess
import sys

from migration.test_fresh_install_lab import image_id


ROOT = Path(__file__).resolve().parents[1]


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


def rehearse(backend, previous, candidate, chromium, report, *, configuration_reversal=False):
    report['stage'] = 'resolve-images'
    images = {
        'backend': image_id(backend),
        'previousConsole': image_id(previous),
        'candidateConsole': image_id(candidate),
    }
    report['images'] = images
    if images['previousConsole'] == images['candidateConsole']:
        raise ValueError('Distinct console images required')

    report['stage'] = 'fresh-install'
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
    report['cleanupComplete'] = True
    report.update(status='passed', stage='complete')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend-image', required=True)
    parser.add_argument('--previous-console-image', required=True)
    parser.add_argument('--candidate-console-image', required=True)
    parser.add_argument('--chromium-executable')
    parser.add_argument('--configuration-reversal', action='store_true')
    args = parser.parse_args()
    report = {
        'status': 'failed',
        'scope': 'isolated fresh installation and frontend rollback',
        'freshInstallPassed': False,
        'frontendRollbackPassed': False,
        'cleanupComplete': False,
        'completeReleaseAccepted': False,
    }
    try:
        rehearse(args.backend_image, args.previous_console_image, args.candidate_console_image,
                 args.chromium_executable, report, configuration_reversal=args.configuration_reversal)
    except Exception as error:
        report['errorType'] = type(error).__name__
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
