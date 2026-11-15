#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
    printf 'Usage: %s COMPONENT COMMIT NEW_OUTPUT_DIRECTORY\n' "$0" >&2
    exit 2
fi

component=$1
revision=$2
output=$3
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
[[ "$revision" =~ ^[a-f0-9]{40}$ && "$revision" == "$(git rev-parse HEAD)" ]]
[[ -z "$(git status --porcelain --untracked-files=all)" ]]

fixture=console/tests/legacy-host
image="rancho-release-${component}:${revision}"
labels=(--platform linux/amd64 --label "org.opencontainers.image.revision=$revision")

case "$component" in
    backend)
        python3 scripts/upstream.py apply
        python3 scripts/upstream.py check
        docker build "${labels[@]}" -t rancho-release-legacy:build .
        docker build "${labels[@]}" -f "$fixture/Dockerfile.java17" \
          --build-arg BACKEND_IMAGE=rancho-release-legacy:build -t rancho-release-java17:build "$fixture"
        docker build "${labels[@]}" -f "$fixture/Dockerfile.modern-backend" \
          --build-arg BACKEND_JAVA17_IMAGE=rancho-release-java17:build -t rancho-release-backend:build "$fixture"
        docker build "${labels[@]}" -f "$fixture/Dockerfile.modern-packages" \
          --build-arg BACKEND_IMAGE=rancho-release-backend:build -t "$image" "$fixture"
        ;;
    console)
        docker build "${labels[@]}" -t "$image" console
        ;;
    restore)
        docker build "${labels[@]}" -f migration/Dockerfile.restore -t "$image" .
        ;;
    database)
        docker build "${labels[@]}" -f "$fixture/Dockerfile.modern-mariadb" -t "$image" "$fixture"
        ;;
    agent)
        docker build "${labels[@]}" -f "$fixture/Dockerfile.modern-client" -t rancho-release-client:build "$fixture"
        docker build "${labels[@]}" -f "$fixture/Dockerfile.modern-bootstrap" \
          --build-arg CLIENT_IMAGE=rancho-release-client:build -t "$image" "$fixture"
        ;;
    ipsec-holder|ipsec-router|ipsec-cni|network-manager|metadata|dns|healthcheck|scheduler)
        docker build "${labels[@]}" -f "$fixture/Dockerfile.modern-$component" -t "$image" "$fixture"
        ;;
    *)
        printf 'Unknown release component.\n' >&2
        exit 2
        ;;
esac

mkdir -- "$output"
cd "$output"
archive="rancho-${component}-${revision}.docker.tar.gz"
docker image save "$image" | gzip -1 > "$archive.tmp"
mv -- "$archive.tmp" "$archive"
docker image inspect --format '{{.Id}}' "$image" > IMAGE-ID.txt
sha256sum "$archive" IMAGE-ID.txt > SHA256SUMS.txt
sha256sum --check SHA256SUMS.txt
