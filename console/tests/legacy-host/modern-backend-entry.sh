#!/bin/bash
set -eu

: "${CATTLE_DB_CATTLE_MYSQL_HOST:?Set the isolated external database host}"
if [[ "$CATTLE_DB_CATTLE_DATABASE" != mysql ]]; then
    echo "The experimental backend requires the mysql profile for an external MySQL-compatible database." >&2
    exit 2
fi
source /usr/share/cattle/env_vars

exec /opt/rancho-java17/bin/java -Xms128m -Xmx1024m -Dlogback.bootstrap.level=WARN \
    -cp /opt/cattle:/opt/cattle/etc/cattle io.cattle.platform.launcher.Main "$@"
