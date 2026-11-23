#!/bin/sh
set -eu

export LC_ALL=C
for component in agent host-api; do
    source_dir="/go/src/github.com/rancher/$component"
    mkdir -p "$source_dir" "/out/licenses/$component"
    tar -xzf "/tmp/$component.tar.gz" -C "$source_dir" --strip-components=1
    cd "$source_dir"
    if [ "$component" = agent ]; then
        package=go-agent
        version=v0.13.11
        sed -i 's/"1.22"/"1.40"/g' service/hostapi/events/client.go utilities/docker/launch_unix.go
    else
        package=host-api
        version=v0.38.1
        sed -i 's/"1.18"/"1.40"/g' events/client.go
        sed -i 's/"1.22"/"1.40"/g' stats/container_stats.go stats/stats.go
    fi
    find . -type f \( -iname '*license*' -o -iname 'notice*' -o -iname 'copying*' -o -iname 'patents*' \) \
        -exec cp --parents '{}' "/out/licenses/$component/" \;
    package_dir="$package-$version-rancho-api140"
    mkdir -p "/tmp/$package_dir/bin"
    go build -trimpath -ldflags="-X main.VERSION=$version" -o "/tmp/$package_dir/bin/$component" .
    install -m 0755 apply.sh "/tmp/$package_dir/apply.sh"
    cd /tmp
    sha1sum -b "$package_dir/bin/$component" "$package_dir/apply.sh" > "$package_dir/SHA1SUMS"
    sha1sum "$package_dir/SHA1SUMS" > "$package_dir/SHA1SUMSSUM"
    tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -cf - "$package_dir" | gzip -n > "/out/$package.tar.gz"
done
