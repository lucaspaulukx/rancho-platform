#!/bin/sh
set -eu

ca=/var/lib/rancher/etc/ssl/ca.crt
if [ -f "$ca" ]; then
    install -m 0644 "$ca" /usr/local/share/ca-certificates/rancher.crt
    update-ca-certificates
fi

exec "$@"
