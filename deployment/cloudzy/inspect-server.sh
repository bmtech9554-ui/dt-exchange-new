#!/usr/bin/env bash
set -euo pipefail
# Read-only inventory. Deliberately excludes environment and application config contents.
printf '\nOS\n'; cat /etc/os-release | head -n 3
printf '\nTime\n'; timedatectl show -p Timezone -p NTPSynchronized
printf '\nResources\n'; df -h /; free -m; uptime
printf '\nListening sockets\n'; ss -lnt
printf '\nServices\n'; systemctl is-active nginx docker postgresql redis-server fail2ban || true
printf '\nFirewall\n'; command -v ufw >/dev/null && ufw status verbose || true
printf '\nDocker\n'; command -v docker >/dev/null && docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' || true
printf '\nExisting project directories\n'; find /srv /opt -maxdepth 2 -type d -iname '*dtexchange*' 2>/dev/null || true
printf '\nNginx enabled site names\n'; find /etc/nginx/sites-enabled -maxdepth 1 -type l -printf '%f\n' 2>/dev/null || true
