"""Real immutable-image loss/import proof; deletes only a newly built labeled scratch fixture."""
import io
import json
from pathlib import Path
import secrets
import subprocess
import tarfile
import time

from migration import images
from migration.recovery import OWNER, inspect
from migration.tool import run


def main():
    label = secrets.token_hex(16)
    context = io.BytesIO()
    with tarfile.open(fileobj=context, mode='w') as archive:
        files = {'Dockerfile': ('FROM scratch\nLABEL ' + OWNER + '="' + label + '"\nCOPY fixture.txt /fixture.txt\n').encode(),
                 'fixture.txt': b'synthetic community image transport fixture\n'}
        for name, data in files.items():
            info = tarfile.TarInfo(name); info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
    result = subprocess.run(['docker', 'build', '--network', 'none', '--quiet', '-'], input=context.getvalue(), capture_output=True, timeout=180)
    assert result.returncode == 0, 'Synthetic image build failed.'
    image_id = images.image_ids([result.stdout.decode().strip()])[0]
    directory = Path(__file__).resolve().parents[1] / 'migration-runs' / ('image-transport-' + time.strftime('%Y%m%d-%H%M%S'))
    directory.mkdir()
    password = secrets.token_urlsafe(48)
    try:
        assert inspect(image_id, 'image')['Config']['Labels'][OWNER] == label
        metadata = images.save(directory / 'images.tar.enc', [image_id], password)
        # This image was created by THIS invocation and has no users/tags; no source image is removed.
        run(['image', 'rm', image_id])
        assert subprocess.run(['docker', 'image', 'inspect', image_id], capture_output=True).returncode != 0
        result = images.load_missing(directory, metadata, password)
        assert result['imageLoadNeeded'] and inspect(image_id, 'image')['Config']['Labels'][OWNER] == label
        result.update(immutableImageIdPreserved=True, onlyOwnedSyntheticImageRemoved=True, status='passed')
        (directory / 'image-transport-results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2))
    finally:
        available = subprocess.run(['docker', 'image', 'inspect', image_id], capture_output=True)
        if available.returncode == 0:
            assert json.loads(available.stdout)[0]['Config']['Labels'][OWNER] == label
            run(['image', 'rm', image_id])


if __name__ == '__main__':
    main()
