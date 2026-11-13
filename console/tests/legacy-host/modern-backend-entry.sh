#!/bin/bash
set -eu

: "${CATTLE_DB_CATTLE_MYSQL_HOST:?Set the isolated external database host}"
if [[ "$CATTLE_DB_CATTLE_DATABASE" != mysql ]]; then
    echo "The experimental backend requires the mysql profile for an external MySQL-compatible database." >&2
    exit 2
fi
source /usr/share/cattle/env_vars
for setting in MODULE_PROFILE_HAZELCAST_EVENTING MODULE_PROFILE_HAZELCAST_LOCK MODULE_PROFILE_HAZELCAST_CONFIG_CUSTOM; do
    for prefix in CATTLE DEFAULT_CATTLE; do
        variable="${prefix}_${setting}"
        value=${!variable-}
        case "${value,,}" in
            ''|false|no|off|0) ;;
            *)
                echo "The experimental backend supports single-node mode only." >&2
                exit 2
                ;;
        esac
    done
done

exec /opt/rancho-java17/bin/java -Xms128m -Xmx1024m -Dlogback.bootstrap.level=WARN \
    "-Dcattle.home=${CATTLE_HOME%/}/" \
    -cp "/opt/cattle:/opt/cattle/etc/cattle:/opt/cattle/WEB-INF/lib/*:/opt/cattle/WEB-INF/jetty/*" \
    io.cattle.platform.launcher.jetty.Main "$@"
