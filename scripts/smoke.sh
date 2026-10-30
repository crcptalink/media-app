#!/usr/bin/env bash
# Quick smoke test against a running CRC Media app.
#   scripts/smoke.sh [base_url]      (reads TV_TOKEN / KIOSK_TOKEN from .env if present)
# Optional: SMOKE_EMAIL / SMOKE_PASSWORD to also test a password sign-in and the signed-in pages.
set -u
B="${1:-http://localhost:3000}"
[ -f .env ] && set -a && . ./.env && set +a
fail=0
check() { # name expected_code url [curl args...]
  local name=$1 want=$2 url=$3; shift 3
  local got; got=$(curl -s -o /dev/null -w "%{http_code}" "$@" "$url")
  if [ "$got" = "$want" ]; then echo "ok   $name ($got)"; else echo "FAIL $name (got $got, want $want)"; fail=1; fi
}
check "health"            200 "$B/api/health"
check "login page"        200 "$B/login"
check "me needs login"    307 "$B/me"
check "tv page"           200 "$B/tv?token=${TV_TOKEN:-}"
check "tv api"            200 "$B/api/tv?token=${TV_TOKEN:-}"
check "tv api bad token"  401 "$B/api/tv?token=nope"
check "kiosk page"        200 "$B/kiosk?token=${KIOSK_TOKEN:-}"
if [ -n "${SMOKE_EMAIL:-}" ] && [ -n "${SMOKE_PASSWORD:-}" ]; then
  jar=$(mktemp)
  csrf=$(curl -s -c "$jar" -b "$jar" "$B/api/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
  curl -s -c "$jar" -b "$jar" -o /dev/null -X POST "$B/api/auth/callback/credentials" \
    --data-urlencode "csrfToken=$csrf" --data-urlencode "email=$SMOKE_EMAIL" --data-urlencode "password=$SMOKE_PASSWORD"
  for p in /me /roster /me/availability /admin/roster /admin/people /admin/rules /admin/setup; do check "signed in $p" 200 "$B$p" -b "$jar"; done
  rm -f "$jar"
fi
exit $fail
