#!/bin/sh
set -eu

# Run inside a disposable network namespace with NET_ADMIN and no external interface.
ip link add eth0 type veth peer name rancho-probe
ip address add 198.18.0.2/24 dev eth0
ip link set rancho-probe up
ip link set eth0 up

RANCHO_BOOTSTRAP_SMOKE=verified timeout 12 /usr/bin/r /bin/sh -c '
    test "$RANCHO_BOOTSTRAP_SMOKE" = verified &&
    test "$1" = probe &&
    exit 23
' rancho-smoke probe &
wrapper=$!
trap 'kill "$wrapper" 2>/dev/null || true' EXIT
sleep 1
kill -0 "$wrapper"
ip route add default via 198.18.0.1 dev eth0

code=0
wait "$wrapper" || code=$?
trap - EXIT
test "$code" = 23
printf '%s\n' 'PASS: bootstrap wrapper waits for the route and preserves arguments, environment and exit status'
