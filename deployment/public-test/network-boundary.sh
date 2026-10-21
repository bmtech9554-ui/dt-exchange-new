#!/bin/sh
# Add only rules scoped to the dedicated test bridge; never flush shared chains.
set -eu
ipt() { iptables -w 10 "$@"; }
add() { chain="$1"; shift; ipt -C "$chain" "$@" 2>/dev/null || ipt -A "$chain" "$@"; }
ipt -N DT_PUBLIC_TEST_HOST 2>/dev/null || true
add DT_PUBLIC_TEST_HOST -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
add DT_PUBLIC_TEST_HOST -j REJECT
ipt -C INPUT -i dtpubtest0 -j DT_PUBLIC_TEST_HOST 2>/dev/null || ipt -I INPUT 1 -i dtpubtest0 -j DT_PUBLIC_TEST_HOST
ipt -N DT_PUBLIC_TEST_EGRESS 2>/dev/null || true
add DT_PUBLIC_TEST_EGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
add DT_PUBLIC_TEST_EGRESS -d 172.31.118.0/24 -j RETURN
add DT_PUBLIC_TEST_EGRESS -j REJECT
ipt -C DOCKER-USER -i dtpubtest0 -j DT_PUBLIC_TEST_EGRESS 2>/dev/null || ipt -I DOCKER-USER 1 -i dtpubtest0 -j DT_PUBLIC_TEST_EGRESS
