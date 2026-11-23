#!/bin/sh
set -eu
case "${CONSOLE_ASSET_RETENTION:-true}" in
  true)
    mkdir -p /var/cache/console-runtime/console/assets
    cp -p /usr/share/nginx/html/console/assets/* /var/cache/console-runtime/console/assets/
    printf '%s\n' 'root /var/cache/console-runtime;' > /etc/nginx/snippets/console-assets-root.conf
    ;;
  false)
    printf '%s\n' 'root /usr/share/nginx/html;' > /etc/nginx/snippets/console-assets-root.conf
    ;;
  *) echo 'CONSOLE_ASSET_RETENTION must be true or false' >&2; exit 1 ;;
esac
