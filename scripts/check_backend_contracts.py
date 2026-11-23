"""Compile and run the JDK-only backend contracts from the exported Cattle patch."""

import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('code/iaas/auth-logic/src/main/java/io/cattle/platform/iaas/api/auth/localrbac')
CLASSES = ('CustomizationConfig', 'OidcLogoutRules', 'OidcReadiness')
CONTRACTS = ('ConfigurationContract', 'OidcLogoutRulesContract', 'OidcReadinessContract')


def main():
    sources = [SOURCE / f'{name}.java' for name in CLASSES]
    contracts = [ROOT / 'tests' / f'{name}.java' for name in CONTRACTS]
    environment = {key: value for key, value in os.environ.items() if not key.upper().startswith('RANCHER_')}
    with TemporaryDirectory(prefix='rancho-backend-contracts-') as directory:
        work = Path(directory)
        selected = [f'--include={source.as_posix()}' for source in sources]
        subprocess.run(['git', 'apply', *selected, ROOT / 'patches/cattle.patch'],
                       cwd=work, check=True, timeout=20)
        subprocess.run(['javac', '--release', '8', '-d', 'classes', *sources, *contracts],
                       cwd=work, check=True, timeout=60)
        for contract in CONTRACTS:
            subprocess.run(['java', '-cp', 'classes', contract],
                           cwd=work, env=environment, check=True, timeout=20)


if __name__ == '__main__':
    main()
