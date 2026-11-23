#!/bin/bash
set -euo pipefail

# Run inside a disposable healthcheck container with networking disabled.
config=/etc/haproxy/haproxy.cfg
next_config=/etc/haproxy/haproxy_new.cfg
socket=/var/run/haproxy.sock

sed '/{{range/,$ d' /etc/haproxy/haproxy_template.cfg >"$config"
cat >>"$config" <<'CONFIG'
backend rancho-smoke
    mode tcp
    server local 127.0.0.1:5678 check
CONFIG

/usr/bin/haproxy_reload.sh "$config" start
cp "$config" "$next_config"
printf '\n    server local2 127.0.0.1:5679 check\n' >>"$next_config"
/usr/bin/haproxy_reload.sh "$config" reload

for (( attempt=0; attempt<10; attempt++ )); do
    if [[ -S "$socket" ]] &&
        stats=$(printf 'show stat\n' | nc -U -w 1 "$socket") &&
        grep -qF 'rancho-smoke,local2,' <<<"$stats"; then
        echo 'PASS: HAProxy reload applied the new backend server'
        exit 0
    fi
    sleep 1
done

echo 'HAProxy did not report the new backend server after reload' >&2
exit 1
