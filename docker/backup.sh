#!/bin/sh
# Nightly pg_dump of the CRC Media database into /backups, keeping KEEP_DAYS days.
# Runs inside the postgres image (has pg_dump + gzip). Set RUN_NOW=1 to take one backup immediately at start.
set -eu
BACKUP_TIME="${BACKUP_TIME:-02:00}"
KEEP_DAYS="${KEEP_DAYS:-30}"
mkdir -p /backups

dump() {
  f="/backups/linkroster-$(date +%F_%H%M).sql.gz"
  echo "[backup] $(date) -> $f"
  if pg_dump --no-owner | gzip > "$f.tmp"; then
    mv "$f.tmp" "$f"
    find /backups -name 'linkroster-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
    echo "[backup] ok ($(du -h "$f" | cut -f1))"
  else
    rm -f "$f.tmp"
    echo "[backup] FAILED" >&2
  fi
}

until pg_isready -q; do sleep 5; done
[ "${RUN_NOW:-0}" = "1" ] && dump

while true; do
  now=$(date +%s)
  target=$(date -d "$(date +%F) $BACKUP_TIME" +%s 2>/dev/null || date -D "%Y-%m-%d %H:%M" -d "$(date +%F) $BACKUP_TIME" +%s)
  [ "$target" -le "$now" ] && target=$((target + 86400))
  echo "[backup] next run in $(( (target - now) / 60 )) min"
  sleep $((target - now))
  dump
done
