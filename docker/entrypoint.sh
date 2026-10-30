#!/bin/sh
set -e
cd /app
echo "[entrypoint] applying database migrations…"
npx --no-install prisma migrate deploy
echo "[entrypoint] starting Link Roster on :${PORT:-3000}"
exec node server.js
