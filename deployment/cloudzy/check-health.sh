#!/usr/bin/env bash
set -euo pipefail
printf 'CHECK %s\n' "$(date -u +%FT%TZ)"
disk_used=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
available=$(free -m | awk '/^Mem:/ {print $7}')
printf 'disk_used_pct=%s memory_available_mb=%s\n' "$disk_used" "$available"
printf 'load_average='; cut -d ' ' -f 1-3 /proc/loadavg
[ "$disk_used" -lt 85 ] && [ "$available" -gt 256 ]
for container in dtexchange-web-1 dtexchange-postgres-1 dtexchange-redis-1; do
 state=$(docker inspect --format '{{.State.Health.Status}}' "$container")
 printf '%s=%s\n' "$container" "$state"
 [ "$state" = healthy ]
done
systemctl is-active --quiet nginx fail2ban
curl --fail --silent --max-time 8 http://127.0.0.1:3000/site >/dev/null
printf 'website=ok\n'
find /srv/dtexchange/backups -maxdepth 1 -name '*.dump.age' -mmin -2880 -print -quit | grep -q .
printf 'backup_age=within_48h\n'
if [ "${CHECK_APPLICATION:-false}" = true ]; then
 curl --fail --silent --max-time 8 http://127.0.0.1:4000/health/ready >/dev/null
 printf 'api_readiness=ok\n'
else
 printf 'api_and_workers=blocked_for_production_adapters\n'
fi
python3 /srv/dtexchange/current/deployment/cloudzy/owner-health-report.py
