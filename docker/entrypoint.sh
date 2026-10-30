#!/bin/sh
set -e
cd /app
echo "[entrypoint] applying database migrations…"
npx --no-install prisma migrate deploy
echo "[entrypoint] importing Link Sunday 2026 schedule if needed…"
if node scripts/import-link-2026.js; then
  true
else
  echo "[entrypoint] link-2026-sunday-v1 import failed; continuing" >&2
fi
echo "[entrypoint] starting CRC Media on :${PORT:-3000}"
exec node server.js
